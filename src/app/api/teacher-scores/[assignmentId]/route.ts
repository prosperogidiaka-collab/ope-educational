import { NextResponse } from "next/server";

import { normalizeComponentScoreMap } from "@/lib/academic-config";
import { canAccess, canAccessSchool, isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { getResultLockForClass } from "@/lib/result-locks-store";
import {
  deleteTeacherScoreSheet,
  getTeacherScoreSheet,
  saveTeacherScoreSheet,
} from "@/lib/teacher-scores-store";
import type { TeacherScoreSheetDraft, TeacherScoreSheetRow } from "@/lib/teacher-scores";
import { getSubjectTeacherAssignment } from "@/lib/subject-teacher-assignments-store";

interface RouteContext {
  params: Promise<{
    assignmentId: string;
  }>;
}

function normalizeRows(rows: TeacherScoreSheetRow[] | undefined) {
  return (rows ?? []).map((row) => ({
    regNumber: row.regNumber,
    fullName: row.fullName,
    componentScores: normalizeComponentScoreMap(row.componentScores, undefined, {
      test1: row.test1,
      test2: row.test2,
      exam: row.exam,
    }),
    test1: row.test1,
    test2: row.test2,
    exam: row.exam,
    teacherComment: row.teacherComment,
    status: row.status,
  }));
}

function rowsChanged(
  incomingRows: TeacherScoreSheetRow[] | undefined,
  existingRows: TeacherScoreSheetRow[] | undefined,
) {
  return JSON.stringify(normalizeRows(incomingRows)) !== JSON.stringify(normalizeRows(existingRows));
}

async function getActorContext(assignmentId: string) {
  const [session, account, assignment, existingSheet] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    getSubjectTeacherAssignment(assignmentId),
    getTeacherScoreSheet(assignmentId),
  ]);

  if (!session || !account || account.status !== "active") {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }

  if (!assignment) {
    return { error: NextResponse.json({ error: "Assignment not found." }, { status: 404 }) };
  }

  if (!canAccessSchool(account, assignment.schoolCode)) {
    return { error: NextResponse.json({ error: "This score sheet does not belong to your school scope." }, { status: 403 }) };
  }

  const resultLock = await getResultLockForClass(assignment.className);

  return {
    session,
    account,
    assignment,
    existingSheet,
    resultLock,
    isAssignedTeacher: assignment.teacherAccountId === account.id,
    canReview: canAccess(session.role, "/dashboard/score-review"),
    canOverride: isSchoolAdminRole(session.role),
  };
}

export async function GET(_: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const assignmentId = decodeURIComponent(resolvedParams.assignmentId);
  const context = await getActorContext(assignmentId);

  if ("error" in context) {
    return context.error;
  }

  if (!context.isAssignedTeacher && !context.canReview) {
    return NextResponse.json({ error: "You do not have access to this teacher sheet." }, { status: 403 });
  }

  return NextResponse.json({ sheet: context.existingSheet, lock: context.resultLock });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const assignmentId = decodeURIComponent(resolvedParams.assignmentId);
  const context = await getActorContext(assignmentId);

  if ("error" in context) {
    return context.error;
  }

  const incoming = (await request.json()) as TeacherScoreSheetDraft;
  const rowMutation = rowsChanged(incoming.rows, context.existingSheet?.rows);

  if (rowMutation && !context.isAssignedTeacher && !context.canOverride) {
    return NextResponse.json(
      { error: "Only the assigned subject teacher or school-admin override desk can change this score sheet." },
      { status: 403 },
    );
  }

  if (!rowMutation && !context.isAssignedTeacher && !context.canReview) {
    return NextResponse.json({ error: "You do not have permission to update this sheet." }, { status: 403 });
  }

  if (context.resultLock?.locked && rowMutation && !context.canOverride) {
    return NextResponse.json(
      {
        error: `Results are locked for ${context.assignment.className}. The school admin must reopen them before scores can change.`,
      },
      { status: 423 },
    );
  }

  const timestamp = new Date().toISOString();
  const inheritedTeacherName =
    context.assignment.teacherName ??
    context.existingSheet?.teacherName ??
    incoming.teacherName ??
    context.account.fullName;
  const inheritedLastEditor = context.existingSheet?.lastEditedBy ?? incoming.lastEditedBy;
  const inheritedLastEditorRole = context.existingSheet?.lastEditedByRole ?? incoming.lastEditedByRole;
  const reviewerName =
    context.canOverride && rowMutation
      ? context.account.fullName
      : incoming.reviewedBy ?? context.existingSheet?.reviewedBy;
  const reviewerRole =
    context.canOverride && rowMutation
      ? context.session.role
      : incoming.reviewedByRole ?? context.existingSheet?.reviewedByRole;
  const reviewedAt =
    context.canOverride && rowMutation
      ? timestamp
      : incoming.reviewedAt ?? context.existingSheet?.reviewedAt;
  const draft: TeacherScoreSheetDraft = {
    ...incoming,
    assignmentId,
    subjectCode: context.assignment.subjectCode,
    subjectName: context.assignment.subjectName,
    className: context.assignment.className,
    teacherName: inheritedTeacherName,
    rows: incoming.rows,
    updatedAt: timestamp,
    submittedAt:
      incoming.sheetStatus === "submitted"
        ? context.existingSheet?.submittedAt ?? timestamp
        : incoming.sheetStatus === "draft"
          ? undefined
          : context.existingSheet?.submittedAt ?? incoming.submittedAt,
    lastEditedBy: rowMutation ? context.account.fullName : inheritedLastEditor,
    lastEditedByRole: rowMutation ? context.session.role : inheritedLastEditorRole,
    reviewNote: incoming.reviewNote ?? context.existingSheet?.reviewNote,
    reviewedBy: reviewerName,
    reviewedByRole: reviewerRole,
    reviewedAt,
  };
  const saved = await saveTeacherScoreSheet(assignmentId, draft);

  return NextResponse.json({ sheet: saved, lock: context.resultLock });
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const assignmentId = decodeURIComponent(resolvedParams.assignmentId);
  const context = await getActorContext(assignmentId);

  if ("error" in context) {
    return context.error;
  }

  if (!context.canReview) {
    return NextResponse.json({ error: "Only reviewers can delete teacher sheets." }, { status: 403 });
  }

  await deleteTeacherScoreSheet(assignmentId);

  return NextResponse.json({ ok: true });
}
