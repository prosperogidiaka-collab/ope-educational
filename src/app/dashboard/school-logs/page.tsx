import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { SchoolLogsBoard } from "@/components/school-logs-board";
import { isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { readVisibleSchoolLogs } from "@/lib/school-logs-store";
import { readVisibleStaffAccounts } from "@/lib/staff-accounts-store";
import { readVisibleTeacherPortalReports } from "@/lib/teacher-portal-reports-store";

export const dynamic = "force-dynamic";

export default async function SchoolLogsPage() {
  const currentAccount = await getCurrentStaffAccount();
  const [schoolLogs, teacherReports, staffAccounts] = await Promise.all([
    readVisibleSchoolLogs(currentAccount),
    readVisibleTeacherPortalReports(currentAccount),
    readVisibleStaffAccounts(currentAccount),
  ]);
  const teacherAccounts = staffAccounts.filter((account) =>
    ["teacher", "class_teacher", "hod", "school_admin", "principal"].includes(account.role),
  );
  const canManage = Boolean(
    currentAccount && (isSchoolAdminRole(currentAccount.role) || currentAccount.role === "registrar"),
  );

  return (
    <AppShell
      activeHref="/dashboard/school-logs"
      eyebrow="School Logs"
      title="School operations and teacher report desk"
      description="Record school-level operational notes, visitor logs, and teacher-specific reports that leadership can follow up from one place."
    >
      <section className="metric-grid compact">
        <MetricCard label="School logs" value={`${schoolLogs.length}`} helper="Recorded school operations items in the live desk" />
        <MetricCard label="Teacher reports" value={`${teacherReports.length}`} helper="Teacher-facing notes logged by leadership or registrar" />
        <MetricCard label="Teachers listed" value={`${teacherAccounts.length}`} helper="Accounts available for teacher report targeting" />
        <MetricCard label="Editable" value={canManage ? "Yes" : "No"} helper="Current account permission for this operations desk" />
      </section>

      <SchoolLogsBoard
        schoolLogs={schoolLogs}
        teacherReports={teacherReports}
        teacherAccounts={teacherAccounts}
        canManage={canManage}
      />
    </AppShell>
  );
}
