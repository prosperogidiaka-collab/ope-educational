"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ReportSheetView } from "@/components/report-sheet-view";
import { getScoreValue, ordinal, resultStatusLabel } from "@/lib/calculations";
import {
  buildResultSheetDraft,
  mergeResultSheetDraft,
  type ResultSheetDraftStore,
} from "@/lib/report-sheet";
import { buildShortVerificationPath } from "@/lib/short-links";
import {
  releaseStateLabel,
  type ReviewDecision,
  type ReviewDecisionStore,
  type ReviewReleaseState,
} from "@/lib/review-decisions";
import type { TeacherScoreSheetDraft, TeacherScoreSheetStore } from "@/lib/teacher-scores";
import type {
  AcademicConfig,
  ComputedSubjectScore,
  ResultTemplateSchema,
  SchoolProfile,
  ScoreComponentRule,
  StudentSummary,
  Subject,
} from "@/lib/types";

type ReviewView = "subject" | "student" | "template";

const REVIEWER_ROLES = [
  "School Admin",
  "HOD",
  "Assigned class teacher",
  "Assigned subject teacher",
] as const;

interface ClassReviewBoardProps {
  school: SchoolProfile;
  summaries: StudentSummary[];
  subjects: Subject[];
  config: AcademicConfig;
  subjectSheets: TeacherScoreSheetStore;
  reviewDecisions: ReviewDecisionStore;
  reportOverrides: ResultSheetDraftStore;
  templateSchema: ResultTemplateSchema;
}

function renderComponentValue(entry: ComputedSubjectScore, componentKey: string) {
  const value = getScoreValue(entry, componentKey);
  return value === null ? "-" : value;
}

function caExamGap(entry: ComputedSubjectScore, componentRules: ScoreComponentRule[]) {
  const examComponent =
    componentRules.find((component) => component.key === "exam" || /exam/i.test(component.label)) ??
    componentRules[componentRules.length - 1];
  const caComponents = componentRules.filter((component) => component.key !== examComponent?.key);

  if (!examComponent || caComponents.length === 0) {
    return null;
  }

  const examValue = getScoreValue(entry, examComponent.key);
  const caValues = caComponents.map((component) => getScoreValue(entry, component.key));

  if (examValue === null || caValues.some((value) => value === null)) {
    return null;
  }

  const caWeight = caComponents.reduce((sum, component) => sum + component.weight, 0);
  const caScore = caComponents.reduce((sum, component) => {
    const value = getScoreValue(entry, component.key) ?? 0;
    const normalized = component.maxScore ? value / component.maxScore : 0;
    return sum + normalized * component.weight;
  }, 0);
  const caPercent = caWeight ? (caScore / caWeight) * 100 : 0;
  const examPercent =
    examComponent.maxScore > 0 ? (examValue / examComponent.maxScore) * 100 : 0;

  return Math.round(Math.abs(caPercent - examPercent));
}

function subjectAnomalies(entry: ComputedSubjectScore, componentRules: ScoreComponentRule[]): string[] {
  const flags: string[] = [];

  if (entry.isIncomplete) {
    flags.push("Incomplete — a component score is still missing");
  }

  if (entry.total > 100) {
    flags.push("Total exceeds 100");
  }

  if (!entry.isIncomplete && entry.classAverage > 0) {
    const delta = Math.round(Math.abs(entry.total - entry.classAverage));
    if (delta >= 25) {
      flags.push(
        `${entry.total > entry.classAverage ? "Far above" : "Far below"} class average (${entry.classAverage}%, gap ${delta})`,
      );
    }
  }

  const gap = caExamGap(entry, componentRules);
  if (gap !== null && gap >= 35) {
    flags.push(`Large gap between CA and exam strength (${gap}%)`);
  }

  return flags;
}

