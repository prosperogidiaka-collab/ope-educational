import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { getLiveResults } from "@/lib/live-results";

export const dynamic = "force-dynamic";

const approvalStages = [
  {
    stage: "Teacher submission",
    owner: "Assigned subject teacher",
    rule: "Teacher must complete and submit only the subject-class arm assigned to that account.",
  },
  {
    stage: "HOD review",
    owner: "Head of Department",
    rule: "Anomalies, missing cells, and subject consistency are checked before release upward.",
  },
  {
    stage: "Class review",
    owner: "Assigned class teacher",
    rule: "Whole-student completeness and position eligibility are checked against the class workflow.",
  },
  {
    stage: "School-admin approval",
    owner: "School admin",
    rule: "Final score override decisions, locks, and publication clearance are approved here.",
  },
];

export default async function ApprovalMatrixPage() {
  const { subjectSheets, reviewDecisions } = await getLiveResults();
  const submittedCount = Object.values(subjectSheets).filter((sheet) => sheet.sheetStatus === "submitted").length;
  const correctionsCount = Object.values(subjectSheets).filter(
    (sheet) => sheet.sheetStatus === "corrections_requested",
  ).length;
  const publishedCount = Object.values(reviewDecisions).filter(
    (decision) => decision.releaseState === "published",
  ).length;

  return (
    <AppShell
      activeHref="/dashboard/approval-matrix"
      eyebrow="Approval Matrix"
      title="Approval matrix configuration"
      description="Make the review chain explicit so the school knows exactly who must check, approve, and sign before a class can be published."
    >
      <section className="metric-grid compact">
        <MetricCard label="Submitted sheets" value={`${submittedCount}`} helper="Sheets currently waiting in the review chain" />
        <MetricCard label="Corrections requested" value={`${correctionsCount}`} helper="Sheets returned for evidence-backed adjustment" />
        <MetricCard label="Published decisions" value={`${publishedCount}`} helper="Students already cleared for release" />
        <MetricCard label="Approval stages" value={`${approvalStages.length}`} helper="Defined checkpoints in the live publication chain" />
      </section>

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Current Matrix</p>
            <h3>Who owns each approval checkpoint</h3>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Responsible role</th>
                <th>Control rule</th>
              </tr>
            </thead>
            <tbody>
              {approvalStages.map((item) => (
                <tr key={item.stage}>
                  <td>
                    <strong>{item.stage}</strong>
                  </td>
                  <td>{item.owner}</td>
                  <td>{item.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Related Desks</p>
            <h3>Where those approval actions happen</h3>
          </div>
        </div>
        <div className="card-grid">
          <Link href="/dashboard/score-review" className="selection-card">
            <strong>Score review</strong>
            <p>Review subject submissions, anomaly flags, and release decisions.</p>
          </Link>
          <Link href="/dashboard/score-overrides" className="selection-card">
            <strong>Edit entered scores</strong>
            <p>Make school-admin corrections when an approval step needs a controlled override.</p>
          </Link>
          <Link href="/dashboard/result-locks" className="selection-card">
            <strong>Open or lock scores</strong>
            <p>Freeze score entry once the matrix checkpoint for publication has been satisfied.</p>
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
