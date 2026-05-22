import { AppShell } from "@/components/app-shell";
import { ClassArmsBoard } from "@/components/class-arms-board";
import { MetricCard } from "@/components/metric-card";
import { isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { readVisibleClassOfferings } from "@/lib/class-offerings-store";
import { readVisibleSchoolClasses } from "@/lib/school-classes-store";
import { readVisibleStaffAccounts } from "@/lib/staff-accounts-store";
import { readVisibleSubjectTeacherAssignments } from "@/lib/subject-teacher-assignments-store";

export const dynamic = "force-dynamic";

export default async function ClassArmsPage() {
  const currentAccount = await getCurrentStaffAccount();
  const [schoolClasses, offerings, assignments, staffAccounts] = await Promise.all([
    readVisibleSchoolClasses(currentAccount),
    readVisibleClassOfferings(currentAccount),
    readVisibleSubjectTeacherAssignments(currentAccount),
    readVisibleStaffAccounts(currentAccount),
  ]);
  const activeOfferings = offerings.filter((offering) => offering.status !== "retired");
  const retiredOfferings = offerings.length - activeOfferings.length;
  const sectionCount = new Set(schoolClasses.map((record) => record.section)).size;
  const trackCount = new Set(activeOfferings.map((offering) => offering.track)).size;
  const staffNames = staffAccounts.map((account) => account.fullName).sort((left, right) => left.localeCompare(right));
  const canManage = Boolean(
    currentAccount &&
      (isSchoolAdminRole(currentAccount.role) ||
        currentAccount.role === "registrar" ||
        currentAccount.canRegisterStudents),
  );

  return (
    <AppShell
      activeHref="/dashboard/class-arms"
      eyebrow="Class Arms"
      title="Class arm registry"
      description="Create, rename, retire, and assign ownership to class arms from one live school-structure desk."
    >
      <section className="metric-grid compact">
        <MetricCard label="Classes" value={`${schoolClasses.length}`} helper="Base classes created for the live session" />
        <MetricCard label="Active arms" value={`${activeOfferings.length}`} helper="Class arms live in the current session" />
        <MetricCard label="Retired arms" value={`${retiredOfferings}`} helper="Arms no longer active for current operations" />
        <MetricCard label="Sections and tracks" value={`${sectionCount} / ${trackCount}`} helper="Sections and distinct curricular tracks in active use" />
      </section>

      <ClassArmsBoard
        schoolClasses={schoolClasses}
        offerings={offerings}
        assignments={assignments}
        staffNames={staffNames}
        canManage={canManage}
      />
    </AppShell>
  );
}