function studentAnomalies(summary: StudentSummary, componentRules: ScoreComponentRule[]): string[] {
  const flags = [...summary.anomalies];

  if (!summary.eligibleForPosition) {
    flags.push("Not eligible for class position with current entries");
  }

  summary.computedSubjects.forEach((entry) => {
    subjectAnomalies(entry, componentRules).forEach((flag) => flags.push(`${entry.subjectName}: ${flag}`));
  });

  const trend = summary.bundle.student.trend;
  if (trend.length >= 1) {
    const last = trend[trend.length - 1].average;
    if (Math.abs(summary.weightedAverage - last) >= 12) {
      flags.push(
        `Current weighted average (${summary.weightedAverage}%) differs sharply from the recorded trend (${last}%)`,
      );
    }
  }

  return Array.from(new Set(flags));
}

export function ClassReviewBoard({
  school,
  summaries,
  subjects,
  config,
  subjectSheets,
  reviewDecisions,
  reportOverrides,
  templateSchema,
}: ClassReviewBoardProps) {
  const componentRules = config.scoreComponents;
  const relevantSubjects = useMemo(
    () => subjects.filter((subject) => summaries.some((summary) => summary.bundle.student.registeredSubjectIds.includes(subject.id))),
    [subjects, summaries],
  );

  const classStats = useMemo(() => {
    const total = summaries.length;
    const ranked = summaries.filter((summary) => summary.position > 0);
    const complete = summaries.filter((summary) => summary.incompleteSubjects === 0);
    const passed = complete.filter((summary) => summary.weightedAverage >= 40).length;
    const classAverage = complete.length
      ? Number((complete.reduce((sum, summary) => sum + summary.weightedAverage, 0) / complete.length).toFixed(2))
      : 0;
    const flagged = summaries.filter((summary) => studentAnomalies(summary, config.scoreComponents).length > 0).length;
    const distribution = new Map<string, { count: number; color: string }>();
    summaries.forEach((summary) => {
      const key = summary.incompleteSubjects > 0 ? "Incomplete" : summary.overallGrade.label;
      const color = summary.incompleteSubjects > 0 ? "#b21e4b" : summary.overallGrade.color;
      const entry = distribution.get(key) ?? { count: 0, color };
      entry.count += 1;
      distribution.set(key, entry);
    });
    const topStudent = [...ranked].sort((left, right) => left.position - right.position)[0];

    return {
      total,
      rankedCount: ranked.length,
      passRate: complete.length ? Math.round((passed / complete.length) * 100) : 0,
      classAverage,
      flagged,
      topStudent,
      distribution: Array.from(distribution.entries()).map(([label, value]) => ({ label, ...value })),
      published: Object.values(reviewDecisions).filter((decision) => decision.releaseState === "published").length,
    };
  }, [config.scoreComponents, summaries, reviewDecisions]);

  const [view, setView] = useState<ReviewView>("subject");
  const [reviewerRole, setReviewerRole] = useState<(typeof REVIEWER_ROLES)[number]>("School Admin");
  const reviewerName =
    reviewerRole === "School Admin"
      ? school.schoolAdminName ?? "School Admin"
      : reviewerRole === "HOD"
        ? "Subject HOD"
        : reviewerRole === "Assigned class teacher"
          ? "Assigned class teacher"
          : "Assigned subject teacher";

  const [selectedSubjectId, setSelectedSubjectId] = useState(relevantSubjects[0]?.id ?? "");
  const [selectedRegNumber, setSelectedRegNumber] = useState(summaries[0]?.bundle.student.regNumber ?? "");
  const [previewRegNumber, setPreviewRegNumber] = useState<string | null>(null);

  const [decisions, setDecisions] = useState<ReviewDecisionStore>(reviewDecisions);
  const [sheetStates, setSheetStates] = useState<TeacherScoreSheetStore>(subjectSheets);
  const [reviewNote, setReviewNote] = useState("");
  const [feedback, setFeedback] = useState(
    "Pick a subject, a student, or the template view to look for inconsistencies, then record a review decision.",
  );
  const [busy, setBusy] = useState(false);

  const selectedSubject = relevantSubjects.find((subject) => subject.id === selectedSubjectId) ?? relevantSubjects[0];
  const selectedSubjectClassName = selectedSubject ? sheetStates[selectedSubject.id]?.className ?? selectedSubject.className : "class";
  const selectedSummary =
    summaries.find((summary) => summary.bundle.student.regNumber === selectedRegNumber) ?? summaries[0];
  const previewSummary = summaries.find((summary) => summary.bundle.student.regNumber === previewRegNumber) ?? null;

  function buildSheetDraftFor(summary: StudentSummary) {
    const base = buildResultSheetDraft(school, summary, {
      classSize: summaries.length,
      academicConfig: config,
    });
    return mergeResultSheetDraft(base, reportOverrides[summary.bundle.student.regNumber] ?? null);
  }

  function decisionFor(regNumber: string): ReviewDecision | null {
    return decisions[regNumber] ?? null;
  }

  async function recordStudentDecision(regNumber: string, releaseState: ReviewReleaseState) {
    const summary = summaries.find((item) => item.bundle.student.regNumber === regNumber);
    if (!summary) {
      return;
    }

    setBusy(true);
    const decision: ReviewDecision = {
      regNumber,
      releaseState,
      note: reviewNote.trim() || `${releaseStateLabel(releaseState)} by ${reviewerName}.`,
      decidedBy: reviewerName,
      decidedByRole: reviewerRole,
      decidedAt: new Date().toISOString(),
      stage: reviewerRole === "School Admin" ? "School Admin Approval" : reviewerRole === "HOD" ? "HOD Review" : "Class Review",
    };

    try {
      const response = await fetch("/api/review-decisions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(decision),
      });

      if (!response.ok) {
        throw new Error(String(response.status));
      }

      const data = (await response.json()) as { decision: ReviewDecision };
      setDecisions((current) => ({ ...current, [regNumber]: data.decision }));
      setReviewNote("");
      setFeedback(
        releaseState === "published"
          ? `${summary.bundle.student.fullName}'s result is now published — students can open it with the result token.`
          : `Recorded "${releaseStateLabel(releaseState)}" for ${summary.bundle.student.fullName}. The portal and dashboards now reflect this.`,
      );
    } catch {
      setFeedback("Could not save that review decision. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resetStudentDecision(regNumber: string) {
    const summary = summaries.find((item) => item.bundle.student.regNumber === regNumber);
    setBusy(true);

    try {
      const response = await fetch(`/api/review-decisions?regNumber=${encodeURIComponent(regNumber)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(String(response.status));
      }

      setDecisions((current) => {
        const next = { ...current };
        delete next[regNumber];
        return next;
      });
      setFeedback(`Cleared the review decision for ${summary?.bundle.student.fullName ?? regNumber}.`);
    } catch {
      setFeedback("Could not clear that review decision. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function updateSubjectSheet(assignmentId: string, nextStatus: TeacherScoreSheetDraft["sheetStatus"]) {
    const sheet = sheetStates[assignmentId];
    if (!sheet) {
      setFeedback("There is no teacher sheet on file for this subject yet — ask the teacher to submit it from the Teacher Desk first.");
      return;
    }

    setBusy(true);
    const draft: TeacherScoreSheetDraft = {
      ...sheet,
      sheetStatus: nextStatus,
      reviewNote: reviewNote.trim() || sheet.reviewNote,
      reviewedBy: reviewerName,
      reviewedByRole: reviewerRole,
      reviewedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch(`/api/teacher-scores/${encodeURIComponent(assignmentId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      if (!response.ok) {
        throw new Error(String(response.status));
      }

      const data = (await response.json()) as { sheet: TeacherScoreSheetDraft };
      setSheetStates((current) => ({ ...current, [assignmentId]: data.sheet }));
      setReviewNote("");
      setFeedback(
        nextStatus === "corrections_requested"
          ? `Sent the ${data.sheet.subjectName} sheet back to ${data.sheet.teacherName} with a correction note.`
          : `Marked the ${data.sheet.subjectName} sheet as reviewed and consistent.`,
      );
    } catch {
      setFeedback("Could not update the subject sheet. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function StatePill({ regNumber }: { regNumber: string }) {
    const decision = decisionFor(regNumber);
    if (!decision) {
      return <span className="status-pill status-under_review">In review</span>;
    }
    const tone =
      decision.releaseState === "published" || decision.releaseState === "approved"
        ? "status-approved"
        : decision.releaseState === "corrections"
          ? "status-corrections_requested"
          : "status-under_review";
    return <span className={`status-pill ${tone}`}>{releaseStateLabel(decision.releaseState)}</span>;
  }

  return (
    <div className="stack-list">
      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Class Review</p>
            <h3>Cross-check {selectedSubjectClassName} results before release</h3>
          </div>
          <label className="inline-select">
            <span>Reviewing as</span>
            <select value={reviewerRole} onChange={(event) => setReviewerRole(event.target.value as (typeof REVIEWER_ROLES)[number])}>
              {REVIEWER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="inline-metrics">
          <div>
            <span>Students</span>
            <strong>{classStats.total}</strong>
          </div>
          <div>
            <span>Ranked</span>
            <strong>{classStats.rankedCount}</strong>
          </div>
          <div>
            <span>Class average</span>
            <strong>{classStats.classAverage}%</strong>
          </div>
          <div>
            <span>Pass rate</span>
            <strong>{classStats.passRate}%</strong>
          </div>
          <div>
            <span>Top of class</span>
            <strong>{classStats.topStudent ? classStats.topStudent.bundle.student.fullName.split(" ")[0] : "—"}</strong>
          </div>
          <div>
            <span>Needs attention</span>
            <strong>{classStats.flagged}</strong>
          </div>
          <div>
            <span>Published</span>
            <strong>{classStats.published} / {classStats.total}</strong>
          </div>
        </div>

        <div className="grade-distribution">
          {classStats.distribution.map((entry) => (
            <div key={entry.label} className="grade-distribution-row">
              <span className="grade-distribution-label" style={{ color: entry.color }}>{entry.label}</span>
              <div className="distribution-bar">
                <span style={{ width: `${(entry.count / (classStats.total || 1)) * 100}%`, background: entry.color }} />
              </div>
              <span className="grade-distribution-count">{entry.count}</span>
            </div>
          ))}
        </div>

        <div className="button-row review-tabs">
          <button
            type="button"
            className={view === "subject" ? "primary-button" : "secondary-button"}
            onClick={() => setView("subject")}
          >
            By subject
          </button>
          <button
            type="button"
            className={view === "student" ? "primary-button" : "secondary-button"}
            onClick={() => setView("student")}
          >
            By student
          </button>
          <button
            type="button"
            className={view === "template" ? "primary-button" : "secondary-button"}
            onClick={() => setView("template")}
          >
            By template
          </button>
          <Link href="/dashboard/broadsheet" className="secondary-button" target="_blank">
            Open broadsheet
          </Link>
        </div>

        <div className="callout-banner">
          <strong>{feedback}</strong>
          <p className="muted">
            Decisions are saved on the server, so the dashboard, audit desk, report editor, and the student portal all
            stay in sync.{busy ? " Saving…" : ""}
          </p>
        </div>

        <label className="review-note-field">
          <span>Review note (attached to your next decision)</span>
          <textarea
            value={reviewNote}
            maxLength={240}
            placeholder="e.g. Re-check Chemistry exam totals against the marked scripts; entry looks far above the class average."
            onChange={(event) => setReviewNote(event.target.value)}
          />
        </label>
      </section>

      {view === "subject" && selectedSubject ? (
        <section className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">By Subject</p>
              <h3>{selectedSubject.name} — {selectedSubjectClassName}</h3>
            </div>
            <label className="inline-select">
              <span>Subject</span>
              <select value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)}>
                {relevantSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {(() => {
            const sheet = sheetStates[selectedSubject.id];
            return (
              <div className="callout-banner warning">
                <strong>
                  Teacher sheet: {sheet ? resultStatusLabel(sheet.sheetStatus) : "Not yet submitted by the teacher"}
                </strong>
                <p className="muted">
                  {sheet
                    ? `Last updated by ${sheet.lastEditedBy ?? sheet.teacherName}.${sheet.reviewNote ? ` Reviewer note: ${sheet.reviewNote}` : ""}${sheet.reviewedBy ? ` Reviewed by ${sheet.reviewedBy}.` : ""}`
                    : `${selectedSubject.teacherName} has not uploaded or submitted this sheet from the Teacher Desk yet.`}
                </p>
              </div>
            );
          })()}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reg Number</th>
                  <th>Student</th>
                  {componentRules.map((rule) => (
                    <th key={rule.key}>{rule.label}</th>
                  ))}
                  <th>Total</th>
                  <th>Grade</th>
                  <th>Class Avg.</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((summary) => {
                  const entry = summary.computedSubjects.find((item) => item.subjectId === selectedSubject.id);
                  if (!entry) {
                    return null;
                  }
                  const flags = subjectAnomalies(entry, componentRules);
                  return (
                    <tr key={summary.bundle.student.regNumber} className={flags.length > 0 ? "row-flagged" : ""}>
                      <td>{summary.bundle.student.regNumber}</td>
                      <td>{summary.bundle.student.fullName}</td>
                      {componentRules.map((rule) => (
                        <td key={`${summary.bundle.student.regNumber}-${rule.key}`}>
                          {renderComponentValue(entry, rule.key)}
                        </td>
                      ))}
                      <td>{entry.total}</td>
                      <td>
                        {entry.isIncomplete ? (
                          <span className="status-pill status-corrections_requested">Missing</span>
                        ) : (
                          <span className="grade-badge" style={{ borderColor: entry.grade.color, color: entry.grade.color }}>
                            {entry.grade.label}
                          </span>
                        )}
                      </td>
                      <td>{entry.classAverage}%</td>
                      <td>{flags.length > 0 ? <span className="muted">{flags.join(" | ")}</span> : <span className="muted">OK</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              disabled={busy || !sheetStates[selectedSubject.id]}
              onClick={() => void updateSubjectSheet(selectedSubject.id, "corrections_requested")}
            >
              Send sheet back to teacher
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={busy || !sheetStates[selectedSubject.id]}
              onClick={() => void updateSubjectSheet(selectedSubject.id, "hod_approved")}
            >
              Mark sheet reviewed &amp; consistent
            </button>
          </div>
        </section>
      ) : null}

      {view === "student" && selectedSummary ? (
        <section className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">By Student</p>
              <h3>{selectedSummary.bundle.student.fullName} — {selectedSummary.bundle.student.regNumber}</h3>
            </div>
            <label className="inline-select">
              <span>Student</span>
              <select value={selectedRegNumber} onChange={(event) => setSelectedRegNumber(event.target.value)}>
                {summaries.map((summary) => (
                  <option key={summary.bundle.student.regNumber} value={summary.bundle.student.regNumber}>
                    {summary.bundle.student.fullName} — {summary.bundle.student.regNumber}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="inline-metrics">
            <div>
              <span>Class position</span>
              <strong>{ordinal(selectedSummary.position)}</strong>
            </div>
            <div>
              <span>Weighted average</span>
              <strong>{selectedSummary.weightedAverage}%</strong>
            </div>
            <div>
              <span>Overall grade</span>
              <strong>{selectedSummary.overallGrade.label}</strong>
            </div>
            <div>
              <span>Release state</span>
              <strong><StatePill regNumber={selectedSummary.bundle.student.regNumber} /></strong>
            </div>
          </div>

          {(() => {
            const flags = studentAnomalies(selectedSummary, componentRules);
            return flags.length > 0 ? (
              <div className="callout-banner warning">
                <strong>{flags.length} thing(s) to double-check</strong>
                <ul className="sidebar-points">
                  {flags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="callout-banner">
                <strong>No inconsistencies detected for this student.</strong>
                <p className="muted">All registered subjects are complete and within expected ranges.</p>
              </div>
            );
          })()}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  {componentRules.map((rule) => (
                    <th key={rule.key}>{rule.label}</th>
                  ))}
                  <th>Total</th>
                  <th>Grade</th>
                  <th>Class Avg.</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {selectedSummary.computedSubjects.map((entry) => {
                  const flags = subjectAnomalies(entry, componentRules);
                  return (
                    <tr key={entry.subjectId} className={flags.length > 0 ? "row-flagged" : ""}>
                      <td>{entry.subjectName}</td>
                      {componentRules.map((rule) => (
                        <td key={`${entry.subjectId}-${rule.key}`}>{renderComponentValue(entry, rule.key)}</td>
                      ))}
                      <td>{entry.total}</td>
                      <td>{entry.isIncomplete ? "Incomplete" : entry.grade.label}</td>
                      <td>{entry.classAverage}%</td>
                      <td>{flags.length > 0 ? <span className="muted">{flags.join(" | ")}</span> : <span className="muted">OK</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => setPreviewRegNumber(selectedSummary.bundle.student.regNumber)}>
              Result preview
            </button>
            <Link
              href={`/results/${encodeURIComponent(selectedSummary.bundle.student.regNumber)}?preview=1`}
              className="secondary-button"
              target="_blank"
            >
              Open full preview page
            </Link>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => void recordStudentDecision(selectedSummary.bundle.student.regNumber, "corrections")}>
              Request corrections
            </button>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => void recordStudentDecision(selectedSummary.bundle.student.regNumber, "approved")}>
              Approve for release
            </button>
            <button type="button" className="primary-button" disabled={busy} onClick={() => void recordStudentDecision(selectedSummary.bundle.student.regNumber, "published")}>
              Publish &amp; release token
            </button>
            <button type="button" className="secondary-button" disabled={busy || !decisionFor(selectedSummary.bundle.student.regNumber)} onClick={() => void resetStudentDecision(selectedSummary.bundle.student.regNumber)}>
              Reset decision
            </button>
          </div>
        </section>
      ) : null}

      {view === "template" && selectedSummary ? (
        <section className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">By Template</p>
              <h3>Published view for {selectedSummary.bundle.student.fullName}</h3>
            </div>
            <label className="inline-select">
              <span>Student</span>
              <select value={selectedRegNumber} onChange={(event) => setSelectedRegNumber(event.target.value)}>
                {summaries.map((summary) => (
                  <option key={summary.bundle.student.regNumber} value={summary.bundle.student.regNumber}>
                    {summary.bundle.student.fullName} — {summary.bundle.student.regNumber}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="callout-banner">
            <strong>This is exactly what the student sees once the result is published and opened with their result token.</strong>
            <p className="muted">
              It uses the live report template and any school-admin report edits. <StatePill regNumber={selectedSummary.bundle.student.regNumber} />
            </p>
          </div>

          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => setPreviewRegNumber(selectedSummary.bundle.student.regNumber)}>
              Open as overlay
            </button>
            <Link
              href={`/results/${encodeURIComponent(selectedSummary.bundle.student.regNumber)}?preview=1`}
              className="secondary-button"
              target="_blank"
            >
              Open full preview page
            </Link>
          </div>

          <div className="report-preview-frame">
            <ReportSheetView
              draft={buildSheetDraftFor(selectedSummary)}
              templateSchema={templateSchema}
              verificationHref={buildShortVerificationPath(selectedSummary.bundle.verificationId)}
              showActions={false}
              academicConfig={config}
            />
          </div>
        </section>
      ) : null}

      {previewSummary ? (
        <div
          className="review-preview-overlay no-print"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewRegNumber(null)}
        >
          <div className="review-preview-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="review-preview-bar">
              <div>
                <p className="eyebrow">Result preview</p>
                <strong>{previewSummary.bundle.student.fullName} — {previewSummary.bundle.student.regNumber}</strong>
              </div>
              <div className="button-row">
                <Link
                  href={`/results/${encodeURIComponent(previewSummary.bundle.student.regNumber)}?preview=1`}
                  className="secondary-button"
                  target="_blank"
                >
                  Open full page
                </Link>
                <button type="button" className="primary-button" onClick={() => setPreviewRegNumber(null)}>
                  Close
                </button>
              </div>
            </div>
            <div className="review-preview-body">
              <ReportSheetView
                draft={buildSheetDraftFor(previewSummary)}
                templateSchema={templateSchema}
                verificationHref={buildShortVerificationPath(previewSummary.bundle.verificationId)}
                showActions={false}
                academicConfig={config}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
