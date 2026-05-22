import { SchoolAdminPage } from "@/components/school-admin-page";

export const dynamic = "force-dynamic";

export default async function SchoolAdminPublicationPage() {
  return (
    <SchoolAdminPage
      activeHref="/dashboard/school-admin/publication"
      eyebrow="Publication Desk"
      title="Review, release, and report output"
      description="Keep review, broadsheet, report editing, and release control in one separated publication workspace."
      view="publication"
    />
  );
}
