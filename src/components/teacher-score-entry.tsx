"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import {
  buildLegacyScoreSnapshot,
  normalizeComponentScoreMap,
} from "@/lib/academic-config";
import {
  calculateSubjectTotalForScore,
  clampScore,
  formatDate,
  isSubjectIncomplete,
  resolveGrade,
  resultStatusLabel,
} from "@/lib/calculations";
import {
  clearTeacherScoreSyncRecord,
  isRetryableResponseStatus,
  readTeacherScoreSyncRecord,
  runSyncWithRetries,
  writeTeacherScoreSyncRecord,
} from "@/lib/client-sync-queue";
import {
  mergeTeacherSheetRows,
  teacherGridRowToSheetRow,
  type TeacherScoreSheetDraft,
} from "@/lib/teacher-scores";
import type {
  AcademicConfig,
  CommentTemplate,
  GradeBand,
  ResultStatus,
  StudentSummary,
  Subject,
  TeacherGridRow,
} from "@/lib/types";

interface ActivityLog {
  id: string;
  actor: string;
  message: string;
  timestamp: string;
}

type ScoreEntryMode = "teacher" | "reviewer";

interface TeacherScoreEntryProps {
  subject: Subject;
  gradeScale: GradeBand[];
  students: StudentSummary[];
  config: AcademicConfig;
  commentTemplates: CommentTemplate[];
  isLocked?: boolean;
  lockNote?: string;
  lockActor?: string;
  lockTimestamp?: string;
  mode?: ScoreEntryMode;
  actorName?: string;
  actorRole?: string;
  canEditWhenLocked?: boolean;
}

function makeActivity(actor: string, message: string): ActivityLog {
  return {
    id: `${actor}-${message}-${Date.now()}`,
    actor,
    message,
    timestamp: new Date().toISOString(),
  };
}

function applyRowComponentScores(row: TeacherGridRow, config: AcademicConfig, componentScores: Record<string, number | null>) {
  const normalized = normalizeComponentScoreMap(componentScores, config, {
    test1: row.test1,
    test2: row.test2,
    exam: row.exam,
  });
  const legacy = buildLegacyScoreSnapshot(normalized, config);

  return {
    ...row,
    componentScores: normalized,
    test1: legacy.test1,
    test2: legacy.test2,
    exam: legacy.exam,
  };
}

