import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { getLiveResults } from "@/lib/live-results";

export const dynamic = "force-dynamic";

export default async function ArchiveTranscriptsPage() {
  const { school, summaries, reviewDecisions } = await getLiveResults();
  const publishedCount = Object.values(reviewDecisions).filter(
    (decision) => decision.releaseState === "published",
  ).length;
  const completeCount = summaries.filter((summary) => summary.incompleteSubjects === 0).length;

  return (
    <AppShell
      activeHref="/dashboard/archive-transcripts"
      eyebrow="Archive and Transcript Desk"
      title="Archive and transcript desk"
      description="Keep published terms tidy, support official reprints, and prepare transcript bundles without mixing archive work into live score control."
    >
      <section className="metric-grid compact">
        <MetricCard label="Live class records" value={`${summaries.length}`} helper="Student records available in the shared result server" />
        <MetricCard label="Complete sheets" value={`${completeCount}`} helper="Students whose term sheets are fully entered" />
        <MetricCard label="Published results" value={`${publishedCount}`} helper="Result sheets already released to students or parents" />
        <MetricCard label="Current archive label" value={`${school.session}`} helper={`${school.term} ${school.examType}`} />
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Archive Use</p>
              <h3>What should be preserved here</h3>
            </div>
          </div>
          <div className="stack-list">
            <div className="flow-step">
              <strong>Historical term copies</strong>
              <p>Retain clean versions of broadsheets, published report sheets, and release decisions for each session and term.</p>
            </div>
            <div className="flow-step">
              <strong>Transcript preparation</strong>
              <p>Group student term outputs into transcript-friendly bundles instead of searching one sheet at a time later.</p>
            </div>
            <div className="flow-step">
              <strong>Official reprints</strong>
              <p>Support controlled reprints after publication, especially when a parent or regulator requests a past term copy.</p>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Archive Sources</p>
              <h3>Current live outputs that should feed the archive</h3>
            </div>
          </div>
          <div className="card-grid">
            <Link href="/dashboard/broadsheet" className="selection-card">
              <strong>Broadsheet</strong>
              <p>Use the final landscape class sheet as the archive reference for class-level academic history.</p>
            </Link>
            <Link href="/dashboard/report-editor" className="selection-card">
              <strong>Report editor</strong>
              <p>Confirm the exact printed student sheet that should be retained for reprints and transcripts.</p>
            </Link>
            <Link href="/dashboard/result-complaints" className="selection-card">
              <strong>Result complaint log</strong>
              <p>Make sure archived copies reflect the final resolution of complaints or reopened score sheets.</p>
            </Link>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
