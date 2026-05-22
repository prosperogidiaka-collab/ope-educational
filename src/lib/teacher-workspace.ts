import "server-only";

import { subjects } from "@/lib/demo-data";
import { getLiveResults } from "@/lib/live-results";
import { readResultLocks } from "@/lib/result-locks-store";
import {
  readStudentAttendancePolicy,
  readStudentAttendanceRegisters,
} from "@/lib/student-attendance-store";
import { readStudentProfiles } from "@/lib/student-profiles-store";
import { readStudentReports } from "@/lib/student-reports-store";
import { listAssignmentsForTeacherAccount } from "@/lib/subject-teacher-assignments-store";
import { listTeacherPortalReportsForTeacherAccount } from "@/lib/teacher-portal-reports-store";
import type {
  AcademicConfig,
  ResultLockRecord,
  StaffAccount,
  StudentAttendancePolicy,
  StudentAttendanceRegister,
  StudentProfileRecord,
  StudentReportEntry,
  StudentSummary,
  Subject,
  SubjectTeacherAssignment,
  TeacherPortalReportEntry,
} from "@/lib/types";

export interface TeacherWorkspaceData {
  academicConfig: AcademicConfig;
  assignments: SubjectTeacherAssignment[];
  accessibleClassNames: string[];
  attendancePolicy: StudentAttendancePolicy;
  resultLocks: ResultLockRecord[];
  schoolName: string;
  schoolTerm: string;
  scopedAttendanceRegisters: StudentAttendanceRegister[];
  scopedStudentProfiles: StudentProfileRecord[];
  scopedStudentReports: StudentReportEntry[];
  selectedAssignment: SubjectTeacherAssignment | null;
  selectedLock: ResultLockRecord | null;
  selectedSubject: Subject | null;
  selectedStudents: StudentSummary[];
  teacherPortalReports: TeacherPortalReportEntry[];
  correctionWindowOpen: boolean;
  counts: {
    assignments: number;
    openAssignments: number;
    lockedAssignments: number;
    returnedSheets: number;
    visibleStudents: number;
    studentReports: number;
    classTeacherArms: number;
    leadershipReports: number;
  };
}

export async function loadTeacherWorkspace(
  account: StaffAccount,
  assignmentQuery = "",
): Promise<TeacherWorkspaceData> {
  const [liveResults, assignments, resultLocks] = await Promise.all([
    getLiveResults(),
    listAssignmentsForTeacherAccount(account.id),
    readResultLocks(),
  ]);

  const { school, subjectSheets } = liveResults;
  const lockByClassName = new Map(resultLocks.map((lock) => [lock.className, lock]));
  const selectedAssignment =
    assignments.find((assignment) => assignment.id === assignmentQuery) ?? assignments[0] ?? null;
  const selectedSheet = selectedAssignment ? subjectSheets[selectedAssignment.id] ?? null : null;
  const selectedSubject: Subject | null = selectedAssignment
    ? {
        ...(subjects.find((subject) => subject.id === selectedAssignment.subjectId) ?? {
          id: selectedAssignment.subjectId,
          code: selectedAssignment.subjectCode,
          name: selectedAssignment.subjectName,
          weight: 1,
          className: selectedAssignment.className,
          teacherName: selectedAssignment.teacherName ?? account.fullName ?? "Assigned Teacher",
        }),
        className: selectedAssignment.className,
        teacherName: selectedAssignment.teacherName ?? account.fullName ?? "Assigned Teacher",
        section: selectedAssignment.section,
        track: selectedAssignment.track,
        isElective: selectedAssignment.subjectType === "elective",
      }
    : null;
  const selectedLock = selectedAssignment ? lockByClassName.get(selectedAssignment.className) ?? null : null;
  const correctionWindowOpen = Boolean(selectedSheet?.sheetStatus === "corrections_requested");
  const selectedStudents =
    selectedAssignment && selectedSubject
      ? liveResults.summaries.filter(
          (summary) =>
            summary.bundle.student.className === selectedAssignment.className &&
            summary.bundle.student.registeredSubjectIds.includes(selectedAssignment.subjectId),
        )
      : [];
  const accessibleClassNames = Array.from(
    new Set([
      ...assignments.map((assignment) => assignment.className),
      ...account.classTeacherArms,
    ]),
  );

  const [studentProfiles, studentReports, attendancePolicy, attendanceRegisters, teacherPortalReports] =
    await Promise.all([
      readStudentProfiles(),
      readStudentReports(),
      readStudentAttendancePolicy(),
      readStudentAttendanceRegisters(),
      listTeacherPortalReportsForTeacherAccount(account.id, account),
    ]);

  const scopedStudentProfiles = studentProfiles.filter(
    (profile) =>
      profile.schoolCode === account.schoolCode &&
      accessibleClassNames.includes(profile.className),
  );
  const scopedStudentReports = scopedStudentProfiles.length
    ? studentReports.filter((report) =>
        scopedStudentProfiles.some((profile) => profile.regNumber === report.regNumber),
      )
    : [];
  const scopedAttendanceRegisters = attendanceRegisters.filter((register) =>
    account.classTeacherArms.includes(register.className),
  );
  const counts = {
    assignments: assignments.length,
    openAssignments: assignments.filter(
      (assignment) => !(lockByClassName.get(assignment.className)?.locked ?? false),
    ).length,
    lockedAssignments: assignments.filter(
      (assignment) => lockByClassName.get(assignment.className)?.locked ?? false,
    ).length,
    returnedSheets: assignments.filter(
      (assignment) => subjectSheets[assignment.id]?.sheetStatus === "corrections_requested",
    ).length,
    visibleStudents: scopedStudentProfiles.length,
    studentReports: scopedStudentReports.length,
    classTeacherArms: account.classTeacherArms.length,
    leadershipReports: teacherPortalReports.length,
  };

  return {
    academicConfig: liveResults.academicConfig,
    assignments,
    accessibleClassNames,
    attendancePolicy,
    resultLocks,
    schoolName: school.shortName || school.name,
    schoolTerm: school.term,
    scopedAttendanceRegisters,
    scopedStudentProfiles,
    scopedStudentReports,
    selectedAssignment,
    selectedLock,
    selectedSubject,
    selectedStudents,
    teacherPortalReports,
    correctionWindowOpen,
    counts,
  };
}
