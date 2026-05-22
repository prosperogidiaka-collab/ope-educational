"use client";

import type { ReactNode } from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { TimetableExportActions } from "@/components/timetable-export-actions";
import { combineClassArm, classOfferingLabel } from "@/lib/class-structure";
import { resultStatusLabel } from "@/lib/calculations";
import type {
  ClassOffering,
  SchoolTimetable,
  StaffAccount,
  TimetableDay,
  TimetableEntry,
  TimetablePeriod,
} from "@/lib/types";

const TIMETABLE_DAYS: TimetableDay[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TIMETABLE_DAY_ORDER = new Map(TIMETABLE_DAYS.map((day, index) => [day, index]));
const TEACHING_ROLES = new Set(["teacher", "class_teacher", "hod", "school_admin", "principal"]);

interface TimetableBoardProps {
  schoolName: string;
  timetable: SchoolTimetable;
  currentAccount: Pick<StaffAccount, "id" | "fullName" | "role">;
  classOfferings: ClassOffering[];
  staffAccounts: StaffAccount[];
  canViewAll: boolean;
  canEdit: boolean;
}

interface TimetableEditorDraft {
  day: TimetableDay;
  periodId: string;
  teacherName: string;
  room: string;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function timetableCellMap(entries: TimetableEntry[]) {
  const map = new Map<string, TimetableEntry[]>();

  entries.forEach((entry) => {
    const key = `${entry.day}-${entry.periodId}`;
    const current = map.get(key) ?? [];
    current.push(entry);
    map.set(key, current);
  });

  return map;
}

function sortEntriesForEditor(entries: TimetableEntry[], periods: TimetablePeriod[]) {
  const periodOrder = new Map(periods.map((period, index) => [period.id, index]));

  return [...entries].sort((left, right) => {
    const dayCompare = (TIMETABLE_DAY_ORDER.get(left.day) ?? 99) - (TIMETABLE_DAY_ORDER.get(right.day) ?? 99);
    if (dayCompare !== 0) {
      return dayCompare;
    }

    const periodCompare = (periodOrder.get(left.periodId) ?? 999) - (periodOrder.get(right.periodId) ?? 999);
    if (periodCompare !== 0) {
      return periodCompare;
    }

    const classCompare = left.className.localeCompare(right.className);
    if (classCompare !== 0) {
      return classCompare;
    }

    return left.subjectName.localeCompare(right.subjectName);
  });
}

function buildEditorDraft(entry: TimetableEntry): TimetableEditorDraft {
  return {
    day: entry.day,
    periodId: entry.periodId,
    teacherName: entry.teacherName,
    room: entry.room ?? "",
  };
}

function csvRowsForTemplate() {
  return [
    [
      "Day",
      "Period Label",
      "Start Time",
      "End Time",
      "Teacher Name",
      "Subject Name",
      "Class",
      "Arm",
      "Track",
      "Room",
    ],
    ["Monday", "Period 1", "08:00", "08:40", "Mr. Kalejaiye", "Chemistry", "SS2", "Gold", "Science", "Lab 1"],
    ["Monday", "Period 1", "08:00", "08:40", "Mrs. Aina", "Literature", "SS2", "Gold", "Arts", "Room 5"],
    ["Monday", "Period 1", "08:00", "08:40", "Mr. Bamidele", "Accounting", "SS2", "Gold", "Commercial", "Room 6"],
  ];
}

function buildFreeTeacherIndex(
  periods: TimetablePeriod[],
  entries: TimetableEntry[],
  staffAccounts: StaffAccount[],
) {
  const teachingStaff = staffAccounts.filter(
    (account) => account.status === "active" && TEACHING_ROLES.has(account.role),
  );
  const occupiedMap = new Map<string, Set<string>>();

  entries.forEach((entry) => {
    const key = `${entry.day}-${entry.periodId}`;
    const current = occupiedMap.get(key) ?? new Set<string>();
    current.add((entry.teacherAccountId || entry.teacherName).toLowerCase());
    current.add(entry.teacherName.toLowerCase());
    occupiedMap.set(key, current);
  });

  return TIMETABLE_DAYS.flatMap((day) =>
    periods.map((period) => {
      const key = `${day}-${period.id}`;
      const occupied = occupiedMap.get(key) ?? new Set<string>();
      const freeTeachers = teachingStaff
        .filter((account) => !occupied.has(account.id.toLowerCase()) && !occupied.has(account.fullName.toLowerCase()))
        .map((account) => account.fullName);

      return {
        day,
        periodId: period.id,
        periodLabel: period.label,
        time: `${period.startTime} - ${period.endTime}`,
        freeTeachers,
      };
    }),
  );
}

function buildFreeRoomIndex(periods: TimetablePeriod[], entries: TimetableEntry[]) {
  const roomOptions = uniqueStrings(entries.map((entry) => entry.room ?? ""));
  const occupiedMap = new Map<string, Set<string>>();

  entries.forEach((entry) => {
    if (!entry.room) {
      return;
    }

    const key = `${entry.day}-${entry.periodId}`;
    const current = occupiedMap.get(key) ?? new Set<string>();
    current.add(entry.room.toLowerCase());
    occupiedMap.set(key, current);
  });

  return TIMETABLE_DAYS.flatMap((day) =>
    periods.map((period) => {
      const key = `${day}-${period.id}`;
      const occupied = occupiedMap.get(key) ?? new Set<string>();
      const freeRooms = roomOptions.filter((room) => !occupied.has(room.toLowerCase()));

      return {
        day,
        periodId: period.id,
        periodLabel: period.label,
        time: `${period.startTime} - ${period.endTime}`,
        freeRooms,
      };
    }),
  );
}

function TimetableMatrix({
  title,
  description,
  periods,
  entries,
  renderCell,
  actions,
}: {
  title: string;
  description: string;
  periods: TimetablePeriod[];
  entries: TimetableEntry[];
  renderCell: (entries: TimetableEntry[]) => ReactNode;
  actions?: ReactNode;
}) {
  const entryMap = timetableCellMap(entries);

  return (
    <article className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Timetable Grid</p>
          <h3>{title}</h3>
        </div>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </div>
      <p className="muted">{description}</p>
      <div className="table-wrap">
        <table className="data-table timetable-table">
          <thead>
            <tr>
              <th>Period</th>
              {TIMETABLE_DAYS.map((day) => (
                <th key={day}>{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period.id}>
                <td>
                  <strong>{period.label}</strong>
                  <p className="muted">
                    {period.startTime} - {period.endTime}
                  </p>
                </td>
                {TIMETABLE_DAYS.map((day) => (
                  <td key={`${day}-${period.id}`} className="timetable-cell">
                    {renderCell(entryMap.get(`${day}-${period.id}`) ?? [])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function TimetableCellCards({
  entries,
  emptyLabel,
}: {
  entries: TimetableEntry[];
  emptyLabel: string;
}) {
  if (entries.length === 0) {
    return <span className="muted">{emptyLabel}</span>;
  }

  return (
    <div className="stack-list compact">
      {entries.map((entry) => (
        <div key={entry.id} className="timetable-card">
          <strong>{entry.subjectName}</strong>
          <p>{entry.teacherName}</p>
          <p className="muted">
            {entry.baseClassName || entry.className} - {entry.arm}
            {entry.track ? ` - ${entry.track}` : ""}
          </p>
          {entry.room ? <span className="muted">{entry.room}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function TimetableBoard({
  schoolName,
  timetable,
  currentAccount,
  classOfferings,
  staffAccounts,
  canViewAll,
  canEdit,
}: TimetableBoardProps) {
  const [localTimetable, setLocalTimetable] = useState(timetable);
  const [feedback, setFeedback] = useState(
    "Download the timetable template or export the live timetable, then upload or edit slots here before publishing to teacher and student views.",
  );
  const [busy, setBusy] = useState<"save" | "publish" | "parse" | null>(null);
  const [scopeMode, setScopeMode] = useState<"class" | "teacher">("class");
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [selectedClassName, setSelectedClassName] = useState(
    classOfferings[0]?.className ?? timetable.entries[0]?.className ?? "",
  );
  const [selectedTeacherName, setSelectedTeacherName] = useState(
    currentAccount.fullName || timetable.entries[0]?.teacherName || "",
  );
  const [teacherSearch, setTeacherSearch] = useState("");
  const [selectedEditorEntryId, setSelectedEditorEntryId] = useState(timetable.entries[0]?.id ?? "");
  const [editorDraft, setEditorDraft] = useState<TimetableEditorDraft | null>(null);
  const deferredTeacherSearch = useDeferredValue(teacherSearch.trim().toLowerCase());

  const myEntries = useMemo(
    () =>
      localTimetable.entries.filter(
        (entry) =>
          entry.teacherAccountId === currentAccount.id || entry.teacherName === currentAccount.fullName,
      ),
    [currentAccount.fullName, currentAccount.id, localTimetable.entries],
  );
  const selectedClassEntries = useMemo(
    () => localTimetable.entries.filter((entry) => entry.className === selectedClassName),
    [localTimetable.entries, selectedClassName],
  );
  const selectedTeacherEntries = useMemo(
    () =>
      localTimetable.entries.filter(
        (entry) =>
          entry.teacherName === selectedTeacherName || entry.teacherAccountId === selectedTeacherName,
      ),
    [localTimetable.entries, selectedTeacherName],
  );
  const classOptions = useMemo(
    () =>
      classOfferings
        .map((offering) => ({
          value: offering.className,
          label: classOfferingLabel(offering),
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [classOfferings],
  );
  const editableTeacherOptions = useMemo(
    () =>
      uniqueStrings(
        localTimetable.entries
          .map((entry) => entry.teacherName)
          .concat(
            staffAccounts
              .filter((account) => account.status === "active" && TEACHING_ROLES.has(account.role))
              .map((account) => account.fullName),
          ),
      ),
    [localTimetable.entries, staffAccounts],
  );
  const teacherOptions = uniqueStrings(
    localTimetable.entries
      .map((entry) => entry.teacherName)
      .concat(staffAccounts.map((account) => account.fullName))
      .filter((name) =>
        deferredTeacherSearch ? name.toLowerCase().includes(deferredTeacherSearch) : true,
      ),
  );
  const freeTeacherRows = useMemo(
    () => buildFreeTeacherIndex(localTimetable.periods, localTimetable.entries, staffAccounts),
    [localTimetable.entries, localTimetable.periods, staffAccounts],
  );
  const freeRoomRows = useMemo(
    () => buildFreeRoomIndex(localTimetable.periods, localTimetable.entries),
    [localTimetable.entries, localTimetable.periods],
  );
  const published = localTimetable.publishState === "published";
  const selectedScopeEntries = useMemo(
    () => (scopeMode === "class" ? selectedClassEntries : selectedTeacherEntries),
    [scopeMode, selectedClassEntries, selectedTeacherEntries],
  );
  const editableEntries = useMemo(
    () => sortEntriesForEditor(selectedScopeEntries, localTimetable.periods),
    [localTimetable.periods, selectedScopeEntries],
  );
  const selectedEditableEntry = useMemo(
    () => editableEntries.find((entry) => entry.id === selectedEditorEntryId) ?? editableEntries[0] ?? null,
    [editableEntries, selectedEditorEntryId],
  );
  const selectedEditorPeriod = useMemo(
    () =>
      editorDraft
        ? localTimetable.periods.find((period) => period.id === editorDraft.periodId) ?? null
        : null,
    [editorDraft, localTimetable.periods],
  );
  const selectedSlotTeacherRow = useMemo(
    () =>
      editorDraft
        ? freeTeacherRows.find((row) => row.day === editorDraft.day && row.periodId === editorDraft.periodId) ?? null
        : null,
    [editorDraft, freeTeacherRows],
  );
  const selectedSlotRoomRow = useMemo(
    () =>
      editorDraft
        ? freeRoomRows.find((row) => row.day === editorDraft.day && row.periodId === editorDraft.periodId) ?? null
        : null,
    [editorDraft, freeRoomRows],
  );
  const teacherConflict = useMemo(
    () =>
      editorDraft
        ? localTimetable.entries.find(
            (entry) =>
              entry.id !== selectedEditableEntry?.id &&
              entry.day === editorDraft.day &&
              entry.periodId === editorDraft.periodId &&
              entry.teacherName === editorDraft.teacherName,
          ) ?? null
        : null,
    [editorDraft, localTimetable.entries, selectedEditableEntry?.id],
  );
  const roomConflict = useMemo(
    () =>
      editorDraft && editorDraft.room
        ? localTimetable.entries.find(
            (entry) =>
              entry.id !== selectedEditableEntry?.id &&
              entry.day === editorDraft.day &&
              entry.periodId === editorDraft.periodId &&
              (entry.room ?? "").toLowerCase() === editorDraft.room.trim().toLowerCase(),
          ) ?? null
        : null,
    [editorDraft, localTimetable.entries, selectedEditableEntry?.id],
  );

  useEffect(() => {
    if (!editableEntries.some((entry) => entry.id === selectedEditorEntryId)) {
      setSelectedEditorEntryId(editableEntries[0]?.id ?? "");
    }
  }, [editableEntries, selectedEditorEntryId]);

  useEffect(() => {
    if (selectedEditableEntry) {
      setEditorDraft(buildEditorDraft(selectedEditableEntry));
    } else {
      setEditorDraft(null);
    }
  }, [selectedEditableEntry]);

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(csvRowsForTemplate());
    XLSX.utils.book_append_sheet(workbook, worksheet, "Timetable Template");
    XLSX.writeFile(workbook, `school-timetable-template-${localTimetable.session}.xlsx`);
    setFeedback(
      "Downloaded the timetable Excel template. Fill one row per class-arm-track slot, then upload it here.",
    );
  }

  async function handleUpload(file: File | null) {
    if (!file) {
      return;
    }

    setBusy("parse");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      let rows: Record<string, string>[] = [];

      if (extension === "csv") {
        const text = await file.text();
        const [headerLine, ...dataLines] = text.split(/\r?\n/).filter(Boolean);
        const headers = headerLine.split(",").map((value) => value.trim());
        rows = dataLines.map((line) => {
          const values = line.split(",");
          return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
        });
      } else {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
      }

      const periodsMap = new Map<string, TimetablePeriod>();
      const entries: TimetableEntry[] = [];

      rows.forEach((row, index) => {
        const day = String(row["Day"] ?? "").trim() as TimetableDay;
        const periodLabel = String(row["Period Label"] ?? "").trim();
        const startTime = String(row["Start Time"] ?? "").trim();
        const endTime = String(row["End Time"] ?? "").trim();
        const teacherName = String(row["Teacher Name"] ?? "").trim();
        const subjectName = String(row["Subject Name"] ?? "").trim();
        const baseClassName = String(row["Class"] ?? row["Class Name"] ?? "").trim();
        const arm = String(row["Arm"] ?? "").trim();
        const track = String(row["Track"] ?? "").trim();
        const room = String(row["Room"] ?? "").trim();

        if (!day || !periodLabel || !startTime || !endTime || !teacherName || !subjectName || !baseClassName || !arm) {
          return;
        }

        const periodId = `${periodLabel}-${startTime}-${endTime}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
        periodsMap.set(periodId, {
          id: periodId,
          label: periodLabel,
          startTime,
          endTime,
        });

        const className = combineClassArm(baseClassName, arm);

        entries.push({
          id:
            `${day}-${periodId}-${teacherName}-${subjectName}-${baseClassName}-${arm}-${track || "general"}-${index}`
              .replace(/[^a-z0-9]+/gi, "_")
              .toLowerCase(),
          schoolCode: localTimetable.schoolCode,
          day,
          periodId,
          periodLabel,
          startTime,
          endTime,
          teacherName,
          subjectName,
          baseClassName,
          className,
          arm,
          track: track || undefined,
          room: room || undefined,
        });
      });

      setLocalTimetable((current) => ({
        ...current,
        periods: Array.from(periodsMap.values()).sort((left, right) => left.startTime.localeCompare(right.startTime)),
        entries,
        publishState: "draft",
      }));
      setHasLocalChanges(true);
      setFeedback(
        `Loaded ${entries.length} timetable rows from ${file.name}. Review the draft, then publish when you are satisfied.`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not parse the timetable file.");
    } finally {
      setBusy(null);
    }
  }

  async function saveTimetable(publishState: "draft" | "published") {
    setBusy(publishState === "published" ? "publish" : "save");

    try {
      const response = await fetch("/api/timetable", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...localTimetable,
          publishState,
        }),
      });
      const payload = (await response.json()) as { error?: string; timetable?: SchoolTimetable };

      if (!response.ok || !payload.timetable) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalTimetable(payload.timetable);
      setHasLocalChanges(false);
      setFeedback(
        publishState === "published"
          ? "Timetable published. Teachers now see only their own timetable, students see their arm timetable, and timetable-owned subject assignments have been refreshed."
          : "Timetable draft saved. It is stored live but not yet visible to teachers or students.",
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save the timetable right now.");
    } finally {
      setBusy(null);
    }
  }

  function applyManualChange() {
    if (!selectedEditableEntry || !editorDraft || !selectedEditorPeriod) {
      return;
    }

    const matchedTeacher = staffAccounts.find((account) => account.fullName === editorDraft.teacherName);

    setLocalTimetable((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.id === selectedEditableEntry.id
          ? {
              ...entry,
              day: editorDraft.day,
              periodId: selectedEditorPeriod.id,
              periodLabel: selectedEditorPeriod.label,
              startTime: selectedEditorPeriod.startTime,
              endTime: selectedEditorPeriod.endTime,
              teacherName: editorDraft.teacherName,
              teacherAccountId: matchedTeacher?.id,
              room: editorDraft.room.trim() || undefined,
            }
          : entry,
      ),
    }));
    setHasLocalChanges(true);
    setFeedback(
      `${selectedEditableEntry.subjectName} for ${selectedEditableEntry.baseClassName || selectedEditableEntry.className} - ${selectedEditableEntry.arm} is now staged for ${editorDraft.day}, ${selectedEditorPeriod.label}, with ${editorDraft.teacherName}. Save draft or publish to apply it live.`,
    );
  }

  const showSchoolTimetable = canViewAll;
  const showMyTimetable = myEntries.length > 0;
  const publicVisibilityNote = published
    ? hasLocalChanges
      ? "Published timetable is live, but you still have unsaved timetable edits waiting to be saved or republished."
      : "Published timetable is visible on teacher and student views."
    : hasLocalChanges
      ? "This draft includes unsaved timetable edits. Save draft to store them live or publish to release them."
      : "Draft timetable is hidden from teacher and student views until publication.";
  const selectedScopeTitle =
    scopeMode === "class"
      ? classOptions.find((option) => option.value === selectedClassName)?.label || "Selected class arm"
      : selectedTeacherName || "Selected teacher";
  const selectedScopeSubtitle =
    scopeMode === "class"
      ? `Class-arm timetable export for ${selectedScopeTitle}.`
      : `Teacher timetable export for ${selectedTeacherName || "the selected teacher"}.`;

  return (
    <div className="stack-list">
      <section className="surface-card">
        <div className="callout-banner">
          <strong>{feedback}</strong>
          <p className="muted">
            Status: {resultStatusLabel(localTimetable.publishState)}. {publicVisibilityNote}
          </p>
        </div>
      </section>

      {canEdit ? (
        <section className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Timetable Upload</p>
              <h3>Download template, fill, upload, and publish</h3>
            </div>
          </div>
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => void downloadTemplate()}>
              Download Excel template
            </button>
            <TimetableExportActions
              schoolName={schoolName}
              title="Full School Timetable"
              subtitle="Excel export uses the same template columns so you can edit and re-upload."
              fileStem={`${schoolName}-full-timetable`}
              periods={localTimetable.periods}
              pdfEntries={localTimetable.entries}
              excelEntries={localTimetable.entries}
              showExcel
              pdfLabel="Print full timetable"
              excelLabel="Download full timetable Excel"
            />
            <label className="secondary-button">
              <span>{busy === "parse" ? "Reading file..." : "Upload filled timetable"}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
                style={{ display: "none" }}
                disabled={busy === "parse"}
              />
            </label>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void saveTimetable("draft")}
              disabled={busy === "save" || busy === "publish"}
            >
              {busy === "save" ? "Saving..." : "Save draft"}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => void saveTimetable("published")}
              disabled={busy === "save" || busy === "publish"}
            >
              {busy === "publish" ? "Publishing..." : "Publish timetable"}
            </button>
          </div>
          <p className="muted">
            Template columns: Day, Period Label, Start Time, End Time, Teacher Name, Subject Name, Class, Arm, Track, Room.
          </p>
        </section>
      ) : null}

      {showSchoolTimetable ? (
        <>
          <section className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">School Timetable</p>
                <h3>View by class arm or teacher</h3>
              </div>
            </div>
            <div className="button-row">
              <button
                type="button"
                className={scopeMode === "class" ? "primary-button" : "secondary-button"}
                onClick={() => setScopeMode("class")}
              >
                By class arm
              </button>
              <button
                type="button"
                className={scopeMode === "teacher" ? "primary-button" : "secondary-button"}
                onClick={() => setScopeMode("teacher")}
              >
                By teacher
              </button>
            </div>
            <div className="form-grid">
              {scopeMode === "class" ? (
                <label>
                  <span>Class arm</span>
                  <select value={selectedClassName} onChange={(event) => setSelectedClassName(event.target.value)}>
                    {classOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label>
                    <span>Search teacher</span>
                    <input value={teacherSearch} onChange={(event) => setTeacherSearch(event.target.value)} />
                  </label>
                  <label>
                    <span>Teacher</span>
                    <select value={selectedTeacherName} onChange={(event) => setSelectedTeacherName(event.target.value)}>
                      {teacherOptions.map((teacherName) => (
                        <option key={teacherName} value={teacherName}>
                          {teacherName}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>
          </section>

          {scopeMode === "class" ? (
            <TimetableMatrix
              title={selectedScopeTitle}
              description="Columns are days, rows are periods with timing. Multiple cards in one cell mean concurrent tracks or split groups."
              periods={localTimetable.periods}
              entries={selectedClassEntries}
              renderCell={(entries) => <TimetableCellCards entries={entries} emptyLabel="Free" />}
              actions={
                <TimetableExportActions
                  schoolName={schoolName}
                  title={`${selectedScopeTitle} Timetable`}
                  subtitle={selectedScopeSubtitle}
                  fileStem={`${schoolName}-${selectedScopeTitle}-timetable`}
                  periods={localTimetable.periods}
                  pdfEntries={selectedScopeEntries}
                  excelEntries={localTimetable.entries}
                  showExcel={canEdit}
                  excelLabel="Download full timetable Excel"
                />
              }
            />
          ) : (
            <TimetableMatrix
              title={selectedScopeTitle}
              description="Teacher view of the published or draft school timetable."
              periods={localTimetable.periods}
              entries={selectedTeacherEntries}
              renderCell={(entries) => <TimetableCellCards entries={entries} emptyLabel="Free" />}
              actions={
                <TimetableExportActions
                  schoolName={schoolName}
                  title={`${selectedScopeTitle} Timetable`}
                  subtitle={selectedScopeSubtitle}
                  fileStem={`${schoolName}-${selectedScopeTitle}-timetable`}
                  periods={localTimetable.periods}
                  pdfEntries={selectedScopeEntries}
                  excelEntries={localTimetable.entries}
                  showExcel={canEdit}
                  excelLabel="Download full timetable Excel"
                />
              }
            />
          )}

          {canEdit ? (
            <section className="grid-layout two-wide">
              <article className="surface-card">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Manual Slot Editor</p>
                    <h3>Pick a subject row and move it manually</h3>
                  </div>
                  <span className="status-pill status-approved">{editableEntries.length} visible rows</span>
                </div>
                <div className="callout-banner">
                  <strong>Move a subject to a new slot, reallocate the teacher, and adjust the room without re-uploading the sheet.</strong>
                  <p className="muted">The editor follows the current class or teacher filter above, and the changes stay local until you save draft or publish.</p>
                </div>
                {editableEntries.length > 0 ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th>Class</th>
                          <th>Current Slot</th>
                          <th>Teacher</th>
                          <th>Room</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editableEntries.map((entry) => (
                          <tr key={entry.id} className={selectedEditableEntry?.id === entry.id ? "selected-row" : undefined}>
                            <td>
                              <button
                                type="button"
                                className="row-selector"
                                onClick={() => setSelectedEditorEntryId(entry.id)}
                              >
                                {entry.subjectName}
                              </button>
                              {entry.track ? <span className="mini-note">{entry.track}</span> : null}
                            </td>
                            <td>
                              <strong>{entry.baseClassName || entry.className}</strong>
                              <span className="mini-note">{entry.arm}</span>
                            </td>
                            <td>
                              <strong>{entry.day}</strong>
                              <span className="mini-note">{entry.periodLabel} ({entry.startTime} - {entry.endTime})</span>
                            </td>
                            <td>{entry.teacherName}</td>
                            <td>{entry.room ?? "No room"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flow-step">
                    <strong>No timetable rows match the current filter.</strong>
                    <p>Switch the class or teacher filter above to choose another timetable slice to edit.</p>
                  </div>
                )}
              </article>

              <article className="surface-card">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Reallocate Row</p>
                    <h3>{selectedEditableEntry ? selectedEditableEntry.subjectName : "Select a row to edit"}</h3>
                  </div>
                </div>
                {selectedEditableEntry && editorDraft ? (
                  <>
                    <div className="inline-metrics">
                      <div>
                        <span>Class arm</span>
                        <strong>
                          {selectedEditableEntry.baseClassName || selectedEditableEntry.className} - {selectedEditableEntry.arm}
                        </strong>
                      </div>
                      <div>
                        <span>Current slot</span>
                        <strong>{selectedEditableEntry.day} / {selectedEditableEntry.periodLabel}</strong>
                      </div>
                      <div>
                        <span>Target time</span>
                        <strong>
                          {selectedEditorPeriod
                            ? `${selectedEditorPeriod.startTime} - ${selectedEditorPeriod.endTime}`
                            : "Choose a period"}
                        </strong>
                      </div>
                    </div>

                    <div className="form-grid">
                      <label>
                        <span>Day</span>
                        <select
                          value={editorDraft.day}
                          onChange={(event) =>
                            setEditorDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    day: event.target.value as TimetableDay,
                                  }
                                : current,
                            )
                          }
                        >
                          {TIMETABLE_DAYS.map((day) => (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>Period</span>
                        <select
                          value={editorDraft.periodId}
                          onChange={(event) =>
                            setEditorDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    periodId: event.target.value,
                                  }
                                : current,
                            )
                          }
                        >
                          {localTimetable.periods.map((period) => (
                            <option key={period.id} value={period.id}>
                              {period.label} ({period.startTime} - {period.endTime})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>Teacher</span>
                        <select
                          value={editorDraft.teacherName}
                          onChange={(event) =>
                            setEditorDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    teacherName: event.target.value,
                                  }
                                : current,
                            )
                          }
                        >
                          {editableTeacherOptions.map((teacherName) => (
                            <option key={teacherName} value={teacherName}>
                              {teacherName}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>Room</span>
                        <input
                          value={editorDraft.room}
                          onChange={(event) =>
                            setEditorDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    room: event.target.value,
                                  }
                                : current,
                            )
                          }
                          placeholder="Room / Lab / Hall"
                        />
                      </label>
                    </div>

                    <div className={teacherConflict || roomConflict ? "callout-banner warning" : "callout-banner"}>
                      <strong>
                        {teacherConflict
                          ? `${editorDraft.teacherName} is already assigned to ${teacherConflict.subjectName} in this target slot.`
                          : roomConflict
                            ? `${editorDraft.room || "This room"} is already used by ${roomConflict.subjectName} in this target slot.`
                            : "Selected slot is clear for the teacher and room you picked."}
                      </strong>
                      <p className="muted">
                        Free teachers here: {selectedSlotTeacherRow?.freeTeachers.join(", ") || "None recorded"}.
                        {" "}Free rooms here: {selectedSlotRoomRow?.freeRooms.join(", ") || "None recorded"}.
                      </p>
                    </div>

                    <div className="button-row">
                      <button type="button" className="primary-button" onClick={applyManualChange}>
                        Apply local slot change
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setEditorDraft(buildEditorDraft(selectedEditableEntry))}
                      >
                        Reset row
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flow-step">
                    <strong>Select a timetable row first.</strong>
                    <p>The selected subject slot will open here for manual movement and teacher reallocation.</p>
                  </div>
                )}
              </article>
            </section>
          ) : null}

          <section className="grid-layout two-wide">
            <article className="surface-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Free Teachers by Slot</p>
                  <h3>Teachers not assigned in each period</h3>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Period</th>
                      <th>Time</th>
                      <th>Available Teachers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freeTeacherRows.map((row) => (
                      <tr key={`${row.day}-${row.periodId}`}>
                        <td>{row.day}</td>
                        <td>{row.periodLabel}</td>
                        <td>{row.time}</td>
                        <td>{row.freeTeachers.join(", ") || "None free"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="surface-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Free Rooms by Slot</p>
                  <h3>Rooms not occupied in each period</h3>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Period</th>
                      <th>Time</th>
                      <th>Available Rooms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freeRoomRows.map((row) => (
                      <tr key={`${row.day}-${row.periodId}`}>
                        <td>{row.day}</td>
                        <td>{row.periodLabel}</td>
                        <td>{row.time}</td>
                        <td>{row.freeRooms.join(", ") || "No free rooms recorded"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        </>
      ) : null}

      {showMyTimetable ? (
        <TimetableMatrix
          title="My Timetable"
          description="Only your own timetable is shown here."
          periods={localTimetable.periods}
          entries={published || canViewAll ? myEntries : []}
          renderCell={(entries) => (
            <TimetableCellCards
              entries={entries}
              emptyLabel={published || canViewAll ? "Free" : "Awaiting publication"}
            />
          )}
          actions={
            <TimetableExportActions
              schoolName={schoolName}
              title="My Timetable"
              subtitle={`Teacher timetable export for ${currentAccount.fullName}.`}
              fileStem={`${schoolName}-${currentAccount.fullName}-timetable`}
              periods={localTimetable.periods}
              pdfEntries={published || canViewAll ? myEntries : []}
            />
          }
        />
      ) : null}

      {!showSchoolTimetable && !showMyTimetable ? (
        <section className="surface-card">
          <div className="flow-step">
            <strong>No timetable is available for this account yet.</strong>
            <p>
              {published
                ? "No published timetable row currently matches this account."
                : "The school timetable is still in draft mode and has not been published to teachers yet."}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
