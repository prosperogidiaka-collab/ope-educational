import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { TimetableBoard } from "@/components/timetable-board";
import { isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { readVisibleClassOfferings } from "@/lib/class-offerings-store";
import { readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { readSchoolTimetable } from "@/lib/school-timetable-store";
import { readVisibleStaffAccounts } from "@/lib/staff-accounts-store";

export const dynamic = "force-dynamic";

export default async function TimetablePage() {
  const currentAccount = await getCurrentStaffAccount();
  const [school, timetable, classOfferings, staffAccounts] = await Promise.all([
    readRuntimeSchoolProfile(),
    readSchoolTimetable(),
    readVisibleClassOfferings(currentAccount),
    readVisibleStaffAccounts(currentAccount),
  ]);
  const coveredClasses = new Set(timetable.entries.map((entry) => `${entry.className}::${entry.arm}`)).size;
  const coveredTeachers = new Set(timetable.entries.map((entry) => entry.teacherName)).size;
  const canViewAll = Boolean(
    currentAccount &&
      (isSchoolAdminRole(currentAccount.role) ||
        currentAccount.role === "registrar" ||
        currentAccount.role === "hod"),
  );
  const canEdit = Boolean(
    currentAccount &&
      (isSchoolAdminRole(currentAccount.role) ||
        currentAccount.role === "registrar" ||
        currentAccount.canRegisterStudents),
  );
  const titlePrefix = canViewAll ? "School timetable desk" : "My timetable";

  if (!currentAccount) {
    return null;
  }

  return (
    <AppShell
      activeHref="/dashboard/timetable"
      eyebrow="Timetable"
      title={`${titlePrefix} - ${school.term}`}
      description="Upload, publish, and read timetable slots by day and period. Teachers only see their own published timetable, while leadership can see the full school grid."
    >
      <section className="metric-grid compact">
        <MetricCard label="Periods" value={`${timetable.periods.length}`} helper="Period rows currently defined" />
        <MetricCard label="Timetable slots" value={`${timetable.entries.length}`} helper="Uploaded timetable rows for the active term" />
        <MetricCard label="Class arms covered" value={`${coveredClasses}`} helper="Distinct class-arm grids currently represented" />
        <MetricCard label="Teachers matched" value={`${coveredTeachers}`} helper="Teacher names already attached to timetable rows" />
      </section>

      <TimetableBoard
        schoolName={school.shortName || school.name}
        timetable={timetable}
        currentAccount={currentAccount}
        classOfferings={classOfferings}
        staffAccounts={staffAccounts}
        canViewAll={canViewAll}
        canEdit={canEdit}
      />
    </AppShell>
  );
}
