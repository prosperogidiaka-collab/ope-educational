import { AppShell } from "@/components/app-shell";
import { SuperAdminBoard, type SuperAdminView } from "@/components/super-admin-board";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { notifications } from "@/lib/demo-data";
import { readPlatformSettings } from "@/lib/platform-settings-store";
import { readSchoolPortfolio } from "@/lib/school-portfolio-store";
import { readVisibleStaffAccounts } from "@/lib/staff-accounts-store";

interface SuperAdminPageProps {
  activeHref: string;
  eyebrow: string;
  title: string;
  description: string;
  view: SuperAdminView;
}

export async function SuperAdminPage({
  activeHref,
  eyebrow,
  title,
  description,
  view,
}: SuperAdminPageProps) {
  const currentAccount = await getCurrentStaffAccount();
  const [staffAccounts, schools, platformSettings] = await Promise.all([
    readVisibleStaffAccounts(currentAccount),
    readSchoolPortfolio(),
    readPlatformSettings(),
  ]);

  return (
    <AppShell activeHref={activeHref} eyebrow={eyebrow} title={title} description={description}>
      <SuperAdminBoard
        view={view}
        schools={schools}
        notifications={notifications}
        accounts={staffAccounts}
        platformSettings={platformSettings}
      />
    </AppShell>
  );
}
