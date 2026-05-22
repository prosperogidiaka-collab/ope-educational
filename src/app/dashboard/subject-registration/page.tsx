import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { SubjectRegistrationBoard } from "@/components/subject-registration-board";
import { isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { readVisibleClassOfferings } from "@/lib/class-offerings-store";
import { readVisibleSubjectTeacherAssignments } from "@/lib/subject-teacher-assignments-store";

export const dynamic = "force-dynamic";

export default async function SubjectRegistrationPage() {
  const currentAccount = await getCurrentStaffAccount();
  const [offerings, assignments] = await Promise.all([
    readVisibleClassOfferings(currentAccount),
    readVisibleSubjectTeacherAssignments(currentAccount),
  ]);
  const activeAssignments = assignments.filter((assignment) => assignment.active !== false);
  const compulsoryCount = activeAssignments.filter((assignment) => assignment.subjectType !== "elective").length;
  const electiveCount = activeAssignments.filter((assignment) => assignment.subjectType === "elective").length;
  const unassignedCount = activeAssignments.filter((assignment) => !assignment.teacherAccountId).length;
  const canManage = Boolean(
    currentAccount &&
      (isSchoolAdminRole(currentAccount.role) ||
        currentAccount.role === "registrar" ||
        currentAccount.canRegisterStudents),
  );

  return (
    <AppShell
      activeHref="/dashboard/subject-registration"
      eyebrow="Subject Registration"
      title="Subjects by class arm"
      description="Control which subjects belong to each arm, whether they are core or elective, and any track restriction before teacher assignment and score entry."
    >
      <section className="metric-grid compact">
        <MetricCard label="Registered subjects" value={`${activeAssignments.length}`} helper="All live subject rows currently attached to class arms" />
        <MetricCard label="Core" value={`${compulsoryCount}`} helper="Subjects every learner in the arm should carry" />
        <MetricCard label="Electives" value={`${electiveCount}`} helper="Subjects restricted by track or chosen basket" />
        <MetricCard label="Unassigned" value={`${unassignedCount}`} helper="Rows still waiting for a teacher account" />
      </section>

      <SubjectRegistrationBoard offerings={offerings} assignments={assignments} canManage={canManage} />
    </AppShell>
  );
}
