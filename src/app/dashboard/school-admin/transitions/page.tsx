import { SchoolAdminPage } from "@/components/school-admin-page";

export const dynamic = "force-dynamic";

export default async function SchoolAdminTransitionsPage() {
  return (
    <SchoolAdminPage
      activeHref="/dashboard/school-admin/transitions"
      eyebrow="Transition and Data"
      title="Rollover, archive, and evidence workflow"
      description="Open session-close tasks from a dedicated desk so rollover, archive, complaints, and export work stay organized."
      view="transitions"
    />
  );
}
