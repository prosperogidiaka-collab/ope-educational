import { AppShell } from "@/components/app-shell";
import { SuperAdminBoard } from "@/components/super-admin-board";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { notifications } from "@/lib/demo-data";
import { readPlatformSettings } from "@/lib/platform-settings-store";
import { readSchoolPortfolio } from "@/lib/school-portfolio-store";
import { readVisibleStaffAccounts } from "@/lib/staff-accounts-store";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const currentAccount = await getCurrentStaffAccount();
  const [staffAccounts, schools, platformSettings] = await Promise.all([
    readVisibleStaffAccounts(currentAccount),
    readSchoolPortfolio(),
    readPlatformSettings(),
  ]);

  return (
    <AppShell
      activeHref="/dashboard/super-admin"
      eyebrow="Super Admin"
      title="Owner operations and subscription visibility"
      description="Manage tenant schools, see plan status at a glance, monitor portfolio activity, and control subscription-side operations."
    >
      <SuperAdminBoard
        schools={schools}
        notifications={notifications}
        accounts={staffAccounts}
        platformSettings={platformSettings}
      />
    </AppShell>
  );
}
