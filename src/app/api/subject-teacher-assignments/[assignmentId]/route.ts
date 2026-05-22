import { NextResponse } from "next/server";

import { canAccessSchool, isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import {
  readStoredStaffAccounts,
  writeStoredStaffAccounts,
} from "@/lib/staff-accounts-store";
import {
  getTeacherScoreSheet,
  saveTeacherScoreSheet,
} from "@/lib/teacher-scores-store";
import {
  getSubjectTeacherAssignment,
  readSubjectTeacherAssignments,
  writeSubjectTeacherAssignments,
} from "@/lib/subject-teacher-assignments-store";
import type { StaffAccount, SubjectTeacherAssignment } from "@/lib/types";

interface RouteContext {
  params: Promise<{
    assignmentId: string;
  }>;
}

function canManageAssignments(account: Pick<StaffAccount, "role" | "canRegisterTeachers">) {
  return isSchoolAdminRole(account.role) || account.role === "registrar" || Boolean(account.canRegisterTeachers);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function refreshAccountTeachingScopes(
  account: Awaited<ReturnType<typeof readStoredStaffAccounts>>[number],
  assignments: SubjectTeacherAssignment[],
) {
  const teachingAssignments = assignments.filter(
    (assignment) => assignment.active !== false && assignment.teacherAccountId === account.id,
  );
  const teachingArms = uniqueStrings(teachingAssignments.map((assignment) => assignment.className));
  const teachingSubjects = uniqueStrings(
    teachingAssignments.map((assignment) => assignment.subjectName),
  );

  if (account.role === "teacher" || account.role === "class_teacher") {
    return {
      ...account,
      assignedArms: uniqueStrings([...account.classTeacherArms, ...teachingArms]),
      assignedSubjects: teachingSubjects,
    };
  }

  return {
    ...account,
    assignedArms: uniqueStrings([...account.assignedArms, ...teachingArms]),
    assignedSubjects: teachingSubjects,
  };
}

export async function PUT(request: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const assignmentId = decodeURIComponent(resolvedParams.assignmentId);
  const [session, account, assignment] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    getSubjectTeacherAssignment(assignmentId),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageAssignments(account)) {
    return NextResponse.json(
      { error: "Only the school admin, principal, or assigned registrar can change subject assignments." },
      { status: 403 },
    );
  }

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  if (!canAccessSchool(account, assignment.schoolCode)) {
    return NextResponse.json({ error: "This assignment does not belong to your school scope." }, { status: 403 });
  }

  const body = (await request.json()) as {
    teacherAccountId?: string | null;
  };
  const teacherAccountId = body.teacherAccountId?.trim() || null;
  const storedAccounts = await readStoredStaffAccounts();
  const nextTeacher =
    teacherAccountId === null
      ? null
      : storedAccounts.find((item) => item.id === teacherAccountId) ?? null;

  if (teacherAccountId && (!nextTeacher || nextTeacher.status !== "active")) {
    return NextResponse.json(
      { error: "Choose an active staff account for this assignment." },
      { status: 400 },
    );
  }

  if (nextTeacher && nextTeacher.schoolCode !== assignment.schoolCode) {
    return NextResponse.json(
      { error: "You can only assign a teacher account that belongs to the same school as this assignment." },
      { status: 400 },
    );
  }

  const timestamp = new Date().toISOString();
  const nextAssignment: SubjectTeacherAssignment = {
    ...assignment,
    teacherAccountId: nextTeacher?.id,
    teacherName: nextTeacher?.fullName,
    assignmentSource: "manual",
    manualOverride: true,
    assignedBy: account.fullName,
    assignedAt: teacherAccountId ? assignment.assignedAt ?? timestamp : undefined,
    updatedAt: timestamp,
  };

  const nextAssignments = (await readSubjectTeacherAssignments()).map((item) =>
    item.id === nextAssignment.id ? nextAssignment : item,
  );
  await writeSubjectTeacherAssignments(nextAssignments);

  const teacherSheet = await getTeacherScoreSheet(nextAssignment.id);
  if (teacherSheet) {
    await saveTeacherScoreSheet(nextAssignment.id, {
      ...teacherSheet,
      teacherName: nextAssignment.teacherName ?? "Unassigned",
      subjectName: nextAssignment.subjectName,
      subjectCode: nextAssignment.subjectCode,
      className: nextAssignment.className,
      updatedAt: timestamp,
    });
  }

  const nextAccounts = storedAccounts.map((item) =>
    refreshAccountTeachingScopes(item, nextAssignments),
  );
  await writeStoredStaffAccounts(nextAccounts);

  return NextResponse.json({
    assignment: nextAssignment,
    accounts: nextAccounts
      .filter((item) => item.role !== "super_admin" && canAccessSchool(account, item.schoolCode))
      .map(({ password: _password, ...publicAccount }) => publicAccount),
  });
}

export async function GET(_: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const assignmentId = decodeURIComponent(resolvedParams.assignmentId);
  const [session, account, assignment] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    getSubjectTeacherAssignment(assignmentId),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  if (!canAccessSchool(account, assignment.schoolCode)) {
    return NextResponse.json({ error: "This assignment does not belong to your school scope." }, { status: 403 });
  }

  return NextResponse.json({ assignment });
}
