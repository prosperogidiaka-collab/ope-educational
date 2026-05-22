import { SchoolAdminPage } from "@/components/school-admin-page";

export const dynamic = "force-dynamic";

export default async function SchoolAdminRegistrationPage() {
  return (
    <SchoolAdminPage
      activeHref="/dashboard/school-admin/registration"
      eyebrow="Registration Desk"
      title="Staffing, timetable, and class setup"
      description="Keep teacher assignment, staffing, class arms, timetable, and subject registration in their own workspace."
      view="registration"
    />
  );
}
