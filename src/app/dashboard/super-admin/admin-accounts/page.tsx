import { SuperAdminPage } from "@/components/super-admin-page";

export const dynamic = "force-dynamic";

export default async function SuperAdminAdminAccountsPage() {
  return (
    <SuperAdminPage
      activeHref="/dashboard/super-admin/admin-accounts"
      eyebrow="School Admin Accounts"
      title="School-admin access control"
      description="Separate account governance from school editing so account status and cross-school scope are easier to manage."
      view="adminAccounts"
    />
  );
}
