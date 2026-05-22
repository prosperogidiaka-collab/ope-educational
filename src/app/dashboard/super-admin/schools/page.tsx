import { SuperAdminPage } from "@/components/super-admin-page";

export const dynamic = "force-dynamic";

export default async function SuperAdminSchoolsPage() {
  return (
    <SuperAdminPage
      activeHref="/dashboard/super-admin/schools"
      eyebrow="School Portfolio"
      title="Tenant schools and subscriptions"
      description="Edit plans, renewal dates, status, storage, and follow-up notes in a roomier portfolio view."
      view="schools"
    />
  );
}
