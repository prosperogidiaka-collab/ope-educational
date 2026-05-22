import { AppShell } from "@/components/app-shell";
import { TemplateBuilderBoard } from "@/components/template-builder-board";
import { buildResultSheetDraft } from "@/lib/report-sheet";
import { getLiveResults } from "@/lib/live-results";
import { readTemplateWorkspace } from "@/lib/template-workspace-store";

export const dynamic = "force-dynamic";

export default async function TemplateBuilderPage() {
  const [workspace, liveResults] = await Promise.all([readTemplateWorkspace(), getLiveResults()]);
  const sampleSummary = liveResults.summaries[0];

  if (!sampleSummary) {
    return (
      <AppShell
        activeHref="/dashboard/templates"
        eyebrow="Template Builder"
        title="Result template customizer"
        description="Assemble the report card with drag-and-drop zones, uploaded logo and signatures, schema-driven toggles, and a live preview before anything goes live."
      >
        <section className="surface-card">
          <div className="callout-banner warning">
            <strong>No live student result is available for template preview yet.</strong>
            <p className="muted">Register students and generate at least one result record before using the template builder preview.</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const sampleDraft = buildResultSheetDraft(liveResults.school, sampleSummary, {
    classSize: liveResults.summaries.length,
    academicConfig: liveResults.academicConfig,
  });

  return (
    <AppShell
      activeHref="/dashboard/templates"
      eyebrow="Template Builder"
      title="Result template customizer"
      description="Assemble the report card with drag-and-drop zones, uploaded logo and signatures, schema-driven toggles, and a live preview before anything goes live."
    >
      <TemplateBuilderBoard
        initialWorkspace={workspace}
        sampleDraft={sampleDraft}
        academicConfig={liveResults.academicConfig}
      />
    </AppShell>
  );
}
