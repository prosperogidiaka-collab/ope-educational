import "server-only";

import { buildLegacyScoreSnapshot, normalizeComponentScoreMap } from "@/lib/academic-config";
import { rankStudentSummaries } from "@/lib/calculations";
import { readAcademicConfig, readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { gradeScale, resultBundles, subjects } from "@/lib/demo-data";
import { readResultLocks } from "@/lib/result-locks-store";
import { readReportSheetDraftStore } from "@/lib/report-sheet-store";
import { releaseStateToStatus, type ReviewDecisionStore } from "@/lib/review-decisions";
import { readReviewDecisionStore } from "@/lib/review-decisions-store";
import { buildAttendanceSummaryMap, readStudentAttendancePolicy } from "@/lib/student-attendance-store";
import { readStudentProfiles } from "@/lib/student-profiles-store";
import { readStudentReports } from "@/lib/student-reports-store";
import { readTeacherScoresStore } from "@/lib/teacher-scores-store";
import type { ResultSheetDraftStore } from "@/lib/report-sheet";
import type { TeacherScoreSheetStore } from "@/lib/teacher-scores";
import type { AcademicConfig, SchoolProfile, StudentResultBundle, StudentSummary, SubjectScore } from "@/lib/types";

export interface LiveResultsData {
  academicConfig: AcademicConfig;
  school: SchoolProfile;
  summaries: StudentSummary[];
  subjectSheets: TeacherScoreSheetStore;
  reviewDecisions: ReviewDecisionStore;
  reportOverrides: ResultSheetDraftStore;
}

/**
 * Merges the teacher-entered score sheets and reviewer release decisions on top of the
 * seeded demo bundles, then re-ranks. This is the single source of "live" results that the
 * dashboard, audit desk, class-review board, principal editor, and student portal all read.
 */
export async function getLiveResults(): Promise<LiveResultsData> {
  const [
    academicConfig,
    school,
    subjectSheets,
    reviewDecisions,
    reportOverrides,
    resultLocks,
    attendanceSummaryMap,
    attendancePolicy,
    studentReports,
    studentProfiles,
  ] = await Promise.all([
    readAcademicConfig(),
    readRuntimeSchoolProfile(),
    readTeacherScoresStore(),
    readReviewDecisionStore(),
    readReportSheetDraftStore(),
    readResultLocks(),
    buildAttendanceSummaryMap(),
    readStudentAttendancePolicy(),
    readStudentReports(),
    readStudentProfiles(),
  ]);
  const resultLockByClassName = new Map(resultLocks.map((lock) => [lock.className, lock]));
  const reportsByRegNumber = new Map<string, typeof studentReports>(
    resultBundles.map((bundle) => [bundle.student.regNumber, []]),
  );

  studentReports.forEach((report) => {
    const current = reportsByRegNumber.get(report.regNumber) ?? [];
    current.push(report);
    reportsByRegNumber.set(report.regNumber, current);
  });
  const profileByRegNumber = new Map(studentProfiles.map((profile) => [profile.regNumber, profile]));

  const mergedBundles: StudentResultBundle[] = resultBundles.map((bundle) => {
    const regNumber = bundle.student.regNumber;
    const profile = profileByRegNumber.get(regNumber);
    const latestResultComment = (reportsByRegNumber.get(regNumber) ?? [])
      .filter((report) => report.showOnResultSheet)
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0];
    const attendanceSummary = attendanceSummaryMap.get(regNumber);
    const scores: SubjectScore[] = bundle.scores.map((score) => {
      const sheet = subjectSheets[score.subjectId];

      if (!sheet) {
        return score;
      }

      const row = sheet.rows.find((item) => item.regNumber === regNumber);

      if (!row) {
        return score;
      }

      const componentScores = normalizeComponentScoreMap(row.componentScores, academicConfig, {
        test1: row.test1,
        test2: row.test2,
        exam: row.exam,
      });
      const legacyScores = buildLegacyScoreSnapshot(componentScores, academicConfig);

      return {
        ...score,
        componentScores,
        test1: legacyScores.test1,
        test2: legacyScores.test2,
        exam: legacyScores.exam,
        teacherComment: row.teacherComment || score.teacherComment,
        status: row.status || score.status,
        updatedAt: sheet.updatedAt,
        updatedBy: sheet.lastEditedBy ?? sheet.teacherName,
      };
    });

    // Pick up score rows for registered subjects that did not have a seeded entry yet.
    for (const [assignmentId, sheet] of Object.entries(subjectSheets)) {
      if (scores.some((score) => score.subjectId === assignmentId)) {
        continue;
      }

      if (!bundle.student.registeredSubjectIds.includes(assignmentId)) {
        continue;
      }

      const row = sheet.rows.find((item) => item.regNumber === regNumber);

      if (!row) {
        continue;
      }

      const componentScores = normalizeComponentScoreMap(row.componentScores, academicConfig, {
        test1: row.test1,
        test2: row.test2,
        exam: row.exam,
      });
      const legacyScores = buildLegacyScoreSnapshot(componentScores, academicConfig);

      scores.push({
        subjectId: assignmentId,
        componentScores,
        test1: legacyScores.test1,
        test2: legacyScores.test2,
        exam: legacyScores.exam,
        teacherComment: row.teacherComment,
        status: row.status,
        updatedAt: sheet.updatedAt,
        updatedBy: sheet.lastEditedBy ?? sheet.teacherName,
      });
    }

    const decision = reviewDecisions[regNumber];

    const baseStatus = decision ? releaseStateToStatus(decision.releaseState) : bundle.status;
    const publishedAt =
      decision?.releaseState === "published" ? bundle.publishedAt ?? decision.decidedAt : bundle.publishedAt;
    const classLock = resultLockByClassName.get(bundle.student.className);
    const status = classLock?.locked
      ? "locked"
      : baseStatus === "locked"
        ? "published"
        : baseStatus;

    return {
      ...bundle,
      student: {
        ...bundle.student,
        fullName: profile?.fullName ?? bundle.student.fullName,
        className: profile?.className ?? bundle.student.className,
        house: profile?.house ?? bundle.student.house,
        gender: profile?.gender ?? bundle.student.gender,
        dateOfBirth: profile?.dateOfBirth ?? bundle.student.dateOfBirth,
        age: profile?.age ?? bundle.student.age,
        guardianName: profile?.guardianName ?? bundle.student.guardianName,
        photoInitials: profile?.photoInitials ?? bundle.student.photoInitials,
        passportUrl: profile ? profile.passportUrl : bundle.student.passportUrl,
        feeStatus: profile?.feeStatus ?? bundle.student.feeStatus,
        attendance:
          attendanceSummary && attendancePolicy.attendanceEnabled
            ? {
                present: attendanceSummary.present,
                absent: attendanceSummary.absent,
                late: attendanceSummary.late,
                excused: attendanceSummary.excused,
                possible: attendanceSummary.possible,
              }
            : bundle.student.attendance,
        classTeacherComment:
          latestResultComment && attendancePolicy.classTeacherCommentEnabled
            ? latestResultComment.body
            : bundle.student.classTeacherComment,
      },
      scores,
      status,
      publishedAt,
      lockedAt: classLock?.locked ? classLock.lockedAt ?? bundle.lockedAt ?? publishedAt : undefined,
    };
  });

  const summaries = rankStudentSummaries(mergedBundles, subjects, gradeScale, academicConfig);

  return { academicConfig, school, summaries, subjectSheets, reviewDecisions, reportOverrides };
}
