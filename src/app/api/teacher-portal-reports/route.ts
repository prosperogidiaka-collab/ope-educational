import { NextResponse } from "next/server";

import { isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { readVisibleStaffAccounts } from "@/lib/staff-accounts-store";
import { saveTeacherPortalReport } from "@/lib/teacher-portal-reports-store";
import type { TeacherPortalReportEntry } from "@/lib/types";

function canManageTeacherReports(account: NonNullable<Awaited<ReturnType<typeof getCurrentStaffAccount>>>) {
  return isSchoolAdminRole(account.role) || account.role === "registrar";
}

export async function POST(request: Request) {
  const [session, account] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageTeacherReports(account)) {
    return NextResponse.json(
      { error: "Only the school admin, principal, or registrar can save teacher reports." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as Partial<TeacherPortalReportEntry>;
  const title = body.title?.trim() ?? "";
  const teacherAccountId = body.teacherAccountId?.trim() ?? "";
  const reportBody = body.body?.trim() ?? "";

  if (!title || !teacherAccountId || !reportBody) {
    return NextResponse.json({ error: "Teacher, title, and report body are required." }, { status: 400 });
  }

  const teacherAccounts = await readVisibleStaffAccounts(account);
  const teacherAccount = teacherAccounts.find((item) => item.id === teacherAccountId);

  if (!teacherAccount) {
    return NextResponse.json({ error: "Choose a valid teacher account." }, { status: 400 });
  }

  const timestamp = new Date().toISOString();
  const nextEntry: TeacherPortalReportEntry = {
    id: `teacher_report_${timestamp}_${teacherAccountId}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase(),
    schoolCode: account.schoolCode,
    teacherAccountId,
    teacherName: teacherAccount.fullName,
    category: body.category ?? "general",
    title,
    body: reportBody,
    showOnTeacherPortal: body.showOnTeacherPortal !== false,
    attachmentLabel: body.attachmentLabel?.trim() || undefined,
    attachmentUrl: body.attachmentUrl?.trim() || undefined,
    attachmentMimeType: body.attachmentMimeType?.trim() || undefined,
    attachmentSizeBytes: body.attachmentSizeBytes,
    authorAccountId: account.id,
    authorName: account.fullName,
    authorRole: account.role,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const saved = await saveTeacherPortalReport(nextEntry);
  return NextResponse.json({ entry: saved });
}
