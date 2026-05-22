import { SuperAdminPage } from "@/components/super-admin-page";

export const dynamic = "force-dynamic";

export default async function SuperAdminOverviewPage() {
  return (
    <SuperAdminPage
      activeHref="/dashboard/super-admin"
      eyebrow="Super Admin"
      title="Platform operations home"
      description="Use the dedicated pages below to manage schools, onboarding, school-admin accounts, platform switches, and owner activity without cramming everything into one screen."
      view="overview"
    />
  );
}
