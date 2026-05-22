import { NextResponse } from "next/server";

import { isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { getClassOffering, saveClassOffering } from "@/lib/class-offerings-store";
import {
  getSubjectTeacherAssignment,
  readSubjectTeacherAssignments,
  writeSubjectTeacherAssignments,
} from "@/lib/subject-teacher-assignments-store";
import type { ClassOffering, SubjectTeacherAssignment, SubjectRegistrationType } from "@/lib/types";

interface RouteContext {
  params: Promise<{
    assignmentId: string;
  }>;
}

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

  if (!canManageSubjectRegistration(account)) {
    return NextResponse.json(
      { error: "Only the school admin, principal, or assigned registrar can update subject registration." },
      { status: 403 },
    );
  }

  if (!assignment) {
    return NextResponse.json({ error: "Subject registration row not found." }, { status: 404 });
  }

  const offering = await getClassOffering(assignment.className);

  if (!offering) {
    return NextResponse.json({ error: "The linked class arm could not be found." }, { status: 400 });
  }

  const body = (await request.json()) as Partial<SubjectTeacherAssignment>;
  const timestamp = new Date().toISOString();
  const nextAssignment: SubjectTeacherAssignment = {
    ...assignment,
    subjectCode: body.subjectCode?.trim() || assignment.subjectCode,
    subjectName: body.subjectName?.trim() || assignment.subjectName,
    track: body.track?.trim() || undefined,
    subjectType: (body.subjectType as SubjectRegistrationType) === "elective" ? "elective" : "core",
    active: body.active !== false,
    assignmentSource: "manual",
    updatedAt: timestamp,
  };

  const assignments = await readSubjectTeacherAssignments();
  const nextAssignments = assignments.map((item) => (item.id === assignmentId ? nextAssignment : item));

  await writeSubjectTeacherAssignments(nextAssignments);
  await saveClassOffering(buildOfferingSnapshot(offering, account.fullName, nextAssignments), offering.className, offering.session);

  return NextResponse.json({ assignment: nextAssignment });
}
