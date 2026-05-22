import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { notifications } from "@/lib/demo-data";
import { resultStatusLabel } from "@/lib/calculations";
import { getLiveResults } from "@/lib/live-results";

export const dynamic = "force-dynamic";

export default async function ResultComplaintsPage() {
  const { summaries } = await getLiveResults();
  const complaints = summaries
    .filter((summary) => summary.bundle.unlockRequest)
    .map((summary) => ({
      studentName: summary.bundle.student.fullName,
      regNumber: summary.bundle.student.regNumber,
      request: summary.bundle.unlockRequest!,
    }));
  const pendingCount = complaints.filter((item) => item.request.status === "pending").length;
  const resolvedCount = complaints.length - pendingCount;

  return (
    <AppShell
      activeHref="/dashboard/result-complaints"
      eyebrow="Result Complaint Log"
      title="Result complaint and unlock log"
      description="Track parent or student complaints, controlled unlock requests, and the final correction history without losing accountability."
    >
      <section className="metric-grid compact">
        <MetricCard label="Complaints logged" value={`${complaints.length}`} helper="Requests currently held in the complaint queue" />
        <MetricCard label="Pending" value={`${pendingCount}`} helper="Complaints still waiting for school-admin action" />
        <MetricCard label="Resolved" value={`${resolvedCount}`} helper="Complaints already approved or declined" />
        <MetricCard label="Admin alerts" value={`${notifications.length}`} helper="Latest publication and governance feed items" />
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Complaint Queue</p>
              <h3>Students with controlled unlock or correction requests</h3>
            </div>
          </div>
          <div className="stack-list">
            {complaints.length > 0 ? (
              complaints.map((item) => (
                <div key={item.regNumber} className="alert-card">
                  <strong>{item.studentName}</strong>
                  <p className="muted">{item.regNumber}</p>
                  <p>{item.request.reason}</p>
                  <span
                    className={`status-pill status-${
                      item.request.status === "approved"
                        ? "approved"
                        : item.request.status === "declined"
                          ? "corrections_requested"
                          : "under_review"
                    }`}
                  >
                    {resultStatusLabel(item.request.status)}
                  </span>
                </div>
              ))
            ) : (
              <div className="flow-step">
                <strong>No complaints are waiting right now.</strong>
                <p>The current term does not have any logged result complaint cases.</p>
              </div>
            )}
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Related Actions</p>
              <h3>Where complaint resolution actually happens</h3>
            </div>
          </div>
          <div className="card-grid">
            <Link href="/dashboard/result-locks" className="selection-card">
              <strong>Open or lock scores</strong>
              <p>Control whether a class must be reopened for teacher edits or kept under leadership lock.</p>
            </Link>
            <Link href="/dashboard/score-overrides" className="selection-card">
              <strong>Edit entered scores</strong>
              <p>Use controlled school-admin corrections when the complaint points to a raw-score mismatch.</p>
            </Link>
            <Link href="/dashboard/audit-export" className="selection-card">
              <strong>Audit export and evidence vault</strong>
              <p>Bundle the evidence trail once a complaint has been resolved and archived.</p>
            </Link>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
