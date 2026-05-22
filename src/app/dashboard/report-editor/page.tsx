import { AppShell } from "@/components/app-shell";
import { PrincipalResultEditor } from "@/components/principal-result-editor";
import { getLiveResults } from "@/lib/live-results";
import { readTemplateWorkspace } from "@/lib/template-workspace-store";

export const dynamic = "force-dynamic";

export default async function ReportEditorPage() {
  const [templateWorkspace, { academicConfig, school, summaries: studentSummaries }] = await Promise.all([
    readTemplateWorkspace(),
    getLiveResults(),
  ]);

  return (
    <AppShell
      activeHref="/dashboard/report-editor"
      eyebrow="Report Editor"
      title="School-admin report editor"
      description="Edit printed result fields in a dedicated page instead of mixing report-sheet edits with assignments, locks, and governance."
    >
      <PrincipalResultEditor
        school={school}
        students={studentSummaries}
        templateSchema={templateWorkspace.liveSchema}
        academicConfig={academicConfig}
      />
    </AppShell>
  );
}
