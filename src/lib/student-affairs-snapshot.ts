import "server-only";

import { getLiveResults } from "@/lib/live-results";
import { readVisibleStudentAbsenceRequests } from "@/lib/student-absence-requests-store";
import {
  buildAttendanceSummaryMap,
  readStudentAttendancePolicy,
  readVisibleStudentAttendanceRegisters,
} from "@/lib/student-attendance-store";
import { readVisibleStudentProfiles } from "@/lib/student-profiles-store";
import { readVisibleStudentReports } from "@/lib/student-reports-store";
import { readVisibleStudentPortalCredentials } from "@/lib/student-portal-credentials-store";
import type { StaffAccount } from "@/lib/types";

type StudentAffairsViewer = Pick<StaffAccount, "role" | "schoolCode" | "grantedSchoolCodes">;

export async function getStudentAffairsSnapshot(viewer?: StudentAffairsViewer | null) {
  const [
    profiles,
    credentials,
    reports,
    absenceRequests,
    attendancePolicy,
    attendanceRegisters,
    attendanceSummaryMap,
    liveResults,
  ] = await Promise.all([
    readVisibleStudentProfiles(viewer),
    readVisibleStudentPortalCredentials(viewer),
    readVisibleStudentReports(viewer),
    readVisibleStudentAbsenceRequests(viewer),
    readStudentAttendancePolicy(),
    readVisibleStudentAttendanceRegisters(viewer),
    buildAttendanceSummaryMap(),
    getLiveResults(),
  ]);

  const visibleRegNumbers = new Set(profiles.map((profile) => profile.regNumber));
  const attendanceSummaries = Array.from(attendanceSummaryMap.values()).filter((summary) =>
    visibleRegNumbers.has(summary.regNumber),
  );
  const liveSummaries = liveResults.summaries.filter((summary) =>
    visibleRegNumbers.has(summary.bundle.student.regNumber),
  );

  return {
    school: liveResults.school,
    profiles: [...profiles].sort((left, right) => left.fullName.localeCompare(right.fullName)),
    credentials: [...credentials].sort((left, right) => left.studentName.localeCompare(right.studentName)),
    reports: [...reports].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    absenceRequests: [...absenceRequests].sort(
      (left, right) => new Date(right.requestedAt).getTime() - new Date(left.requestedAt).getTime(),
    ),
    attendancePolicy,
    attendanceRegisters: [...attendanceRegisters].sort(
      (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
    ),
    attendanceSummaries,
    liveSummaries,
  };
}
