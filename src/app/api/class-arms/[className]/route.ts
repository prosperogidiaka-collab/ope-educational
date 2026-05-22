import { NextResponse } from "next/server";

import { isSchoolAdminRole } from "@/lib/auth";
import { readAcademicConfig } from "@/lib/academic-config-store";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { combineClassArm, inferBaseClassName } from "@/lib/class-structure";
import {
  getClassOffering,
  readClassOfferings,
  saveClassOffering,
} from "@/lib/class-offerings-store";
import { readResultLocks, writeResultLocks } from "@/lib/result-locks-store";
import { getSchoolClass } from "@/lib/school-classes-store";
import {
  readStoredStaffAccounts,
  type StoredStaffAccount,
  writeStoredStaffAccounts,
} from "@/lib/staff-accounts-store";
import {
  readStudentAbsenceRequests,
  writeStudentAbsenceRequests,
} from "@/lib/student-absence-requests-store";
import {
  readStudentAttendanceRegisters,
  writeStudentAttendanceRegisters,
} from "@/lib/student-attendance-store";
import { readStudentProfiles, writeStudentProfiles } from "@/lib/student-profiles-store";
import { readStudentReports, writeStudentReports } from "@/lib/student-reports-store";
import {
  readSubjectTeacherAssignments,
  writeSubjectTeacherAssignments,
} from "@/lib/subject-teacher-assignments-store";
import { readTeacherScoresStore, writeTeacherScoresStore } from "@/lib/teacher-scores-store";
import type { ClassOffering, GradeSection } from "@/lib/types";

interface RouteContext {
  params: Promise<{
    className: string;
  }>;
}

function canManageClassArms(account: NonNullable<Awaited<ReturnType<typeof getCurrentStaffAccount>>>) {
  return isSchoolAdminRole(account.role) || account.role === "registrar" || Boolean(account.canRegisterStudents);
}

