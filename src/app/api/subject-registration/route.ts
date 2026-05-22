import { NextResponse } from "next/server";

import { isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { getClassOffering, saveClassOffering } from "@/lib/class-offerings-store";
import {
  readSubjectTeacherAssignments,
  writeSubjectTeacherAssignments,
} from "@/lib/subject-teacher-assignments-store";
import type { ClassOffering, SubjectTeacherAssignment, SubjectRegistrationType } from "@/lib/types";

function canManageSubjectRegistration(account: NonNullable<Awaited<ReturnType<typeof getCurrentStaffAccount>>>) {
  return isSchoolAdminRole(account.role) || account.role === "registrar" || Boolean(account.canRegisterStudents);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildOfferingSnapshot(
  offering: ClassOffering,
  actorName: string,
  assignments: SubjectTeacherAssignment[],
) {
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

function buildAssignmentId(className: string, subjectName: string, track?: string) {
  return `manual_${className}_${subjectName}_${track || "general"}`
    .replace(/[^a-z0-9]+/gi, "_")
    .toLowerCase();
}

export async function POST(request: Request) {
  const [session, account] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageSubjectRegistration(account)) {
    return NextResponse.json(
      { error: "Only the school admin, principal, or assigned registrar can register subjects." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as Partial<SubjectTeacherAssignment>;
  const className = body.className?.trim() ?? "";
  const subjectName = body.subjectName?.trim() ?? "";
  const subjectCode = body.subjectCode?.trim() ?? "";

  if (!className || !subjectName || !subjectCode) {
    return NextResponse.json({ error: "Class arm, subject name, and subject code are required." }, { status: 400 });
  }

  const offering = await getClassOffering(className);

  if (!offering) {
    return NextResponse.json({ error: "Choose a valid class arm first." }, { status: 400 });
  }

  const assignments = await readSubjectTeacherAssignments();
  const duplicate = assignments.find(
    (assignment) =>
      assignment.className === className &&
      assignment.subjectName.toLowerCase() === subjectName.toLowerCase() &&
      (assignment.track ?? "").toLowerCase() === (body.track?.trim().toLowerCase() ?? ""),
  );

  if (duplicate) {
    return NextResponse.json({ error: "That subject already exists for the selected class arm and track." }, { status: 400 });
  }

  const timestamp = new Date().toISOString();
  const assignmentId = buildAssignmentId(className, subjectName, body.track?.trim());
  const nextAssignment: SubjectTeacherAssignment = {
    id: assignmentId,
    schoolCode: account.schoolCode,
    subjectId: assignmentId,
    subjectCode,
    subjectName,
    className,
    arm: offering.arm,
    section: offering.section,
    track: body.track?.trim() || undefined,
    subjectType: (body.subjectType as SubjectRegistrationType) === "elective" ? "elective" : "core",
    active: body.active !== false,
    assignmentSource: "manual",
    manualOverride: false,
    teacherAccountId: undefined,
    teacherName: undefined,
    assignedBy: account.fullName,
    assignedAt: timestamp,
    updatedAt: timestamp,
  };

  const nextAssignments = [...assignments, nextAssignment];
  await writeSubjectTeacherAssignments(nextAssignments);
  await saveClassOffering(buildOfferingSnapshot(offering, account.fullName, nextAssignments), offering.className, offering.session);

  return NextResponse.json({ assignment: nextAssignment });
}
