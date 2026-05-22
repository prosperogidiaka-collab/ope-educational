import { SchoolAdminPage } from "@/components/school-admin-page";

export const dynamic = "force-dynamic";

export default async function SchoolAdminDashboardPage() {
  return (
    <SchoolAdminPage
      activeHref="/dashboard/school-admin"
      eyebrow="School Admin"
      title="School administration home"
      description="Open the exact school-admin desk you need instead of working from one crowded administration page."
      view="overview"
    />
  );
}
