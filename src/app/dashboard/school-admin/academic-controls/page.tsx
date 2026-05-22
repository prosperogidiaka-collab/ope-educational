import { SchoolAdminPage } from "@/components/school-admin-page";

export const dynamic = "force-dynamic";

export default async function SchoolAdminAcademicControlsPage() {
  return (
    <SchoolAdminPage
      activeHref="/dashboard/school-admin/academic-controls"
      eyebrow="Academic Controls"
      title="Session setup and score governance"
      description="Handle term setup, assessment structure, locking, and controlled score correction from a separated academic desk."
      view="academicControls"
    />
  );
}
