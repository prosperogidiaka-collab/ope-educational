import { AppShell } from "@/components/app-shell";
import { ClassReviewBoard } from "@/components/class-review-board";
import { subjects } from "@/lib/demo-data";
import { getLiveResults } from "@/lib/live-results";
import { readTemplateWorkspace } from "@/lib/template-workspace-store";

export const dynamic = "force-dynamic";

export default async function ScoreReviewPage() {
  const { academicConfig, school, summaries, subjectSheets, reviewDecisions, reportOverrides } =
    await getLiveResults();
  const templateWorkspace = await readTemplateWorkspace();

  return (
    <AppShell
      activeHref="/dashboard/score-review"
      eyebrow="Score Review"
      title="Review submitted scores before release"
      description="Inspect subject sheets, anomalies, student results, and template output before you publish or lock the class."
    >
      <ClassReviewBoard
        school={school}
        summaries={summaries}
        subjects={subjects}
        config={academicConfig}
        subjectSheets={subjectSheets}
        reviewDecisions={reviewDecisions}
        reportOverrides={reportOverrides}
        templateSchema={templateWorkspace.liveSchema}
      />
    </AppShell>
  );
}
