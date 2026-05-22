"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";

import { formatDate, formatDateOnly, resultStatusLabel } from "@/lib/calculations";
import {
  clearAttendanceSyncRecord,
  isRetryableResponseStatus,
  readAttendanceSyncRecord,
  runSyncWithRetries,
  writeAttendanceSyncRecord,
} from "@/lib/client-sync-queue";
import { buildInlineAttachmentPayload } from "@/lib/file-attachments";
import type {
  StudentAttendancePolicy,
  StudentAttendanceRegister,
  StudentAttendanceStatus,
  StudentProfileRecord,
  StudentReportCategory,
  StudentReportEntry,
} from "@/lib/types";

interface TeacherStudentSupportPanelProps {
  profiles: StudentProfileRecord[];
  reports: StudentReportEntry[];
  attendancePolicy: StudentAttendancePolicy;
  attendanceRegisters: StudentAttendanceRegister[];
  classTeacherArms: string[];
  accessibleClassNames: string[];
  mode?: "both" | "reports" | "attendance";
}

const REPORT_CATEGORY_OPTIONS: StudentReportCategory[] = [
  "general",
  "praise",
  "guidance",
  "discipline",
  "health",
  "result_comment",
];
const ATTENDANCE_STATUSES: StudentAttendanceStatus[] = ["present", "absent", "late", "excused"];
type AttendanceSyncState = "idle" | "syncing" | "synced" | "pending" | "offline";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function categoryLabel(category: StudentReportCategory) {
  return resultStatusLabel(category);
}

function profileSearchText(profile: StudentProfileRecord) {
  return [
    profile.fullName,
    profile.regNumber,
    profile.className,
    profile.arm,
    profile.guardianName,
    profile.fatherName,
    profile.motherName,
  ]
    .join(" ")
    .toLowerCase();
}

