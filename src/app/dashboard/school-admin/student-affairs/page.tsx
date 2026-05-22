import { SchoolAdminPage } from "@/components/school-admin-page";

export const dynamic = "force-dynamic";

export default async function SchoolAdminStudentAffairsPage() {
  return (
    <SchoolAdminPage
      activeHref="/dashboard/school-admin/student-affairs"
      eyebrow="Student Affairs"
      title="Student records and portal support"
      description="Manage student-facing work from a dedicated desk instead of mixing it with setup, review, and rollover tasks."
      view="studentAffairs"
    />
  );
}
