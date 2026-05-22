import { AppShell } from "@/components/app-shell";
import { StudentAffairsBoard } from "@/components/student-affairs-board";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { readVisibleClassOfferings } from "@/lib/class-offerings-store";
import {
  canDecideStudentAbsenceRequests,
  canManageAttendancePolicy,
  canManageStudentRecords,
} from "@/lib/student-affairs-permissions";
import { getStudentAffairsSnapshot } from "@/lib/student-affairs-snapshot";

export const dynamic = "force-dynamic";

export default async function StudentAffairsStudentAccountsPage() {
  const currentAccount = await getCurrentStaffAccount();
  const [snapshot, classOfferings] = await Promise.all([
    getStudentAffairsSnapshot(currentAccount),
    readVisibleClassOfferings(currentAccount),
  ]);

  return (
    <AppShell
      activeHref="/dashboard/student-affairs/student-accounts"
      eyebrow="Students Affairs"
      title="Student portal account register"
      description="Manage the student login packs that open the student dashboard, together with coupon linkage and reset state."
    >
      <StudentAffairsBoard
        school={snapshot.school}
        view="student_accounts"
        classOfferings={classOfferings}
        profiles={snapshot.profiles}
        credentials={snapshot.credentials}
        reports={snapshot.reports}
        absenceRequests={snapshot.absenceRequests}
        attendancePolicy={snapshot.attendancePolicy}
        attendanceSummaries={snapshot.attendanceSummaries}
        attendanceRegisters={snapshot.attendanceRegisters}
        liveSummaries={snapshot.liveSummaries}
        canManageRecords={currentAccount ? canManageStudentRecords(currentAccount) : false}
        canManageAttendancePolicy={currentAccount ? canManageAttendancePolicy(currentAccount) : false}
        canManageAbsenceRequests={currentAccount ? canDecideStudentAbsenceRequests(currentAccount) : false}
      />
    </AppShell>
  );
}
