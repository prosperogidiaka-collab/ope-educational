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

export default async function StudentAffairsReportsPage() {
  const currentAccount = await getCurrentStaffAccount();
  const [snapshot, classOfferings] = await Promise.all([
    getStudentAffairsSnapshot(currentAccount),
    readVisibleClassOfferings(currentAccount),
  ]);

  return (
    <AppShell
      activeHref="/dashboard/student-affairs/reports"
      eyebrow="Students Affairs"
      title="Student reports and praise log"
      description="Read and add teacher or registrar notes that can stay internal, appear in the student portal, or feed the class-teacher result comment."
    >
      <StudentAffairsBoard
        school={snapshot.school}
        view="reports"
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
