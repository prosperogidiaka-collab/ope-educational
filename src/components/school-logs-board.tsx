"use client";

import { useDeferredValue, useMemo, useState } from "react";

import { formatDate, formatDateOnly, resultStatusLabel } from "@/lib/calculations";
import { buildInlineAttachmentPayload } from "@/lib/file-attachments";
import type {
  SchoolLogCategory,
  SchoolLogEntry,
  StaffAccount,
  TeacherPortalReportCategory,
  TeacherPortalReportEntry,
} from "@/lib/types";

const SCHOOL_LOG_CATEGORIES: SchoolLogCategory[] = [
  "visitor",
  "daily_report",
  "weekly_report",
  "challenge",
  "progress",
  "incident",
  "general",
];

const TEACHER_REPORT_CATEGORIES: TeacherPortalReportCategory[] = [
  "general",
  "commendation",
  "warning",
  "observation",
  "development",
];

interface SchoolLogsBoardProps {
  schoolLogs: SchoolLogEntry[];
  teacherReports: TeacherPortalReportEntry[];
  teacherAccounts: StaffAccount[];
  canManage: boolean;
}

function searchSchoolLogText(entry: SchoolLogEntry) {
  return [
    entry.title,
    entry.body,
    entry.category,
    entry.logDate,
    entry.reportingWindow ?? "",
    entry.visitorName ?? "",
    entry.visitorPurpose ?? "",
    entry.authorName,
  ]
    .join(" ")
    .toLowerCase();
}

