import { NextResponse } from "next/server";

import { isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { saveSchoolLog } from "@/lib/school-logs-store";
import type { SchoolLogEntry } from "@/lib/types";

function canManageSchoolLogs(account: NonNullable<Awaited<ReturnType<typeof getCurrentStaffAccount>>>) {
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

  if (!canManageSchoolLogs(account)) {
    return NextResponse.json(
      { error: "Only the school admin, principal, or registrar can save school logs." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as Partial<SchoolLogEntry>;
  const title = body.title?.trim() ?? "";
  const logDate = body.logDate?.trim() ?? "";
  const entryBody = body.body?.trim() ?? "";

  if (!title || !logDate || !entryBody) {
    return NextResponse.json({ error: "Title, date, and notes are required." }, { status: 400 });
  }

  const timestamp = new Date().toISOString();
  const nextEntry: SchoolLogEntry = {
    id: `school_log_${timestamp}_${title}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase(),
    schoolCode: account.schoolCode,
    category: body.category ?? "general",
    title,
    body: entryBody,
    logDate,
    reportingWindow: body.reportingWindow?.trim() || undefined,
    visitorName: body.visitorName?.trim() || undefined,
    visitorPurpose: body.visitorPurpose?.trim() || undefined,
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

  const saved = await saveSchoolLog(nextEntry);
  return NextResponse.json({ entry: saved });
}
