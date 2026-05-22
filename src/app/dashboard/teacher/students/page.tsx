import { AppShell } from "@/components/app-shell";
import { TeacherStudentSupportPanel } from "@/components/teacher-student-support-panel";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { loadTeacherWorkspace } from "@/lib/teacher-workspace";

export const dynamic = "force-dynamic";

export default async function TeacherStudentsPage() {
  const account = await getCurrentStaffAccount();

  if (!account) {
    return null;
  }

  const workspace = await loadTeacherWorkspace(account);

  return (
    <AppShell
      activeHref="/dashboard/teacher/students"
      eyebrow="Student Reports"
      title={`${account.fullName} student support`}
      description="This page is now only for student reports and parent-facing follow-up inside your teaching scope."
    >
      {workspace.scopedStudentProfiles.length > 0 ? (
        <TeacherStudentSupportPanel
          profiles={workspace.scopedStudentProfiles}
          reports={workspace.scopedStudentReports}
          attendancePolicy={workspace.attendancePolicy}
          attendanceRegisters={workspace.scopedAttendanceRegisters}
          classTeacherArms={account.classTeacherArms}
          accessibleClassNames={workspace.accessibleClassNames}
          mode="reports"
        />
      ) : (
        <section className="surface-card">
          <div className="flow-step">
            <strong>No students are visible inside this account scope yet.</strong>
            <p>Once the school admin assigns a subject class or class-teacher arm to this account, the separated student-reports page will open the matching learners here.</p>
          </div>
        </section>
      )}
    </AppShell>
  );
}