function lockId(className: string, session: string, term: string) {
  return `${className}-${session}-${term}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
}

function attendanceRegisterId(className: string, date: string) {
  return `${className}-${date}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function replaceArmValue(values: string[], oldClassName: string, nextClassName: string) {
  return uniqueStrings(values.map((value) => (value === oldClassName ? nextClassName : value)));
}

function buildOfferingSnapshot(offering: ClassOffering, actorName: string, assignments: Awaited<ReturnType<typeof readSubjectTeacherAssignments>>) {
  const classAssignments = assignments.filter(
    (assignment) => assignment.className === offering.className && assignment.active !== false,
  );
  const assignedCount = classAssignments.filter((assignment) => assignment.teacherAccountId).length;

  return {
    ...offering,
    subjectIds: uniqueStrings(classAssignments.map((assignment) => assignment.subjectId)),
    electiveSubjectIds: uniqueStrings(
      classAssignments
        .filter((assignment) => assignment.subjectType === "elective")
        .map((assignment) => assignment.subjectId),
    ),
    pendingTeachers: uniqueStrings(
      classAssignments
        .filter((assignment) => !assignment.teacherAccountId)
        .map((assignment) => assignment.subjectName),
    ),
    publicationProgress: classAssignments.length
      ? Math.round((assignedCount / classAssignments.length) * 100)
      : 0,
    updatedAt: new Date().toISOString(),
    updatedBy: actorName,
  };
}

function updateClassTeacherScopes(
  accounts: StoredStaffAccount[],
  previousClassTeacher: string,
  nextClassTeacher: string,
  oldClassName: string,
  nextClassName: string,
) {
  return accounts.map((account) => {
    let nextAssignedArms = replaceArmValue(account.assignedArms, oldClassName, nextClassName);
    let nextClassTeacherArms = replaceArmValue(account.classTeacherArms, oldClassName, nextClassName);

    if (account.fullName === previousClassTeacher && previousClassTeacher !== nextClassTeacher) {
      nextClassTeacherArms = nextClassTeacherArms.filter((value) => value !== nextClassName);
    }

    if (account.fullName === nextClassTeacher) {
      nextClassTeacherArms = uniqueStrings([...nextClassTeacherArms, nextClassName]);
      nextAssignedArms = uniqueStrings([...nextAssignedArms, nextClassName]);
    }

    return {
      ...account,
      assignedArms: nextAssignedArms,
      classTeacherArms: nextClassTeacherArms,
    };
  });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const requestedClassName = decodeURIComponent(resolvedParams.className);
  const [session, account, config, currentOffering, currentOfferings] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readAcademicConfig(),
    getClassOffering(requestedClassName),
    readClassOfferings(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageClassArms(account)) {
    return NextResponse.json(
      { error: "Only the school admin, principal, or assigned registrar can edit class arms." },
      { status: 403 },
    );
  }

  if (!currentOffering) {
    return NextResponse.json({ error: "Class arm not found." }, { status: 404 });
  }

  const body = (await request.json()) as Partial<ClassOffering>;
  const nextBaseClassName =
    body.baseClassName?.trim().replace(/\s+/g, " ") ||
    currentOffering.baseClassName ||
    inferBaseClassName(currentOffering.className, currentOffering.arm);
  const nextArm = body.arm?.trim() || currentOffering.arm;
  const nextClassName = combineClassArm(nextBaseClassName, nextArm) || currentOffering.className;
  const nextSection =
    body.section === "junior" || body.section === "senior" ? body.section : currentOffering.section;
  const nextTrack = body.track?.trim() || currentOffering.track;
  const nextClassTeacher =
    body.classTeacher === undefined ? currentOffering.classTeacher : (body.classTeacher?.trim() ?? "");
  const nextHod = body.hod === undefined ? currentOffering.hod : (body.hod?.trim() ?? "");
  const nextStatus = body.status === "retired" ? "retired" : "active";

  const schoolClass = await getSchoolClass(nextBaseClassName);

  if (!schoolClass) {
    return NextResponse.json({ error: "Select a valid existing class for this arm." }, { status: 400 });
  }

  if (
    nextClassName.toLowerCase() !== currentOffering.className.toLowerCase() &&
    currentOfferings.some((offering) => offering.className.toLowerCase() === nextClassName.toLowerCase())
  ) {
    return NextResponse.json({ error: "Another class arm already uses that class label." }, { status: 400 });
  }

  const [
    assignments,
    studentProfiles,
    studentReports,
    studentAbsenceRequests,
    attendanceRegisters,
    resultLocks,
    teacherScoresStore,
    storedAccounts,
  ] = await Promise.all([
    readSubjectTeacherAssignments(),
    readStudentProfiles(),
    readStudentReports(),
    readStudentAbsenceRequests(),
    readStudentAttendanceRegisters(),
    readResultLocks(),
    readTeacherScoresStore(),
    readStoredStaffAccounts(),
  ]);

  const nextAssignments = assignments.map((assignment) =>
    assignment.className === currentOffering.className
      ? {
          ...assignment,
          className: nextClassName,
          arm: nextArm,
          section: nextSection as GradeSection,
          track: nextTrack,
          active: nextStatus === "retired" ? false : assignment.active ?? true,
          updatedAt: new Date().toISOString(),
        }
      : assignment,
  );

  const nextOffering = buildOfferingSnapshot(
    {
      ...currentOffering,
      baseClassName: nextBaseClassName,
      className: nextClassName,
      arm: nextArm,
      section: nextSection as GradeSection,
      track: nextTrack,
      classTeacher: nextClassTeacher,
      hod: nextHod,
      status: nextStatus,
      session: config.session,
    },
    account.fullName,
    nextAssignments,
  );

  const nextProfiles = studentProfiles.map((profile) =>
    profile.className === currentOffering.className
      ? {
          ...profile,
          className: nextClassName,
          arm: nextArm,
          section: nextSection as GradeSection,
          track: nextTrack,
          updatedAt: new Date().toISOString(),
        }
      : profile,
  );
  const nextReports = studentReports.map((report) =>
    report.className === currentOffering.className
      ? { ...report, className: nextClassName }
      : report,
  );
  const nextAbsenceRequests = studentAbsenceRequests.map((absenceRequest) =>
    absenceRequest.className === currentOffering.className
      ? { ...absenceRequest, className: nextClassName }
      : absenceRequest,
  );
  const nextAttendanceRegisters = attendanceRegisters.map((register) =>
    register.className === currentOffering.className
      ? {
          ...register,
          id: attendanceRegisterId(nextClassName, register.date),
          className: nextClassName,
          arm: nextArm,
        }
      : register,
  );
  const nextResultLocks = resultLocks.map((lock) =>
    lock.className === currentOffering.className
      ? {
          ...lock,
          id: lockId(nextClassName, lock.session, lock.term),
          className: nextClassName,
        }
      : lock,
  );
  const nextTeacherScoresStore = Object.fromEntries(
    Object.entries(teacherScoresStore).map(([assignmentId, sheet]) => [
      assignmentId,
      sheet.className === currentOffering.className
        ? {
            ...sheet,
            className: nextClassName,
            updatedAt: new Date().toISOString(),
          }
        : sheet,
    ]),
  );
  const nextStoredAccounts = updateClassTeacherScopes(
    storedAccounts,
    currentOffering.classTeacher,
    nextClassTeacher,
    currentOffering.className,
    nextClassName,
  );

  await Promise.all([
    writeSubjectTeacherAssignments(nextAssignments),
    writeStudentProfiles(nextProfiles),
    writeStudentReports(nextReports),
    writeStudentAbsenceRequests(nextAbsenceRequests),
    writeStudentAttendanceRegisters(nextAttendanceRegisters),
    writeResultLocks(nextResultLocks),
    writeTeacherScoresStore(nextTeacherScoresStore),
    writeStoredStaffAccounts(nextStoredAccounts),
    saveClassOffering(nextOffering, currentOffering.className, currentOffering.session),
  ]);

  return NextResponse.json({ offering: nextOffering });
}
