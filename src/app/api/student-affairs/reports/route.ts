import { NextResponse } from "next/server";

import { canAccessSchool } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import {
  canPublishStudentResultComment,
  canWriteStudentReportForClass,
} from "@/lib/student-affairs-permissions";
import { getStudentProfile } from "@/lib/student-profiles-store";
import { saveStudentReport } from "@/lib/student-reports-store";
import type { StudentReportCategory, StudentReportEntry } from "@/lib/types";

const REPORT_CATEGORIES = new Set<StudentReportCategory>([
  "praise",
  "guidance",
  "discipline",
  "health",
  "result_comment",
  "general",
]);

function createReportId() {
  return `student_report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request: Request) {
  const [session, account] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json()) as {
    regNumber?: string;
    title?: string;
    body?: string;
    category?: StudentReportCategory;
    subjectName?: string;
    showOnPortal?: boolean;
    showOnResultSheet?: boolean;
    praise?: boolean;
    attachmentLabel?: string;
    attachmentUrl?: string;
    attachmentMimeType?: string;
    attachmentSizeBytes?: number;
  };

  const regNumber = body.regNumber?.trim() ?? "";
  const title = body.title?.trim() ?? "";
  const reportBody = body.body?.trim() ?? "";

  if (!regNumber || !title || !reportBody) {
    return NextResponse.json({ error: "Student, title, and report body are required." }, { status: 400 });
  }

  const profile = await getStudentProfile(regNumber);

  if (!profile) {
    return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
  }

  if (!canAccessSchool(account, profile.schoolCode)) {
    return NextResponse.json({ error: "This student is outside your school scope." }, { status: 403 });
  }

  const canWrite = await canWriteStudentReportForClass(account, profile.className);

  if (!canWrite) {
    return NextResponse.json(
      { error: "This account can only log reports for students inside its own assigned class scope." },
      { status: 403 },
    );
  }

  const category = body.category && REPORT_CATEGORIES.has(body.category) ? body.category : "general";
  const showOnPortal = Boolean(body.showOnPortal);
  const showOnResultSheet = Boolean(body.showOnResultSheet);

  if (showOnResultSheet && !canPublishStudentResultComment(account, profile.className)) {
    return NextResponse.json(
      { error: "Only the class teacher, school admin, or super admin can push a note onto the result sheet." },
      { status: 403 },
    );
  }

  const timestamp = new Date().toISOString();
  const nextReport: StudentReportEntry = {
    id: createReportId(),
    schoolCode: profile.schoolCode,
    regNumber: profile.regNumber,
    studentName: profile.fullName,
    className: profile.className,
    title,
    body: reportBody,
    category,
    authorAccountId: account.id,
    authorName: account.fullName,
    authorRole: account.role,
    subjectName: body.subjectName?.trim() || undefined,
    showOnPortal,
    showOnResultSheet,
    praise: Boolean(body.praise),
    attachmentLabel: body.attachmentLabel?.trim() || undefined,
    attachmentUrl: body.attachmentUrl?.trim() || undefined,
    attachmentMimeType: body.attachmentMimeType?.trim() || undefined,
    attachmentSizeBytes:
      typeof body.attachmentSizeBytes === "number" ? body.attachmentSizeBytes : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await saveStudentReport(nextReport);
  return NextResponse.json({ report: nextReport });
}
