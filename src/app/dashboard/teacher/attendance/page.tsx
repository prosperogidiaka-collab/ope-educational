import { AppShell } from "@/components/app-shell";
import { TeacherStudentSupportPanel } from "@/components/teacher-student-support-panel";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { loadTeacherWorkspace } from "@/lib/teacher-workspace";

export const dynamic = "force-dynamic";

export default async function TeacherAttendancePage() {
  const account = await getCurrentStaffAccount();

  if (!account) {
    return null;
  }

  const workspace = await loadTeacherWorkspace(account);

  return (
    <AppShell
      activeHref="/dashboard/teacher/attendance"
      eyebrow="Class Attendance"
      title={`${account.fullName} attendance register`}
      description="Attendance now has its own menu, separate from score entry and student reports."
    >
      <TeacherStudentSupportPanel
        profiles={workspace.scopedStudentProfiles}
        reports={workspace.scopedStudentReports}
        attendancePolicy={workspace.attendancePolicy}
        attendanceRegisters={workspace.scopedAttendanceRegisters}
        classTeacherArms={account.classTeacherArms}
        accessibleClassNames={workspace.accessibleClassNames}
        mode="attendance"
      />
    </AppShell>
  );
}
