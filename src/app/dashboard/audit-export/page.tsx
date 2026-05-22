import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { formatDateOnly } from "@/lib/calculations";
import { getLiveResults } from "@/lib/live-results";

export const dynamic = "force-dynamic";

export default async function AuditExportPage() {
  const { summaries } = await getLiveResults();
  const auditEntries = summaries
    .flatMap((summary) => summary.bundle.auditLog.map((entry) => ({ ...entry, regNumber: summary.bundle.student.regNumber })))
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
  const approvalEntries = summaries.flatMap((summary) => summary.bundle.approvals).length;
  const versionEntries = summaries.flatMap((summary) => summary.bundle.versionHistory).length;

  return (
    <AppShell
      activeHref="/dashboard/audit-export"
      eyebrow="Audit Export"
      title="Audit export and evidence vault"
      description="Bundle score edits, reviewer notes, approval history, and evidence-ready records for internal inspection or external review."
    >
      <section className="metric-grid compact">
        <MetricCard label="Audit entries" value={`${auditEntries.length}`} helper="Recorded actions across live student bundles" />
        <MetricCard label="Approval records" value={`${approvalEntries}`} helper="Review and sign-off history available for export" />
        <MetricCard label="Version events" value={`${versionEntries}`} helper="Tracked result revisions stored with the bundles" />
        <MetricCard label="Students covered" value={`${summaries.length}`} helper="Live records included in the current evidence scope" />
      </section>

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Evidence Pack</p>
            <h3>What belongs in an audit-ready bundle</h3>
          </div>
        </div>
        <div className="card-grid">
          <div className="selection-card">
            <strong>Raw score changes</strong>
            <p>Include who changed a score, when it was changed, and whether the change was a teacher edit or principal override.</p>
          </div>
          <div className="selection-card">
            <strong>Reviewer notes</strong>
            <p>Keep HOD, class review, and principal notes with the same evidence pack so correction reasons stay visible.</p>
          </div>
          <div className="selection-card">
            <strong>Publication controls</strong>
            <p>Store the lock state, release decision, and complaint outcome that led to the final published copy.</p>
          </div>
        </div>
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Recent Activity</p>
              <h3>Latest audit trail entries</h3>
            </div>
          </div>
          <div className="timeline">
            {auditEntries.slice(0, 12).map((entry) => (
              <article key={entry.id} className="timeline-item">
                <strong>{entry.actor}</strong>
                <p>{entry.action} on {entry.target}</p>
                <span>
                  {entry.regNumber} - {formatDateOnly(entry.timestamp)}
                </span>
              </article>
            ))}
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Linked Desks</p>
              <h3>Open the sources behind the evidence trail</h3>
            </div>
          </div>
          <div className="stack-list">
            <Link href="/dashboard/score-review" className="selection-card">
              <strong>Score review</strong>
              <p>Review the student and subject decisions that feed the approval trail.</p>
            </Link>
          <Link href="/dashboard/score-overrides" className="selection-card">
            <strong>Edit entered scores</strong>
            <p>Inspect the desk that records school-admin raw-score corrections.</p>
          </Link>
            <Link href="/dashboard/result-complaints" className="selection-card">
              <strong>Result complaint log</strong>
              <p>Check whether a complaint triggered the evidence pack you are preparing.</p>
            </Link>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