export function TeacherScoreEntry({
  subject,
  gradeScale,
  students,
  config,
  commentTemplates,
  isLocked = false,
  lockNote,
  lockActor,
  lockTimestamp,
  mode = "teacher",
  actorName,
  actorRole,
  canEditWhenLocked = false,
}: TeacherScoreEntryProps) {
  const componentRules = config.scoreComponents;
  const activityActor = actorName ?? subject.teacherName;
  const activityRole = actorRole ?? (mode === "reviewer" ? "School Admin" : "Subject Teacher");
  const templateHeaders = useMemo(
    () => ["regNumber", "fullName", ...componentRules.map((rule) => rule.key)],
    [componentRules],
  );
  const initialRows = useMemo<TeacherGridRow[]>(
    () =>
      students.map((summary) => {
        const score = summary.computedSubjects.find((entry) => entry.subjectId === subject.id);
        const blankComponentScores = Object.fromEntries(
          componentRules.map((rule) => [rule.key, null]),
        ) as Record<string, number | null>;

        return {
          regNumber: summary.bundle.student.regNumber,
          fullName: summary.bundle.student.fullName,
          componentScores: normalizeComponentScoreMap(score?.componentScores ?? blankComponentScores, config, {
            test1: score?.test1 ?? null,
            test2: score?.test2 ?? null,
            exam: score?.exam ?? null,
          }),
          test1: score?.test1 ?? null,
          test2: score?.test2 ?? null,
          exam: score?.exam ?? null,
          teacherComment: score?.teacherComment ?? "",
          status: score ? (score.status === "locked" ? "submitted" : score.status) : "draft",
        };
      }),
    [componentRules, config, students, subject.id],
  );
  const [rows, setRows] = useState(initialRows);
  const [sheetStatus, setSheetStatus] = useState<ResultStatus>("draft");
  const [csvFeedback, setCsvFeedback] = useState(
    "Download the score sheet as CSV or Excel, edit it offline, then upload CSV/Excel or paste from Excel.",
  );
  const [pasteValue, setPasteValue] = useState("");
  const [autosaveState, setAutosaveState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [selectedRegNumber, setSelectedRegNumber] = useState(initialRows[0]?.regNumber ?? "");
  const [activity, setActivity] = useState<ActivityLog[]>([
    makeActivity(activityActor, `Opened ${subject.name} score sheet for ${subject.className}.`),
  ]);
  const [lastSavedLabel, setLastSavedLabel] = useState<string>("Not yet saved to the server.");
  const [serverState, setServerState] = useState<"idle" | "loading" | "syncing" | "synced" | "pending" | "offline">("idle");
  const [serverLoaded, setServerLoaded] = useState(false);
  const [correctionReopenActive, setCorrectionReopenActive] = useState(
    mode === "teacher" && canEditWhenLocked,
  );
  const [reviewNote, setReviewNote] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [reviewedAt, setReviewedAt] = useState("");
  const canEdit = !isLocked || (mode === "reviewer" ? canEditWhenLocked : correctionReopenActive);
  const defaultFeedback = mode === "teacher" && correctionReopenActive
    ? "This sheet was returned for correction. Update the scores, save your changes if needed, and resubmit from here."
    : !canEdit
    ? "This class is locked for the current term. You can review the sheet, but only the school admin can reopen score entry."
    : mode === "reviewer"
      ? "Review and adjust this sheet here. Saved override edits update the live broadsheet, report sheets, and student result view immediately."
    : "Download the score sheet as CSV or Excel, edit it offline, then upload CSV/Excel or paste from Excel.";
  const displaySheetStatus: ResultStatus =
    mode === "teacher" && correctionReopenActive ? sheetStatus : isLocked ? "locked" : sheetStatus;
  const lockMessage = correctionReopenActive
    ? `This sheet was returned for correction${reviewedBy ? ` by ${reviewedBy}` : ""}${
        reviewedAt ? ` on ${formatDate(reviewedAt)}` : ""
      }. You can edit, save corrections, and resubmit this subject while the class remains locked for general entry.`
    : lockNote
    ? `${lockNote}${lockActor ? ` Locked by ${lockActor}` : ""}${lockTimestamp ? ` on ${formatDate(lockTimestamp)}.` : "."}`
    : mode === "reviewer"
      ? `Results are locked for ${subject.className}. Teacher edits are closed, but ${activityRole} override editing is active here.`
      : `Results are locked for ${subject.className}. Only the school admin can reopen them.`;
  const syncInFlightRef = useRef(false);
  const workingStatus: ResultStatus =
    mode === "reviewer"
      ? "under_review"
      : correctionReopenActive || sheetStatus === "corrections_requested"
        ? "corrections_requested"
        : "draft";
  const selectedRow = rows.find((row) => row.regNumber === selectedRegNumber) ?? rows[0];
  const exportRows = useMemo(
    () =>
      rows.map((row) => ({
        regNumber: row.regNumber,
        fullName: row.fullName,
        ...Object.fromEntries(componentRules.map((rule) => [rule.key, row.componentScores[rule.key] ?? ""])),
      })),
    [componentRules, rows],
  );
  const selectedRowIndex = rows.findIndex((row) => row.regNumber === selectedRegNumber);

  useEffect(() => {
    const returnedForCorrection = mode === "teacher" && canEditWhenLocked;
    setRows(initialRows);
    setSheetStatus("draft");
    setCorrectionReopenActive(returnedForCorrection);
    setReviewNote("");
    setReviewedBy("");
    setReviewedAt("");
    setSelectedRegNumber(initialRows[0]?.regNumber ?? "");
    setActivity([makeActivity(activityActor, `Opened ${subject.name} score sheet for ${subject.className}.`)]);
    setCsvFeedback(
      returnedForCorrection
        ? "This sheet was returned for correction. Edit it here, save if needed, and resubmit to the reviewer."
        : mode === "reviewer"
          ? "Review and adjust this sheet here. Saved override edits update the live broadsheet, report sheets, and student result view immediately."
          : isLocked
            ? "This class is locked for the current term. You can review the sheet, but only the school admin can reopen score entry."
            : "Download the score sheet as CSV or Excel, edit it offline, then upload CSV/Excel or paste from Excel.",
    );
    setPasteValue("");
    setAutosaveState("saved");
    setLastSavedLabel(
      returnedForCorrection
        ? "This returned sheet is open for correction and resubmission."
        : isLocked
          ? mode === "reviewer"
            ? `${activityRole} override is active for this locked class.`
            : "This class is currently locked. Reopen it from the result locks menu before editing."
          : "Not yet saved to the server.",
    );
    setServerState("idle");
    setServerLoaded(false);
  }, [activityActor, activityRole, canEditWhenLocked, initialRows, isLocked, mode, subject.className, subject.name]);

  useEffect(() => {
    if (autosaveState !== "unsaved" || !serverLoaded || !canEdit || rows.length === 0) {
      return;
    }

    setAutosaveState("saving");

    const timer = window.setTimeout(() => {
      void (async () => {
        const ok = await persistSheet(rows, workingStatus, { quiet: true });
        setAutosaveState(ok ? "saved" : "unsaved");
      })();
    }, 900);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveState, canEdit, rows, serverLoaded, serverState, workingStatus]);

  useEffect(() => {
    if (autosaveState !== "unsaved" || !serverLoaded || !canEdit || rows.length === 0) {
      return;
    }

    const draft = buildDraft(rows, workingStatus);

    void writeTeacherScoreSyncRecord(draft).then(() => {
      setServerState((current) => (current === "syncing" ? current : "pending"));
      setLastSavedLabel(`Saved locally ${formatDate(draft.updatedAt)}. Waiting to sync.`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveState, canEdit, rows, serverLoaded, workingStatus]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (autosaveState === "saved" || !canEdit) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [autosaveState, canEdit]);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedSheet() {
      setServerState("loading");
      const pendingRecord = await readTeacherScoreSyncRecord(subject.id);

      try {
        const response = await fetch(`/api/teacher-scores/${encodeURIComponent(subject.id)}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }

        const data = (await response.json()) as { sheet: TeacherScoreSheetDraft | null };

        if (cancelled) {
          return;
        }

        if (data.sheet) {
          setRows((current) => mergeTeacherSheetRows(current, data.sheet?.rows, config));
          setSheetStatus(data.sheet.sheetStatus ?? "draft");
          setCorrectionReopenActive(mode === "teacher" && data.sheet.sheetStatus === "corrections_requested");
          setReviewNote(data.sheet.reviewNote ?? "");
          setReviewedBy(data.sheet.reviewedBy ?? "");
          setReviewedAt(data.sheet.reviewedAt ?? "");
          setLastSavedLabel(`Last saved ${formatDate(data.sheet.updatedAt)} (server).`);
          setCsvFeedback(
            mode === "teacher" && data.sheet.sheetStatus === "corrections_requested"
              ? "This sheet was returned for correction. Update the scores, save if needed, and resubmit to the reviewer."
              : "Loaded the most recent saved score sheet from the server.",
          );
        } else {
          setCorrectionReopenActive(mode === "teacher" && canEditWhenLocked);
          setReviewNote("");
          setReviewedBy("");
          setReviewedAt("");
          setLastSavedLabel(
            !canEdit
              ? "This class is locked and no editable teacher draft is currently open."
              : isLocked
                ? "No saved override copy yet. Save here to establish the reviewer-controlled version."
              : "No server copy yet. Save a draft to sync this sheet.",
          );
        }

        setServerState(pendingRecord ? "pending" : "synced");
      } catch {
        if (!cancelled) {
          setServerState(pendingRecord ? "pending" : "offline");
          setLastSavedLabel(
            pendingRecord
              ? `Saved locally ${formatDate(pendingRecord.updatedAt)}. Waiting to sync.`
              : "Could not reach the server. New changes will be saved locally until sync returns.",
          );
        }
      } finally {
        if (!cancelled) {
          if (pendingRecord) {
            setRows((current) => mergeTeacherSheetRows(current, pendingRecord.payload.rows, config));
            setSheetStatus(pendingRecord.payload.sheetStatus ?? "draft");
            setCorrectionReopenActive(
              mode === "teacher" && pendingRecord.payload.sheetStatus === "corrections_requested",
            );
            setReviewNote(pendingRecord.payload.reviewNote ?? "");
            setReviewedBy(pendingRecord.payload.reviewedBy ?? "");
            setReviewedAt(pendingRecord.payload.reviewedAt ?? "");
            setAutosaveState("unsaved");
            setServerState("pending");
            setLastSavedLabel(`Saved locally ${formatDate(pendingRecord.updatedAt)}. Not yet synced to the server.`);
            setCsvFeedback(
              pendingRecord.lastError
                ? `${pendingRecord.lastError} Changes were kept locally and will retry automatically.`
                : "Loaded a pending local copy. It will retry automatically when the server is available.",
            );
            void syncDraftToServer(pendingRecord.payload, { quiet: true });
          }

          setServerLoaded(true);
        }
      }
    }

    void loadSavedSheet();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, canEditWhenLocked, config, isLocked, mode, subject.id]);

  useEffect(() => {
    function retryPendingSync() {
      void (async () => {
        const pendingRecord = await readTeacherScoreSyncRecord(subject.id);

        if (!pendingRecord) {
          return;
        }

        setServerState("pending");
        void syncDraftToServer(pendingRecord.payload, { quiet: true });
      })();
    }

    window.addEventListener("online", retryPendingSync);
    return () => window.removeEventListener("online", retryPendingSync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.id]);

  const completionProgress = useMemo(() => {
    const completeCells = rows.reduce(
      (sum, row) =>
        sum +
        componentRules.filter((rule) => {
          const value = row.componentScores[rule.key];
          return value !== null && value !== undefined;
        }).length,
      0,
    );
    const allCells = rows.length * componentRules.length || 1;

    return {
      completeCells,
      allCells,
      percent: Math.round((completeCells / allCells) * 100),
    };
  }, [componentRules, rows]);

  const distribution = useMemo(() => {
    const counts = new Map<string, number>();

    rows.forEach((row) => {
      const total = calculateSubjectTotalForScore(row, componentRules, config.rankingPolicy);
      const grade = resolveGrade(total, gradeScale);
      const key = isSubjectIncomplete(row, componentRules) ? "Missing" : grade.label;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
  }, [componentRules, config.rankingPolicy, gradeScale, rows]);

  const missingCells = completionProgress.allCells - completionProgress.completeCells;
  const average = Number(
    (
      rows.reduce(
        (sum, row) =>
          sum + calculateSubjectTotalForScore(row, componentRules, config.rankingPolicy),
        0,
      ) /
      (rows.length || 1)
    ).toFixed(2),
  );
  const highest = Math.max(
    0,
    ...rows.map((row) =>
      calculateSubjectTotalForScore(row, componentRules, config.rankingPolicy),
    ),
  );

  function pushActivity(message: string) {
    setActivity((current) => [makeActivity(activityActor, message), ...current].slice(0, 8));
  }

  function markDirty(message: string) {
    if (!canEdit) {
      setCsvFeedback(lockMessage);
      return;
    }

    setAutosaveState("unsaved");
    setSheetStatus(workingStatus);
    setServerState("idle");
    pushActivity(message);
  }

  function handleScoreChange(index: number, field: string, value: string) {
    if (!canEdit) {
      setCsvFeedback(lockMessage);
      return;
    }

    const component = componentRules.find((rule) => rule.key === field);
    const nextValue = value.trim() === "" ? null : Math.max(0, Math.min(component?.maxScore ?? 100, Number(value) || 0));

    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...applyRowComponentScores(row, config, {
                ...row.componentScores,
                [field]: nextValue,
              }),
              status: workingStatus,
            }
          : row,
      ),
    );

    markDirty(`Adjusted ${component?.label ?? field.toUpperCase()} for ${rows[index].fullName}.`);
  }

  function handleCommentChange(index: number, event: ChangeEvent<HTMLTextAreaElement>) {
    if (!canEdit) {
      setCsvFeedback(lockMessage);
      return;
    }

    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, teacherComment: event.target.value, status: workingStatus } : row,
      ),
    );

    markDirty(`Updated teacher comment for ${rows[index].fullName}.`);
  }

  function normalizeHeader(value: string) {
    return value.replace(/\s+/g, "").toLowerCase();
  }

  function parseImportedScore(rawValue: unknown, maxScore: number) {
    if (rawValue === null || rawValue === undefined || rawValue === "") {
      return null;
    }

    const numericValue =
      typeof rawValue === "number"
        ? rawValue
        : Number(String(rawValue).replace(/,/g, "").trim());

    if (Number.isNaN(numericValue)) {
      return null;
    }

    return clampScore(numericValue, maxScore);
  }

  function applyRowsFromRecords(records: Array<Record<string, unknown>>) {
    if (!canEdit) {
      setCsvFeedback(lockMessage);
      return;
    }

    if (records.length === 0) {
      setCsvFeedback("Import skipped because the uploaded sheet has no data rows.");
      return;
    }

    const updates = new Map(
      records
        .map((record) => {
          const normalized = Object.fromEntries(
            Object.entries(record).map(([key, value]) => [normalizeHeader(key), value]),
          );
          const regNumber = String(normalized.regnumber ?? "").trim();

          if (!regNumber) {
            return null;
          }

          return [regNumber, Object.fromEntries(
            componentRules.map((rule) => [
              rule.key,
              parseImportedScore(normalized[normalizeHeader(rule.key)], rule.maxScore),
            ]),
          )] as const;
        })
        .filter((entry): entry is readonly [string, Record<string, number | null>] => Boolean(entry)),
    );

    if (updates.size === 0) {
      setCsvFeedback(`Import headers must include regNumber and ${componentRules.map((rule) => rule.key).join(", ")}.`);
      return;
    }

    let touched = 0;

    setRows((current) =>
      current.map((row) => {
        const match = updates.get(row.regNumber);

        if (!match) {
          return row;
        }

        touched += 1;

        return {
          ...applyRowComponentScores(row, config, {
            ...row.componentScores,
            ...match,
          }),
          status: workingStatus,
        };
      }),
    );

    if (touched === 0) {
      setCsvFeedback("Import completed, but no matching registration numbers were found in this sheet.");
      return;
    }

    setCsvFeedback(`Imported ${touched} row(s) from the uploaded CSV/Excel sheet.`);
    setAutosaveState("unsaved");
    setSheetStatus(workingStatus);
    setServerState("idle");
    pushActivity(`Bulk CSV/Excel import applied to ${touched} row(s).`);
  }

  function applyRowsFromStructuredText(text: string, separator: "," | "\t") {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      setCsvFeedback("Import skipped because the pasted sheet has no data rows.");
      return;
    }

    const headers = lines[0].split(separator).map((header) => header.trim());
    const records = lines.slice(1).map((line) => {
      const cells = line.split(separator).map((cell) => cell.trim());
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    });

    applyRowsFromRecords(records);
  }

  async function downloadTemplate(format: "csv" | "xlsx", mode: "current" | "blank" = "current") {
    const XLSX = await import("xlsx");
    const sheetData =
      mode === "blank"
        ? rows.map((row) => ({
            regNumber: row.regNumber,
            fullName: row.fullName,
            ...Object.fromEntries(componentRules.map((rule) => [rule.key, ""])),
          }))
        : exportRows;
    const worksheet = XLSX.utils.json_to_sheet(sheetData, { header: templateHeaders });
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Scores");

    const suffix = mode === "blank" ? "blank-template" : "score-sheet";
    const fileName = `${subject.className}-${subject.code}-${suffix}.${format === "csv" ? "csv" : "xlsx"}`;
    const fileBuffer = XLSX.write(workbook, {
      type: "array",
      bookType: format,
    });
    const blob = new Blob([fileBuffer], {
      type:
        format === "csv"
          ? "text/csv;charset=utf-8;"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);

    const label = format === "csv" ? "CSV" : "Excel";
    setCsvFeedback(
      mode === "blank"
        ? `Downloaded a blank ${label} score template (registration numbers and names pre-filled).`
        : `Downloaded the current ${label} score sheet for offline editing.`,
    );
    pushActivity(`Exported ${mode === "blank" ? "blank " : ""}${format.toUpperCase()} score template.`);
  }

  async function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!canEdit) {
      setCsvFeedback(lockMessage);
      event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension === "csv") {
      const text = await file.text();
      applyRowsFromStructuredText(text, ",");
      event.target.value = "";
      return;
    }

    if (extension === "xlsx" || extension === "xls") {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

      applyRowsFromRecords(records);
      event.target.value = "";
      return;
    }

    setCsvFeedback("Unsupported file type. Please upload a CSV, XLSX, or XLS file.");
    event.target.value = "";
  }

  function applyPasteFromExcel() {
    if (!canEdit) {
      setCsvFeedback(lockMessage);
      return;
    }

    applyRowsFromStructuredText(pasteValue, "\t");
  }

  function buildDraft(
    nextRows: TeacherGridRow[],
    nextStatus: ResultStatus,
    timestamp = new Date().toISOString(),
  ): TeacherScoreSheetDraft {
    return {
      assignmentId: subject.id,
      subjectCode: subject.code,
      subjectName: subject.name,
      className: subject.className,
      teacherName: subject.teacherName,
      sheetStatus: nextStatus,
      rows: nextRows.map((row) => teacherGridRowToSheetRow(row, config)),
      updatedAt: timestamp,
      submittedAt:
        nextStatus === "submitted" || nextStatus === "principal_approved" ? timestamp : undefined,
      lastEditedBy: activityActor,
      lastEditedByRole: activityRole,
      reviewNote:
        mode === "reviewer"
          ? `${activityRole} adjusted raw scores from the dedicated override desk.`
          : undefined,
      reviewedBy: mode === "reviewer" ? activityActor : undefined,
      reviewedByRole: mode === "reviewer" ? activityRole : undefined,
      reviewedAt: mode === "reviewer" ? timestamp : undefined,
    };
  }

  async function syncDraftToServer(
    draft: TeacherScoreSheetDraft,
    options?: { quiet?: boolean },
  ) {
    if (syncInFlightRef.current) {
      return false;
    }

    syncInFlightRef.current = true;
    setServerState("syncing");

    const result = await runSyncWithRetries(async () => {
      const response = await fetch(`/api/teacher-scores/${encodeURIComponent(subject.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; sheet?: TeacherScoreSheetDraft }
        | null;

      if (!response.ok || !payload?.sheet) {
        const error = new Error(payload?.error ?? `Request failed with ${response.status}`) as Error & {
          retryable?: boolean;
        };
        error.retryable = isRetryableResponseStatus(response.status);
        throw error;
      }

      return payload.sheet;
    });

    syncInFlightRef.current = false;

    if (result.ok && result.value) {
      const pendingRecord = await readTeacherScoreSyncRecord(subject.id);

      if (pendingRecord && pendingRecord.updatedAt !== draft.updatedAt) {
        setServerState("pending");
        setLastSavedLabel(`Saved locally ${formatDate(pendingRecord.updatedAt)}. Syncing latest changes next.`);
        void syncDraftToServer(pendingRecord.payload, { quiet: true });
        return false;
      }

      await clearTeacherScoreSyncRecord(subject.id);
      setServerState("synced");
      setLastSavedLabel(`Last saved ${formatDate(result.value.updatedAt)} (server).`);
      return true;
    }

    const message = result.error?.message ?? "Could not save to the server right now.";
    const latestPendingRecord = await readTeacherScoreSyncRecord(subject.id);
    const pendingRecord =
      latestPendingRecord && latestPendingRecord.updatedAt !== draft.updatedAt
        ? latestPendingRecord
        : await writeTeacherScoreSyncRecord(draft, {
            attemptCount: result.attempts,
            lastError: message,
          });

    setServerState("pending");
    setLastSavedLabel(`Saved locally ${formatDate(pendingRecord.updatedAt)}. Not yet synced to the server.`);

    if (latestPendingRecord && latestPendingRecord.updatedAt !== draft.updatedAt) {
      void syncDraftToServer(latestPendingRecord.payload, { quiet: true });
    }

    if (!options?.quiet) {
      setCsvFeedback(
        result.retryable
          ? `${message} Saved locally and will retry automatically.`
          : `${message} Saved locally and is marked as pending.`,
      );
    }

    return false;
  }

  async function persistSheet(
    nextRows: TeacherGridRow[],
    nextStatus: ResultStatus,
    options?: { quiet?: boolean },
  ) {
    const draft = buildDraft(nextRows, nextStatus);
    await writeTeacherScoreSyncRecord(draft);
    setServerState("pending");
    setLastSavedLabel(`Saved locally ${formatDate(draft.updatedAt)}. Syncing now.`);
    return syncDraftToServer(draft, options);

    setServerState("syncing");
    const timestamp = new Date().toISOString();

    const legacyDraft: TeacherScoreSheetDraft = {
      assignmentId: subject.id,
      subjectCode: subject.code,
      subjectName: subject.name,
      className: subject.className,
      teacherName: subject.teacherName,
      sheetStatus: nextStatus,
      rows: nextRows.map((row) => teacherGridRowToSheetRow(row, config)),
      updatedAt: timestamp,
      submittedAt:
        nextStatus === "submitted" || nextStatus === "principal_approved" ? timestamp : undefined,
      lastEditedBy: activityActor,
      lastEditedByRole: activityRole,
      reviewNote:
        mode === "reviewer"
          ? `${activityRole} adjusted raw scores from the dedicated override desk.`
          : undefined,
      reviewedBy: mode === "reviewer" ? activityActor : undefined,
      reviewedByRole: mode === "reviewer" ? activityRole : undefined,
      reviewedAt: mode === "reviewer" ? timestamp : undefined,
    };

    try {
      const response = await fetch(`/api/teacher-scores/${encodeURIComponent(subject.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(legacyDraft),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; sheet?: TeacherScoreSheetDraft }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? `Request failed with ${response.status}`);
      }

      const data = payload as { sheet: TeacherScoreSheetDraft };

      setServerState("synced");
      setLastSavedLabel(`Last saved ${formatDate(data.sheet.updatedAt)} (server).`);
      return true;
    } catch {
      const message = "Could not save to the server right now.";
      setServerState("pending");
      setLastSavedLabel("Server save failed. Changes are kept locally — try saving again.");
      if (!options?.quiet || message) {
        setCsvFeedback(message);
      }
      return false;
    }
  }

  async function saveDraft() {
    if (!canEdit) {
      setCsvFeedback(lockMessage);
      return;
    }

    const nextRows = rows;
    const nextStatus: ResultStatus = mode === "reviewer" ? "under_review" : "draft";
    setSheetStatus(nextStatus);
    setAutosaveState("saving");
    pushActivity(mode === "reviewer" ? "Saved reviewer override edits." : "Saved score sheet as draft.");

    const ok = await persistSheet(nextRows, nextStatus);

    if (ok) {
      setAutosaveState("saved");
      setCsvFeedback(
        mode === "reviewer"
          ? "Override edits saved to the server. The live broadsheet, reports, and portal now read these scores."
          : "Draft saved to the server. You can resume from any device connected to this app.",
      );
    } else {
      setAutosaveState("unsaved");
    }
  }

  async function submitForReview() {
    if (!canEdit) {
      setCsvFeedback(lockMessage);
      return;
    }

    const rowStatus: ResultStatus = mode === "reviewer" ? "principal_approved" : "submitted";
    const nextStatus: ResultStatus = mode === "reviewer" ? "principal_approved" : "submitted";
    const nextRows = rows.map((row) => ({ ...row, status: rowStatus }));
    setRows(nextRows);
    setSheetStatus(nextStatus);
    setAutosaveState("saving");
    pushActivity(
      mode === "reviewer"
        ? `${subject.name} scores marked as school-admin-approved after override review.`
        : `${subject.name} scores submitted for HOD review.`,
    );

    const ok = await persistSheet(nextRows, nextStatus);

    if (ok) {
      setAutosaveState("saved");
      setCsvFeedback(
        mode === "reviewer"
          ? "Reviewed scores approved and saved. The score review page and printed outputs now reflect this school-admin sign-off."
          : "Sheet submitted and saved to the server. The HOD review desk now sees this submission.",
      );
    } else {
      setAutosaveState("unsaved");
    }
  }

  function applyCommentTemplate(text: string) {
    if (!selectedRow || !canEdit) {
      if (!canEdit) {
        setCsvFeedback(lockMessage);
      }
      return;
    }

    setRows((current) =>
      current.map((row) =>
        row.regNumber === selectedRow.regNumber
          ? { ...row, teacherComment: text, status: workingStatus }
          : row,
      ),
    );
    markDirty(`Applied comment template to ${selectedRow.fullName}.`);
  }

  return (
    <div className="grid-layout two-wide">
      <section className="surface-card span-two">
        <div className="section-head">
          <div>
            <p className="eyebrow">{mode === "reviewer" ? "Score Override Desk" : "Teacher Sheet"}</p>
            <h3>{mode === "reviewer" ? `${subject.name} score review` : `${subject.name} score entry`}</h3>
          </div>
          <div className="button-row">
            <span className={`status-pill status-${displaySheetStatus}`}>{resultStatusLabel(displaySheetStatus)}</span>
            <span
              className={`status-pill ${
                autosaveState === "saved"
                  ? "status-approved"
                  : autosaveState === "saving"
                    ? "status-under_review"
                    : "status-corrections_requested"
              }`}
            >
              Autosave {autosaveState}
            </span>
            <span
              className={`status-pill ${
                serverState === "synced"
                  ? "status-approved"
                  : serverState === "pending"
                    ? "status-pending"
                    : serverState === "offline"
                    ? "status-corrections_requested"
                    : "status-under_review"
              }`}
            >
              {serverState === "synced"
                ? "Server synced"
                  : serverState === "syncing"
                  ? "Saving to server"
                  : serverState === "loading"
                    ? "Loading server copy"
                    : serverState === "pending"
                      ? "Pending local sync"
                      : serverState === "offline"
                      ? "Server offline"
                      : "Server idle"}
            </span>
          </div>
        </div>

        <div className="inline-metrics">
          <div>
            <span>Completion progress</span>
            <strong>{completionProgress.percent}%</strong>
          </div>
          <div>
            <span>Missing component cells</span>
            <strong>{missingCells}</strong>
          </div>
          <div>
            <span>Subject average</span>
            <strong>{average}</strong>
          </div>
          <div>
            <span>Highest total</span>
            <strong>{highest}</strong>
          </div>
        </div>

        {missingCells > 0 ? (
          <div className="callout-banner warning">
            <strong>Ranking guard is active</strong>
            <p className="muted">
              Incomplete scores will not silently count as zero and affected students will be excluded from class positioning.
            </p>
          </div>
        ) : null}

        {isLocked ? (
          <div className="callout-banner warning">
            <strong>
              {mode === "reviewer"
                ? `Teacher editing is locked for ${subject.className}.`
                : `Score entry is locked for ${subject.className}.`}
            </strong>
            <p className="muted">{lockMessage}</p>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div className="callout-banner warning">
            <strong>No students are currently registered for this subject-class arm.</strong>
            <p className="muted">Once students are registered for {subject.name} in {subject.className}, they will appear here automatically.</p>
          </div>
        ) : null}

        <div className="toolbar">
          <label className="file-input">
            <span>Upload results (CSV / Excel)</span>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleCsvUpload} disabled={!canEdit} />
          </label>
          <button type="button" className="secondary-button" onClick={() => void downloadTemplate("xlsx", "blank")}>
            Download blank template (Excel)
          </button>
          <button type="button" className="secondary-button" onClick={() => void downloadTemplate("csv", "blank")}>
            Download blank template (CSV)
          </button>
          <button type="button" className="secondary-button" onClick={() => void downloadTemplate("xlsx")}>
            Export current sheet (Excel)
          </button>
          <button type="button" className="secondary-button" onClick={() => void downloadTemplate("csv")}>
            Export current sheet (CSV)
          </button>
          <button type="button" className="secondary-button" onClick={() => void saveDraft()} disabled={!canEdit || rows.length === 0}>
            {mode === "reviewer" ? "Save override" : "Save draft"}
          </button>
          <button type="button" className="primary-button" onClick={() => void submitForReview()} disabled={!canEdit || rows.length === 0}>
            {mode === "reviewer" ? "Approve scores" : "Submit to HOD"}
          </button>
        </div>
        <p className="muted">{lastSavedLabel}</p>

        <div className="paste-panel">
          <textarea
            value={pasteValue}
            onChange={(event) => setPasteValue(event.target.value)}
            placeholder={`Paste tab-separated rows from Excel with headers: ${templateHeaders.join("<TAB>")}`}
            disabled={!canEdit}
          />
          <button type="button" className="secondary-button" onClick={applyPasteFromExcel} disabled={!canEdit}>
            Apply pasted grid
          </button>
        </div>

        <p className="muted">{csvFeedback}</p>

        <div className="table-wrap teacher-table-wrap teacher-score-table">
          <table className="data-table teacher-grid">
            <thead>
              <tr>
                <th className="sticky-col">Reg Number</th>
                <th className="sticky-col-2">Student</th>
                {componentRules.map((rule) => (
                  <th key={rule.key}>
                    {rule.label}
                    <br />
                    <span className="muted">{rule.maxScore} marks</span>
                  </th>
                ))}
                <th>Total</th>
                <th>Grade</th>
                <th>Comment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const total = calculateSubjectTotalForScore(row, componentRules, config.rankingPolicy);
                const grade = resolveGrade(total, gradeScale);
                const incomplete = isSubjectIncomplete(row, componentRules);

                return (
                  <tr key={row.regNumber} className={selectedRegNumber === row.regNumber ? "selected-row" : ""}>
                    <td className="sticky-col">{row.regNumber}</td>
                    <td className="sticky-col-2">
                      <button
                        type="button"
                        className="row-selector"
                        onClick={() => setSelectedRegNumber(row.regNumber)}
                      >
                        {row.fullName}
                      </button>
                    </td>
                    {componentRules.map((rule) => (
                      <td key={`${row.regNumber}-${rule.key}`}>
                        <input
                          className={row.componentScores[rule.key] === null ? "cell-input input-error" : "cell-input"}
                          value={row.componentScores[rule.key] ?? ""}
                          type="number"
                          min={0}
                          max={rule.maxScore}
                          onChange={(event) => handleScoreChange(index, rule.key, event.target.value)}
                          disabled={!canEdit || (rule.frozen && mode !== "reviewer")}
                        />
                        {!canEdit ? (
                          <span className="mini-note">Locked</span>
                        ) : rule.frozen && mode !== "reviewer" ? (
                          <span className="mini-note">Frozen</span>
                        ) : null}
                      </td>
                    ))}
                    <td>{total}</td>
                    <td>
                      {incomplete ? (
                        <span className="status-pill status-corrections_requested">Missing</span>
                      ) : (
                        <span className="grade-badge" style={{ borderColor: grade.color, color: grade.color }}>
                          {grade.label}
                        </span>
                      )}
                    </td>
                    <td>
                      <textarea value={row.teacherComment} onChange={(event) => handleCommentChange(index, event)} disabled={!canEdit} />
                    </td>
                    <td>
                      <span className={`status-pill status-${row.status}`}>{resultStatusLabel(row.status)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="teacher-mobile-sheet">
          {rows.map((row, index) => {
            const total = calculateSubjectTotalForScore(row, componentRules, config.rankingPolicy);
            const grade = resolveGrade(total, gradeScale);
            const incomplete = isSubjectIncomplete(row, componentRules);
            const isSelected = selectedRegNumber === row.regNumber;

            return (
              <article key={`mobile-${row.regNumber}`} className={isSelected ? "teacher-mobile-card selected" : "teacher-mobile-card"}>
                <div className="teacher-mobile-card-head">
                  <div>
                    <p className="eyebrow">Student</p>
                    <h4>{row.fullName}</h4>
                    <p className="muted">{row.regNumber}</p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button teacher-mobile-select"
                    onClick={() => setSelectedRegNumber(row.regNumber)}
                  >
                    {isSelected ? "Templates open" : "Open templates"}
                  </button>
                </div>

                <div className="teacher-mobile-summary">
                  <div>
                    <span>Total</span>
                    <strong>{total}</strong>
                  </div>
                  <div>
                    <span>Grade</span>
                    {incomplete ? (
                      <span className="status-pill status-corrections_requested">Missing</span>
                    ) : (
                      <span className="grade-badge" style={{ borderColor: grade.color, color: grade.color }}>
                        {grade.label}
                      </span>
                    )}
                  </div>
                  <div>
                    <span>Status</span>
                    <span className={`status-pill status-${row.status}`}>{resultStatusLabel(row.status)}</span>
                  </div>
                </div>

                <div className="teacher-mobile-score-grid">
                  {componentRules.map((rule) => (
                    <label key={`${row.regNumber}-${rule.key}-mobile`}>
                      <span>
                        {rule.label}
                        <small>{rule.maxScore} marks</small>
                      </span>
                      <input
                        className={row.componentScores[rule.key] === null ? "cell-input input-error" : "cell-input"}
                        value={row.componentScores[rule.key] ?? ""}
                        type="number"
                        min={0}
                        max={rule.maxScore}
                        onChange={(event) => handleScoreChange(index, rule.key, event.target.value)}
                        disabled={!canEdit || (rule.frozen && mode !== "reviewer")}
                      />
                      {!canEdit ? (
                        <span className="mini-note">Locked</span>
                      ) : rule.frozen && mode !== "reviewer" ? (
                        <span className="mini-note">Frozen</span>
                      ) : null}
                    </label>
                  ))}
                </div>

                <label className="teacher-mobile-comment">
                  <span>Teacher comment</span>
                  <textarea
                    value={row.teacherComment}
                    onChange={(event) => handleCommentChange(index, event)}
                    disabled={!canEdit}
                    rows={3}
                  />
                </label>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Comment Desk</p>
            <h3>{selectedRow?.fullName ?? "Select a student"}</h3>
          </div>
        </div>

        <p className="muted">
          Use moderated templates to speed up remarks while keeping tone and character count under control.
        </p>

        <div className="teacher-template-target">
          <span>Applying templates to</span>
          <strong>{selectedRow?.fullName ?? "No student selected"}</strong>
          <p className="muted">
            {selectedRowIndex >= 0 ? `${selectedRowIndex + 1} of ${rows.length} students in this sheet.` : "Select a student row to target comment templates."}
          </p>
        </div>

        <div className="stack-list">
          {commentTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="selection-card"
              onClick={() => applyCommentTemplate(template.text)}
              disabled={!canEdit}
            >
              <strong>{template.category}</strong>
              <p>{template.text}</p>
            </button>
          ))}
        </div>
      </aside>

      <aside className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Quality Signals</p>
            <h3>Distribution and activity</h3>
          </div>
        </div>

        <div className="stack-list">
          {distribution.map((item) => (
            <div key={item.label} className="distribution-row">
              <div className="audit-header">
                <strong>{item.label}</strong>
                <span>{item.count}</span>
              </div>
              <div className="distribution-bar">
                <span style={{ width: `${(item.count / (rows.length || 1)) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="timeline">
          {activity.map((item) => (
            <article key={item.id} className="timeline-item">
              <strong>{item.actor}</strong>
              <p>{item.message}</p>
              <span>{formatDate(item.timestamp)}</span>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
