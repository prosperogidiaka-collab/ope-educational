import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { AuditBoard } from "@/components/audit-board";
import { formatDate, resultStatusLabel } from "@/lib/calculations";
import { reviewCases, school } from "@/lib/demo-data";
import { getLiveResults } from "@/lib/live-results";
import { releaseStateLabel } from "@/lib/review-decisions";

export const dynamic = "force-dynamic";

export default async function AuditDashboardPage() {
  const { summaries, subjectSheets, reviewDecisions } = await getLiveResults();
  const pendingAuditStudents = summaries.filter((summary) => summary.bundle.status === "corrections_requested");
  const submissions = Object.values(subjectSheets).sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
  const decisions = Object.values(reviewDecisions).sort(
    (left, right) => new Date(right.decidedAt).getTime() - new Date(left.decidedAt).getTime(),
  );

  return (
    <AppShell
      activeHref="/dashboard/audit"
      eyebrow="Audit Desk"
      title="Moderation, anomaly review, and rejection control"
      description="Review outliers, compare submitted versus corrected values, and move sheets cleanly between teacher, HOD, class teacher, bursary, and principal."
    >
      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Live Teacher Submissions</p>
            <h3>Score sheets uploaded or submitted from the Teacher Desk</h3>
          </div>
          <Link href="/dashboard/score-review" className="primary-button">
            Open score review
          </Link>
        </div>
        {submissions.length === 0 ? (
          <p className="muted">
            No teacher has saved a sheet to the server yet. Saved drafts and submissions appear here automatically.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Teacher</th>
                  <th>Rows</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Reviewer note</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sheet) => (
                  <tr key={sheet.assignmentId}>
                    <td>
                      {sheet.subjectName} ({sheet.subjectCode})
                    </td>
                    <td>{sheet.className}</td>
                    <td>{sheet.teacherName}</td>
                    <td>{sheet.rows.length}</td>
                    <td>
                      <span className={`status-pill status-${sheet.sheetStatus}`}>
                        {resultStatusLabel(sheet.sheetStatus)}
                      </span>
                    </td>
                    <td>{formatDate(sheet.updatedAt)}</td>
                    <td>
                      {sheet.reviewNote ? <span className="muted">{sheet.reviewNote}</span> : <span className="muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {decisions.length > 0 ? (
        <section className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Release Decisions</p>
              <h3>Review and publish actions recorded on the Class Review board</h3>
            </div>
          </div>
          <div className="stack-list">
            {decisions.map((decision) => (
              <div key={decision.regNumber} className="approval-card">
                <div>
                  <strong>{decision.regNumber}</strong>
                  <p className="muted">{decision.note}</p>
                </div>
                <div>
                  <span
                    className={`status-pill ${
                      decision.releaseState === "published" || decision.releaseState === "approved"
                        ? "status-approved"
                        : decision.releaseState === "corrections"
                          ? "status-corrections_requested"
                          : "status-under_review"
                    }`}
                  >
                    {releaseStateLabel(decision.releaseState)}
                  </span>
                  <p>
                    {decision.decidedBy} ({decision.decidedByRole}) — {formatDate(decision.decidedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <AuditBoard students={summaries} cases={reviewCases} />

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Current Focus</p>
            <h3>Open exceptions in {school.term}</h3>
          </div>
        </div>
        <div className="stack-list">
          {pendingAuditStudents.length === 0 ? (
            <p className="muted">No sheets are currently flagged for correction.</p>
          ) : (
            pendingAuditStudents.map((student) => (
              <div key={student.bundle.student.regNumber} className="alert-card">
                <strong>{student.bundle.student.fullName}</strong>
                <p className="muted">{student.anomalies.join(" - ") || "Correction still in progress."}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
