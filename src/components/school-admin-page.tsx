import { AppShell } from "@/components/app-shell";
import { SchoolAdminHub, type SchoolAdminView } from "@/components/school-admin-hub";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { notifications } from "@/lib/demo-data";
import { getLiveResults } from "@/lib/live-results";
import { readResultLocks } from "@/lib/result-locks-store";
import { readVisibleStaffAccounts } from "@/lib/staff-accounts-store";
import { readVisibleSubjectTeacherAssignments } from "@/lib/subject-teacher-assignments-store";

interface SchoolAdminPageProps {
  activeHref: string;
  eyebrow: string;
  title: string;
  description: string;
  view: SchoolAdminView;
}

export async function SchoolAdminPage({
  activeHref,
  eyebrow,
  title,
  description,
  view,
}: SchoolAdminPageProps) {
  const currentAccount = await getCurrentStaffAccount();
  const [
    { academicConfig, school, summaries, subjectSheets },
    staffAccounts,
    subjectAssignments,
    resultLocks,
  ] = await Promise.all([
    getLiveResults(),
    readVisibleStaffAccounts(currentAccount),
    readVisibleSubjectTeacherAssignments(currentAccount),
    readResultLocks(),
  ]);

  const unlockRequests = summaries
    .filter((summary) => summary.bundle.unlockRequest)
    .map((summary) => ({
      studentName: summary.bundle.student.fullName,
      regNumber: summary.bundle.student.regNumber,
      reason: summary.bundle.unlockRequest?.reason ?? "Unlock request submitted.",
      status: summary.bundle.unlockRequest?.status ?? "pending",
    }));

  const attentionStudents = summaries
    .filter((summary) => summary.incompleteSubjects > 0 || summary.anomalies.length > 0)
    .slice(0, 6)
    .map((summary) => ({
      studentName: summary.bundle.student.fullName,
      regNumber: summary.bundle.student.regNumber,
      className: summary.bundle.student.className,
      average: summary.average.toFixed(1),
      incompleteSubjects: summary.incompleteSubjects,
      anomalyCount: summary.anomalies.length,
    }));

  const assignedCount = subjectAssignments.filter((assignment) => assignment.teacherAccountId).length;
  const lockedCount = resultLocks.filter((lock) => lock.locked).length;
  const correctionCount = Object.values(subjectSheets).filter(
    (sheet) => sheet.sheetStatus === "corrections_requested",
  ).length;
  const activeAccounts = staffAccounts.filter((account) => account.status === "active").length;
  const schoolAdminLeads = staffAccounts.filter(
    (account) => account.role === "school_admin" || account.role === "principal",
  ).length;
  const classTeacherLeads = staffAccounts.filter((account) => account.classTeacherArms.length > 0).length;
  const registrarSupport = staffAccounts.filter(
    (account) => account.role === "registrar" || account.canRegisterStudents,
  ).length;
  const publishedCount = summaries.filter(
    (summary) => summary.bundle.status === "published" || summary.bundle.status === "locked",
  ).length;
  const flaggedCount = summaries.filter(
    (summary) => summary.incompleteSubjects > 0 || summary.anomalies.length > 0,
  ).length;

  return (
    <AppShell activeHref={activeHref} eyebrow={eyebrow} title={title} description={description}>
      <SchoolAdminHub
        view={view}
        accountName={currentAccount?.fullName ?? school.schoolAdminName ?? "School admin"}
        school={school}
        notifications={notifications}
        metrics={{
          activeStudents: summaries.length,
          activeAccounts,
          assignedCount,
          totalAssignments: subjectAssignments.length,
          lockedCount,
          correctionCount,
          activeAssessmentSlots: academicConfig.scoreComponents.length,
          unlockRequests: unlockRequests.length,
          publishedCount,
          flaggedCount,
          schoolAdminLeads,
          classTeacherLeads,
          registrarSupport,
        }}
        unlockRequests={unlockRequests}
        attentionStudents={attentionStudents}
      />
    </AppShell>
  );
}