function searchTeacherReportText(entry: TeacherPortalReportEntry) {
  return [
    entry.teacherName,
    entry.title,
    entry.body,
    entry.category,
    entry.authorName,
  ]
    .join(" ")
    .toLowerCase();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function SchoolLogsBoard({
  schoolLogs,
  teacherReports,
  teacherAccounts,
  canManage,
}: SchoolLogsBoardProps) {
  const [localSchoolLogs, setLocalSchoolLogs] = useState(schoolLogs);
  const [localTeacherReports, setLocalTeacherReports] = useState(teacherReports);
  const [feedback, setFeedback] = useState(
    "Use this desk for registrar and leadership records that should stay inside the school operations workflow.",
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [schoolLogSearch, setSchoolLogSearch] = useState("");
  const [teacherReportSearch, setTeacherReportSearch] = useState("");
  const [schoolLogDraft, setSchoolLogDraft] = useState({
    category: "daily_report" as SchoolLogCategory,
    title: "",
    body: "",
    logDate: todayIsoDate(),
    reportingWindow: "Daily",
    visitorName: "",
    visitorPurpose: "",
    attachmentLabel: "",
    attachmentUrl: "",
    attachmentMimeType: "",
    attachmentSizeBytes: 0,
  });
  const [teacherReportDraft, setTeacherReportDraft] = useState({
    teacherAccountId: teacherAccounts[0]?.id ?? "",
    category: "general" as TeacherPortalReportCategory,
    title: "",
    body: "",
    showOnTeacherPortal: true,
    attachmentLabel: "",
    attachmentUrl: "",
    attachmentMimeType: "",
    attachmentSizeBytes: 0,
  });

  const deferredSchoolLogSearch = useDeferredValue(schoolLogSearch.trim().toLowerCase());
  const deferredTeacherReportSearch = useDeferredValue(teacherReportSearch.trim().toLowerCase());
  const visibleSchoolLogs = useMemo(
    () =>
      localSchoolLogs.filter((entry) =>
        deferredSchoolLogSearch ? searchSchoolLogText(entry).includes(deferredSchoolLogSearch) : true,
      ),
    [deferredSchoolLogSearch, localSchoolLogs],
  );
  const visibleTeacherReports = useMemo(
    () =>
      localTeacherReports.filter((entry) =>
        deferredTeacherReportSearch ? searchTeacherReportText(entry).includes(deferredTeacherReportSearch) : true,
      ),
    [deferredTeacherReportSearch, localTeacherReports],
  );

  async function attachFile(
    file: File | null,
    target: "school-log" | "teacher-report",
  ) {
    if (!file) {
      if (target === "school-log") {
        setSchoolLogDraft((current) => ({
          ...current,
          attachmentLabel: "",
          attachmentUrl: "",
          attachmentMimeType: "",
          attachmentSizeBytes: 0,
        }));
      } else {
        setTeacherReportDraft((current) => ({
          ...current,
          attachmentLabel: "",
          attachmentUrl: "",
          attachmentMimeType: "",
          attachmentSizeBytes: 0,
        }));
      }
      return;
    }

    try {
      const payload = await buildInlineAttachmentPayload(file);

      if (target === "school-log") {
        setSchoolLogDraft((current) => ({
          ...current,
          attachmentLabel: payload.label,
          attachmentUrl: payload.url,
          attachmentMimeType: payload.mimeType,
          attachmentSizeBytes: payload.sizeBytes,
        }));
      } else {
        setTeacherReportDraft((current) => ({
          ...current,
          attachmentLabel: payload.label,
          attachmentUrl: payload.url,
          attachmentMimeType: payload.mimeType,
          attachmentSizeBytes: payload.sizeBytes,
        }));
      }

      setFeedback(`Attached ${payload.label}. It will be stored with the saved record.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not attach that file right now.");
    }
  }

  async function saveSchoolLog() {
    setBusyKey("school-log");

    try {
      const response = await fetch("/api/school-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schoolLogDraft),
      });
      const payload = (await response.json()) as { error?: string; entry?: SchoolLogEntry };

      if (!response.ok || !payload.entry) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalSchoolLogs((current) => [payload.entry!, ...current]);
      setSchoolLogDraft({
        category: "daily_report",
        title: "",
        body: "",
        logDate: todayIsoDate(),
        reportingWindow: "Daily",
        visitorName: "",
        visitorPurpose: "",
        attachmentLabel: "",
        attachmentUrl: "",
        attachmentMimeType: "",
        attachmentSizeBytes: 0,
      });
      setFeedback(`${payload.entry.title} has been added to the school operations log.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save the school log right now.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveTeacherReport() {
    setBusyKey("teacher-report");

    try {
      const response = await fetch("/api/teacher-portal-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teacherReportDraft),
      });
      const payload = (await response.json()) as { error?: string; entry?: TeacherPortalReportEntry };

      if (!response.ok || !payload.entry) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalTeacherReports((current) => [payload.entry!, ...current]);
      setTeacherReportDraft((current) => ({
        ...current,
        title: "",
        body: "",
        attachmentLabel: "",
        attachmentUrl: "",
        attachmentMimeType: "",
        attachmentSizeBytes: 0,
      }));
      setFeedback(`${payload.entry.title} has been logged for ${payload.entry.teacherName}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save the teacher report right now.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="stack-list">
      <section className="surface-card">
        <div className="callout-banner">
          <strong>{feedback}</strong>
          <p className="muted">
            School logs stay inside leadership operations, and teacher reports appear on the selected teacher&apos;s dashboard when marked for portal visibility.
          </p>
        </div>
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">School Logs</p>
              <h3>Visitors, challenges, progress, and school reports</h3>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Type</span>
              <select
                value={schoolLogDraft.category}
                onChange={(event) =>
                  setSchoolLogDraft((current) => ({ ...current, category: event.target.value as SchoolLogCategory }))
                }
                disabled={!canManage}
              >
                {SCHOOL_LOG_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {resultStatusLabel(category)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Date</span>
              <input
                type="date"
                value={schoolLogDraft.logDate}
                onChange={(event) => setSchoolLogDraft((current) => ({ ...current, logDate: event.target.value }))}
                disabled={!canManage}
              />
            </label>
            <label className="form-span-2">
              <span>Title</span>
              <input
                value={schoolLogDraft.title}
                onChange={(event) => setSchoolLogDraft((current) => ({ ...current, title: event.target.value }))}
                disabled={!canManage}
              />
            </label>
            <label>
              <span>Reporting Window</span>
              <input
                value={schoolLogDraft.reportingWindow}
                onChange={(event) =>
                  setSchoolLogDraft((current) => ({ ...current, reportingWindow: event.target.value }))
                }
                placeholder="Daily, Weekly, Visitor, or General"
                disabled={!canManage}
              />
            </label>
            {schoolLogDraft.category === "visitor" ? (
              <>
                <label>
                  <span>Visitor Name</span>
                  <input
                    value={schoolLogDraft.visitorName}
                    onChange={(event) =>
                      setSchoolLogDraft((current) => ({ ...current, visitorName: event.target.value }))
                    }
                    disabled={!canManage}
                  />
                </label>
                <label className="form-span-2">
                  <span>Visitor Purpose</span>
                  <input
                    value={schoolLogDraft.visitorPurpose}
                    onChange={(event) =>
                      setSchoolLogDraft((current) => ({ ...current, visitorPurpose: event.target.value }))
                    }
                    disabled={!canManage}
                  />
                </label>
              </>
            ) : null}
            <label className="form-span-2">
              <span>Notes</span>
              <textarea
                rows={5}
                value={schoolLogDraft.body}
                onChange={(event) => setSchoolLogDraft((current) => ({ ...current, body: event.target.value }))}
                disabled={!canManage}
              />
            </label>
            <label className="form-span-2">
              <span>Attachment</span>
              <input
                type="file"
                onChange={(event) => void attachFile(event.target.files?.[0] ?? null, "school-log")}
                disabled={!canManage}
              />
            </label>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              disabled={!canManage || busyKey === "school-log"}
              onClick={() => void saveSchoolLog()}
            >
              {busyKey === "school-log" ? "Saving..." : "Save school log"}
            </button>
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Teacher Reports</p>
              <h3>Log reports that appear on the teacher dashboard</h3>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Teacher</span>
              <select
                value={teacherReportDraft.teacherAccountId}
                onChange={(event) =>
                  setTeacherReportDraft((current) => ({ ...current, teacherAccountId: event.target.value }))
                }
                disabled={!canManage}
              >
                {teacherAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.fullName} - {resultStatusLabel(account.role)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Type</span>
              <select
                value={teacherReportDraft.category}
                onChange={(event) =>
                  setTeacherReportDraft((current) => ({
                    ...current,
                    category: event.target.value as TeacherPortalReportCategory,
                  }))
                }
                disabled={!canManage}
              >
                {TEACHER_REPORT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {resultStatusLabel(category)}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-span-2">
              <span>Title</span>
              <input
                value={teacherReportDraft.title}
                onChange={(event) => setTeacherReportDraft((current) => ({ ...current, title: event.target.value }))}
                disabled={!canManage}
              />
            </label>
            <label className="form-span-2">
              <span>Report Body</span>
              <textarea
                rows={5}
                value={teacherReportDraft.body}
                onChange={(event) => setTeacherReportDraft((current) => ({ ...current, body: event.target.value }))}
                disabled={!canManage}
              />
            </label>
            <label className="form-span-2">
              <span>Attachment</span>
              <input
                type="file"
                onChange={(event) => void attachFile(event.target.files?.[0] ?? null, "teacher-report")}
                disabled={!canManage}
              />
            </label>
          </div>
          <div className="button-row">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={teacherReportDraft.showOnTeacherPortal}
                onChange={(event) =>
                  setTeacherReportDraft((current) => ({ ...current, showOnTeacherPortal: event.target.checked }))
                }
                disabled={!canManage}
              />
              <span>Show on teacher dashboard</span>
            </label>
            <button
              type="button"
              className="primary-button"
              disabled={!canManage || busyKey === "teacher-report"}
              onClick={() => void saveTeacherReport()}
            >
              {busyKey === "teacher-report" ? "Saving..." : "Save teacher report"}
            </button>
          </div>
        </article>
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">School Log Timeline</p>
              <h3>Operations records for leadership follow-up</h3>
            </div>
          </div>
          <label className="inline-search-field">
            <span>Search school logs</span>
            <input
              value={schoolLogSearch}
              onChange={(event) => setSchoolLogSearch(event.target.value)}
              placeholder="Search by title, note, visitor, category, or author"
            />
          </label>
          <div className="timeline">
            {visibleSchoolLogs.map((entry) => (
              <article key={entry.id} className="timeline-item">
                <strong>{entry.title}</strong>
                <p>{entry.body}</p>
                <span>
                  {resultStatusLabel(entry.category)} - {formatDateOnly(entry.logDate)} - {entry.authorName}
                </span>
                {entry.visitorName || entry.visitorPurpose ? (
                  <p className="muted">
                    Visitor: {entry.visitorName ?? "Not stated"} | Purpose: {entry.visitorPurpose ?? "Not stated"}
                  </p>
                ) : null}
                {entry.attachmentLabel && entry.attachmentUrl ? (
                  <p className="muted">
                    <a href={entry.attachmentUrl} download={entry.attachmentLabel} className="inline-link">
                      Open attachment: {entry.attachmentLabel}
                    </a>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Teacher Report Timeline</p>
              <h3>Leadership notes shared with staff accounts</h3>
            </div>
          </div>
          <label className="inline-search-field">
            <span>Search teacher reports</span>
            <input
              value={teacherReportSearch}
              onChange={(event) => setTeacherReportSearch(event.target.value)}
              placeholder="Search by teacher, title, type, or author"
            />
          </label>
          <div className="timeline">
            {visibleTeacherReports.map((entry) => (
              <article key={entry.id} className="timeline-item">
                <strong>{entry.teacherName} - {entry.title}</strong>
                <p>{entry.body}</p>
                <span>
                  {resultStatusLabel(entry.category)} - {entry.authorName} - {formatDate(entry.updatedAt)}
                </span>
                <p className="muted">
                  Teacher dashboard visibility: {entry.showOnTeacherPortal ? "Visible" : "Hidden"}
                </p>
                {entry.attachmentLabel && entry.attachmentUrl ? (
                  <p className="muted">
                    <a href={entry.attachmentUrl} download={entry.attachmentLabel} className="inline-link">
                      Open attachment: {entry.attachmentLabel}
                    </a>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
