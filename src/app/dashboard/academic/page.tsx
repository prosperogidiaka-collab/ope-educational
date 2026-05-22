import { AppShell } from "@/components/app-shell";
import { AcademicSettingsBoard } from "@/components/academic-settings-board";
import { isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { readAcademicConfig, readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import {
  classOfferings,
  gradeScale,
  juniorGradeScale,
  promotionQueue,
} from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export default async function AcademicDashboardPage() {
  const [account, config, school] = await Promise.all([
    getCurrentStaffAccount(),
    readAcademicConfig(),
    readRuntimeSchoolProfile(),
  ]);
  const canManage = account?.role ? isSchoolAdminRole(account.role) : false;

  return (
    <AppShell
      activeHref="/dashboard/academic"
      eyebrow="Academic Setup"
      title="School structure and calculation policy"
      description="Manage term settings, score component windows, subject offerings by class or track, section grading scales, and promotion logic."
    >
      <AcademicSettingsBoard
        school={school}
        config={config}
        seniorBands={gradeScale}
        juniorBands={juniorGradeScale}
        classOfferings={classOfferings}
        promotionQueue={promotionQueue}
        canManage={canManage}
      />
    </AppShell>
  );
}