function normalizeWhatsappNumber(phone: string) {
  const digits = phone.replace(/\D+/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("234")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `234${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `234${digits}`;
  }

  return digits;
}

function WhatsAppButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="whatsapp-button">
      <span>{label}</span>
    </a>
  );
}

export function TeacherStudentSupportPanel({
  profiles,
  reports,
  attendancePolicy,
  attendanceRegisters,
  classTeacherArms,
  accessibleClassNames,
  mode = "both",
}: TeacherStudentSupportPanelProps) {
  const showReports = mode === "both" || mode === "reports";
  const showAttendance = mode === "both" || mode === "attendance";
  const [localReports, setLocalReports] = useState(reports);
  const [localRegisters, setLocalRegisters] = useState(attendanceRegisters);
  const [selectedRegNumber, setSelectedRegNumber] = useState(profiles[0]?.regNumber ?? "");
  const [studentSearch, setStudentSearch] = useState("");
  const [feedback, setFeedback] = useState(
    showAttendance && showReports
      ? "Use this desk to log student reports inside your own class scope. Class teachers can also mark today's attendance here."
      : showReports
        ? "Use this menu to log student reports inside your teaching scope without mixing it with score entry or attendance."
        : "Use this menu to mark today's class attendance without mixing it with reports or score entry.",
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [attendanceSyncStateByClass, setAttendanceSyncStateByClass] = useState<Record<string, AttendanceSyncState>>({});
  const [dirtyAttendanceClasses, setDirtyAttendanceClasses] = useState<string[]>([]);
  const [reportDraft, setReportDraft] = useState({
    title: "",
    body: "",
    category: "general" as StudentReportCategory,
    subjectName: "",
    showOnPortal: true,
    showOnResultSheet: false,
    praise: false,
    attachmentLabel: "",
    attachmentUrl: "",
    attachmentMimeType: "",
    attachmentSizeBytes: 0,
  });
  const attendanceSyncInFlightRef = useRef<Record<string, boolean>>({});

  const deferredStudentSearch = useDeferredValue(studentSearch.trim().toLowerCase());
  const selectedProfile = profiles.find((profile) => profile.regNumber === selectedRegNumber) ?? profiles[0] ?? null;
  const selectedReports = localReports
    .filter((report) => report.regNumber === selectedRegNumber)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  const visibleProfiles = profiles.filter((profile) =>
    deferredStudentSearch ? profileSearchText(profile).includes(deferredStudentSearch) : true,
  );
  const attendanceDate = todayIsoDate();

  function parentWhatsappHref(parentName: string, phone: string, profile: StudentProfileRecord) {
    const normalizedPhone = normalizeWhatsappNumber(phone);

    if (!normalizedPhone) {
      return "#";
    }

    const todayRegister = localRegisters.find(
      (register) => register.className === profile.className && register.date === attendanceDate,
    );
    const todayStatus = todayRegister?.entries.find((entry) => entry.regNumber === profile.regNumber)?.status ?? "present";
    const latestReport = selectedReports[0];
    const lines = [
      `Hello ${parentName},`,
      "",
      `This is an update from your child's teacher.`,
      "",
      `STUDENT`,
      `${profile.fullName}`,
      `${profile.regNumber}`,
      `${profile.className} - ${profile.arm}`,
      "",
      `TODAY'S ATTENDANCE`,
      resultStatusLabel(todayStatus),
      "",
      `LATEST TEACHER NOTE`,
      latestReport ? `${latestReport.title}: ${latestReport.body}` : "No fresh teacher note has been logged yet.",
      "",
      `Please reach out to the school if any follow-up is needed.`,
    ];

    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(lines.join("\n"))}`;
  }

  function findOrCreateRegister(
    className: string,
    sourceRegisters: StudentAttendanceRegister[] = localRegisters,
  ) {
    const existing =
      sourceRegisters.find((register) => register.className === className && register.date === attendanceDate) ?? null;

    if (existing) {
      return existing;
    }

    const classProfiles = profiles.filter((profile) => profile.className === className && profile.studentStatus === "active");
    return {
      id: `${className}-${attendanceDate}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase(),
      schoolCode: classProfiles[0]?.schoolCode ?? "",
      className,
      arm: classProfiles[0]?.arm ?? className,
      session: attendancePolicy.session,
      term: attendancePolicy.term,
      date: attendanceDate,
      recordedByName: "Class Teacher",
      updatedAt: `${attendanceDate}T08:00:00.000Z`,
      entries: classProfiles.map((profile) => ({
        regNumber: profile.regNumber,
        studentName: profile.fullName,
        status: "present" as StudentAttendanceStatus,
      })),
    };
  }

  function upsertRegister(
    currentRegisters: StudentAttendanceRegister[],
    nextRegister: StudentAttendanceRegister,
  ) {
    const existingIndex = currentRegisters.findIndex(
      (register) => register.className === nextRegister.className && register.date === nextRegister.date,
    );

    if (existingIndex >= 0) {
      const nextRegisters = [...currentRegisters];
      nextRegisters[existingIndex] = nextRegister;
      return nextRegisters;
    }

    return [nextRegister, ...currentRegisters];
  }

  function buildUpdatedRegisterState(
    currentRegisters: StudentAttendanceRegister[],
    className: string,
    regNumber: string,
    status: StudentAttendanceStatus,
  ) {
    const currentRegister = findOrCreateRegister(className, currentRegisters);
    const nextRegister: StudentAttendanceRegister = {
      ...currentRegister,
      updatedAt: new Date().toISOString(),
      entries: currentRegister.entries.map((entry) =>
        entry.regNumber === regNumber ? { ...entry, status } : entry,
      ),
    };

    return {
      nextRegister,
      nextRegisters: upsertRegister(currentRegisters, nextRegister),
    };
  }

  function updateRegisterEntry(className: string, regNumber: string, status: StudentAttendanceStatus) {
    const nextState = buildUpdatedRegisterState(localRegisters, className, regNumber, status);

    setLocalRegisters(nextState.nextRegisters);

    setAttendanceSyncStateByClass((current) => ({ ...current, [className]: "pending" }));
    setDirtyAttendanceClasses((current) =>
      current.includes(className) ? current : [...current, className],
    );
    void writeAttendanceSyncRecord(nextState.nextRegister);
  }

  async function syncAttendanceRegister(
    register: StudentAttendanceRegister,
    options?: { quiet?: boolean },
  ) {
    const syncKey = `${register.className}:${register.date}`;

    if (attendanceSyncInFlightRef.current[syncKey]) {
      return false;
    }

    attendanceSyncInFlightRef.current[syncKey] = true;
    setAttendanceSyncStateByClass((current) => ({ ...current, [register.className]: "syncing" }));

    const result = await runSyncWithRetries(async () => {
      const response = await fetch(`/api/student-attendance/${encodeURIComponent(register.className)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(register),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; register?: StudentAttendanceRegister }
        | null;

      if (!response.ok || !payload?.register) {
        const error = new Error(payload?.error ?? `Request failed with ${response.status}`) as Error & {
          retryable?: boolean;
        };
        error.retryable = isRetryableResponseStatus(response.status);
        throw error;
      }

      return payload.register;
    });

    attendanceSyncInFlightRef.current[syncKey] = false;

    const syncedRegister = result.value;

    if (result.ok && syncedRegister) {
      const pendingRecord = await readAttendanceSyncRecord(register.className, register.date);

      if (pendingRecord && pendingRecord.updatedAt !== register.updatedAt) {
        setAttendanceSyncStateByClass((current) => ({ ...current, [register.className]: "pending" }));
        void syncAttendanceRegister(pendingRecord.payload, { quiet: true });
        return false;
      }

      await clearAttendanceSyncRecord(register.className, register.date);
      setAttendanceSyncStateByClass((current) => ({ ...current, [register.className]: "synced" }));
      setLocalRegisters((current) => upsertRegister(current, syncedRegister));

      if (!options?.quiet) {
        setFeedback(
          `Saved ${register.className} attendance for ${formatDateOnly(syncedRegister.date)}. The student dashboard and result-sheet attendance totals now read from this register.`,
        );
      }

      return true;
    }

    const message = result.error?.message ?? "Could not save attendance right now.";
    const latestPendingRecord = await readAttendanceSyncRecord(register.className, register.date);
    const pendingRecord =
      latestPendingRecord && latestPendingRecord.updatedAt !== register.updatedAt
        ? latestPendingRecord
        : await writeAttendanceSyncRecord(register, {
            attemptCount: result.attempts,
            lastError: message,
          });

    setAttendanceSyncStateByClass((current) => ({
      ...current,
      [register.className]: "pending",
    }));

    if (latestPendingRecord && latestPendingRecord.updatedAt !== register.updatedAt) {
      void syncAttendanceRegister(latestPendingRecord.payload, { quiet: true });
    }

    if (!options?.quiet) {
      setFeedback(
        result.retryable
          ? `${message} ${register.className} attendance was saved locally at ${formatDate(pendingRecord.updatedAt)} and will retry automatically.`
          : `${message} ${register.className} attendance was saved locally at ${formatDate(pendingRecord.updatedAt)} and is marked as pending.`,
      );
    }
    return false;
  }

  useEffect(() => {
    if (!attendancePolicy.attendanceEnabled || dirtyAttendanceClasses.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      const classesToSync = [...dirtyAttendanceClasses];
      setDirtyAttendanceClasses((current) =>
        current.filter((className) => !classesToSync.includes(className)),
      );

      classesToSync.forEach((className) => {
        const register = findOrCreateRegister(className);
        void syncAttendanceRegister(register, { quiet: true });
      });
    }, 900);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendancePolicy.attendanceEnabled, dirtyAttendanceClasses, localRegisters]);

  useEffect(() => {
    if (!attendancePolicy.attendanceEnabled || classTeacherArms.length === 0) {
      return;
    }

    let cancelled = false;

    async function hydratePendingAttendanceSyncs() {
      const pendingRecords = await Promise.all(
        classTeacherArms.map((className) => readAttendanceSyncRecord(className, attendanceDate)),
      );

      if (cancelled) {
        return;
      }

      const queuedRecords = pendingRecords.filter(Boolean);

      if (queuedRecords.length === 0) {
        return;
      }

      setLocalRegisters((current) =>
        queuedRecords.reduce(
          (nextRegisters, pendingRecord) =>
            pendingRecord ? upsertRegister(nextRegisters, pendingRecord.payload) : nextRegisters,
          current,
        ),
      );
      setAttendanceSyncStateByClass((current) => ({
        ...current,
        ...Object.fromEntries(
          queuedRecords
            .filter((pendingRecord): pendingRecord is NonNullable<typeof pendingRecord> => Boolean(pendingRecord))
            .map((pendingRecord) => [pendingRecord.payload.className, "pending" as const]),
        ),
      }));
      setFeedback(
        queuedRecords.length === 1
          ? "Loaded 1 attendance register saved locally. It will retry automatically when the server is available."
          : `Loaded ${queuedRecords.length} attendance registers saved locally. They will retry automatically when the server is available.`,
      );

      queuedRecords.forEach((pendingRecord) => {
        if (!pendingRecord) {
          return;
        }

        void syncAttendanceRegister(pendingRecord.payload, { quiet: true });
      });
    }

    void hydratePendingAttendanceSyncs();

    const retryPendingAttendanceSyncs = () => {
      void hydratePendingAttendanceSyncs();
    };

    window.addEventListener("online", retryPendingAttendanceSyncs);
    return () => {
      cancelled = true;
      window.removeEventListener("online", retryPendingAttendanceSyncs);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceDate, attendancePolicy.attendanceEnabled, classTeacherArms]);

  async function handleAttachmentChange(file: File | null) {
    if (!file) {
      setReportDraft((current) => ({
        ...current,
        attachmentLabel: "",
        attachmentUrl: "",
        attachmentMimeType: "",
        attachmentSizeBytes: 0,
      }));
      return;
    }

    try {
      const payload = await buildInlineAttachmentPayload(file);
      setReportDraft((current) => ({
        ...current,
        attachmentLabel: payload.label,
        attachmentUrl: payload.url,
        attachmentMimeType: payload.mimeType,
        attachmentSizeBytes: payload.sizeBytes,
      }));
      setFeedback(`Attached ${payload.label}. It will be saved with the student report.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not attach that file right now.");
    }
  }

  async function saveReport() {
    if (!selectedProfile) {
      return;
    }

    setBusyKey(`report:${selectedProfile.regNumber}`);

    try {
      const response = await fetch("/api/student-affairs/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regNumber: selectedProfile.regNumber,
          title: reportDraft.title,
          body: reportDraft.body,
          category: reportDraft.category,
          subjectName: reportDraft.subjectName,
          showOnPortal: reportDraft.showOnPortal,
          showOnResultSheet: reportDraft.showOnResultSheet,
          praise: reportDraft.praise,
          attachmentLabel: reportDraft.attachmentLabel,
          attachmentUrl: reportDraft.attachmentUrl,
          attachmentMimeType: reportDraft.attachmentMimeType,
          attachmentSizeBytes: reportDraft.attachmentSizeBytes,
        }),
      });
      const payload = (await response.json()) as { error?: string; report?: StudentReportEntry };

      if (!response.ok || !payload.report) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalReports((current) => [payload.report!, ...current]);
      setReportDraft({
        title: "",
        body: "",
        category: "general",
        subjectName: "",
        showOnPortal: true,
        showOnResultSheet: false,
        praise: false,
        attachmentLabel: "",
        attachmentUrl: "",
        attachmentMimeType: "",
        attachmentSizeBytes: 0,
      });
      setFeedback(
        `Logged a ${categoryLabel(payload.report.category).toLowerCase()} note for ${payload.report.studentName}.`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save the student report right now.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveAttendance(className: string) {
    const register = findOrCreateRegister(className);
    await writeAttendanceSyncRecord(register);
    setAttendanceSyncStateByClass((current) => ({ ...current, [className]: "pending" }));
    setDirtyAttendanceClasses((current) => current.filter((entry) => entry !== className));
    await syncAttendanceRegister(register);
  }

  return (
    <>
      <section className="surface-card">
        <div className="callout-banner">
          <strong>{feedback}</strong>
          <p className="muted">
            {showAttendance && !showReports
              ? `Class-teacher attendance is limited to your assigned arms: ${classTeacherArms.join(", ") || "None yet"}.`
              : `Students visible here are limited to your assigned subject classes or your class-teacher arms: ${accessibleClassNames.join(", ") || "None yet"}.`}
          </p>
        </div>
      </section>

      {showReports ? (
        <section className="grid-layout two-wide">
          <article className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Student Reports</p>
                <h3>Log notes within your teaching scope</h3>
              </div>
            </div>
            <label className="inline-search-field">
              <span>Search students</span>
              <input
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Search by student, reg number, class, or parent"
              />
            </label>
            <div className="stack-list">
              {visibleProfiles.map((profile) => (
                <button
                  key={profile.regNumber}
                  type="button"
                  className={selectedRegNumber === profile.regNumber ? "selection-card selected" : "selection-card"}
                  onClick={() => setSelectedRegNumber(profile.regNumber)}
                >
                  <strong>{profile.fullName}</strong>
                  <p>{profile.className} - {profile.regNumber}</p>
                  <p className="muted">
                    Father: {profile.fatherPhone} | Mother: {profile.motherPhone}
                  </p>
                </button>
              ))}
            </div>
          </article>

          <article className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Report Composer</p>
                <h3>{selectedProfile?.fullName ?? "Student"}</h3>
              </div>
            </div>
            <div className="form-grid">
              <label>
                <span>Title</span>
                <input
                  value={reportDraft.title}
                  onChange={(event) => setReportDraft((current) => ({ ...current, title: event.target.value }))}
                />
              </label>
              <label>
                <span>Category</span>
                <select
                  value={reportDraft.category}
                  onChange={(event) =>
                    setReportDraft((current) => ({
                      ...current,
                      category: event.target.value as StudentReportCategory,
                    }))
                  }
                >
                  {REPORT_CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {categoryLabel(category)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Subject / Desk</span>
                <input
                  value={reportDraft.subjectName}
                  onChange={(event) =>
                    setReportDraft((current) => ({ ...current, subjectName: event.target.value }))
                  }
                  placeholder="Optional subject reference"
                />
              </label>
              <label className="form-span-2">
                <span>Report Body</span>
                <textarea
                  rows={5}
                  value={reportDraft.body}
                  onChange={(event) => setReportDraft((current) => ({ ...current, body: event.target.value }))}
                />
              </label>
              <label className="form-span-2">
                <span>Attachment</span>
                <input
                  type="file"
                  onChange={(event) => void handleAttachmentChange(event.target.files?.[0] ?? null)}
                />
              </label>
              {reportDraft.attachmentLabel ? (
                <div className="attachment-chip">
                  <strong>{reportDraft.attachmentLabel}</strong>
                  <span className="muted">
                    {Math.max(1, Math.round(reportDraft.attachmentSizeBytes / 1024))} KB attached
                  </span>
                </div>
              ) : null}
            </div>
            <div className="button-row">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={reportDraft.showOnPortal}
                  onChange={(event) =>
                    setReportDraft((current) => ({ ...current, showOnPortal: event.target.checked }))
                  }
                />
                <span>Show on student portal</span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={reportDraft.showOnResultSheet}
                  onChange={(event) =>
                    setReportDraft((current) => ({ ...current, showOnResultSheet: event.target.checked }))
                  }
                  disabled={!selectedProfile || !classTeacherArms.includes(selectedProfile.className)}
                />
                <span>Use as class-teacher result comment</span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={reportDraft.praise}
                  onChange={(event) => setReportDraft((current) => ({ ...current, praise: event.target.checked }))}
                />
                <span>Mark as praise</span>
              </label>
              <button
                type="button"
                className="primary-button"
                onClick={() => void saveReport()}
                disabled={!selectedProfile || busyKey === `report:${selectedProfile?.regNumber ?? ""}`}
              >
                {busyKey === `report:${selectedProfile?.regNumber ?? ""}` ? "Saving..." : "Log report"}
              </button>
              {selectedProfile?.fatherPhone ? (
                <WhatsAppButton
                  href={parentWhatsappHref(selectedProfile.fatherName, selectedProfile.fatherPhone, selectedProfile)}
                  label="Share with father"
                />
              ) : null}
              {selectedProfile?.motherPhone ? (
                <WhatsAppButton
                  href={parentWhatsappHref(selectedProfile.motherName, selectedProfile.motherPhone, selectedProfile)}
                  label="Share with mother"
                />
              ) : null}
            </div>

            <div className="timeline">
              {selectedReports.length > 0 ? (
                selectedReports.map((report) => (
                  <article key={report.id} className="timeline-item">
                    <strong>{report.title}</strong>
                    <p>{report.body}</p>
                    <span>
                      {report.authorName} - {categoryLabel(report.category)} - {formatDate(report.updatedAt)}
                    </span>
                    {report.attachmentLabel && report.attachmentUrl ? (
                      <p className="muted">
                        <a href={report.attachmentUrl} download={report.attachmentLabel} className="inline-link">
                          Open attachment: {report.attachmentLabel}
                        </a>
                      </p>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="flow-step">
                  <strong>No note logged for this student yet.</strong>
                  <p>Your student reports for this learner will appear here once submitted.</p>
                </div>
              )}
            </div>
          </article>
        </section>
      ) : null}

      {showAttendance && classTeacherArms.length > 0 ? (
        <section className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Class Teacher Attendance</p>
              <h3>Mark today&apos;s attendance by class</h3>
            </div>
            <span className={`status-pill ${attendancePolicy.attendanceEnabled ? "status-approved" : "status-under_review"}`}>
              {attendancePolicy.attendanceEnabled ? "Attendance active" : "Attendance paused"}
            </span>
          </div>
          {attendancePolicy.attendanceEnabled ? (
            <div className="stack-list">
              {classTeacherArms.map((className) => {
                const register = findOrCreateRegister(className);
                const attendanceSyncState = attendanceSyncStateByClass[className] ?? "idle";

                return (
                  <article key={className} className="surface-card inset-card">
                    <div className="section-head">
                      <div>
                        <p className="eyebrow">{className}</p>
                        <h3>{formatDateOnly(register.date)}</h3>
                      </div>
                      <div className="button-row">
                        <span
                          className={`status-pill ${
                            attendanceSyncState === "synced"
                              ? "status-approved"
                              : attendanceSyncState === "pending"
                                ? "status-pending"
                                : attendanceSyncState === "offline"
                                  ? "status-corrections_requested"
                                  : "status-under_review"
                          }`}
                        >
                          {attendanceSyncState === "synced"
                            ? "Server synced"
                            : attendanceSyncState === "syncing"
                              ? "Syncing now"
                              : attendanceSyncState === "pending"
                                ? "Pending local sync"
                                : attendanceSyncState === "offline"
                                  ? "Server offline"
                                  : "Ready to sync"}
                        </span>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => void saveAttendance(className)}
                          disabled={attendanceSyncState === "syncing"}
                        >
                          {attendanceSyncState === "syncing" ? "Saving..." : "Save attendance"}
                        </button>
                      </div>
                    </div>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {register.entries.map((entry) => (
                            <tr key={`${register.id}-${entry.regNumber}`}>
                              <td>
                                <strong>{entry.studentName}</strong>
                                <p className="muted">{entry.regNumber}</p>
                              </td>
                              <td>
                                <select
                                  value={entry.status}
                                  onChange={(event) =>
                                    updateRegisterEntry(
                                      className,
                                      entry.regNumber,
                                      event.target.value as StudentAttendanceStatus,
                                    )
                                  }
                                >
                                  {ATTENDANCE_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                      {resultStatusLabel(status)}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flow-step">
              <strong>Term attendance is currently paused for {attendancePolicy.term}.</strong>
              <p>Ask the school admin to activate class attendance for the current term from the Students Affairs attendance desk.</p>
            </div>
          )}
        </section>
      ) : null}

      {showAttendance && classTeacherArms.length === 0 ? (
        <section className="surface-card">
          <div className="flow-step">
            <strong>No class-teacher arm is attached to this account yet.</strong>
            <p>Attendance is separated into its own menu now, and it will open here once the school admin assigns a class arm to this account.</p>
          </div>
        </section>
      ) : null}
    </>
  );
}
