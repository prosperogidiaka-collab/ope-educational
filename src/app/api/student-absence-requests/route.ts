import { NextResponse } from "next/server";

import { getStudentProfile } from "@/lib/student-profiles-store";
import { getCurrentStudentPortalSession } from "@/lib/student-portal-auth-server";
import { saveStudentAbsenceRequest } from "@/lib/student-absence-requests-store";
import { getStudentPortalCredentialByRegNumber } from "@/lib/student-portal-credentials-store";
import type { StudentAbsenceRequest } from "@/lib/types";

function createAbsenceRequestId() {
  return `absence_req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request: Request) {
  const session = await getCurrentStudentPortalSession();

  if (!session) {
    return NextResponse.json({ error: "Student sign-in is required." }, { status: 401 });
  }

  const [profile, credential] = await Promise.all([
    getStudentProfile(session.regNumber),
    getStudentPortalCredentialByRegNumber(session.regNumber),
  ]);

  if (!profile || !credential) {
    return NextResponse.json({ error: "Student account could not be loaded." }, { status: 404 });
  }

  if (credential.accountState !== "active" || profile.studentStatus !== "active") {
    return NextResponse.json(
      { error: "This student account is currently not active for new absence requests." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    requestedFrom?: string;
    requestedTo?: string;
    reason?: string;
    note?: string;
    attachmentLabel?: string;
    attachmentUrl?: string;
    attachmentMimeType?: string;
    attachmentSizeBytes?: number;
  };
  const requestedFrom = body.requestedFrom?.trim() ?? "";
  const requestedTo = body.requestedTo?.trim() ?? "";
  const reason = body.reason?.trim() ?? "";

  if (!requestedFrom || !requestedTo || !reason) {
    return NextResponse.json(
      { error: "Start date, end date, and reason are required for an absence request." },
      { status: 400 },
    );
  }

  if (new Date(`${requestedTo}T12:00:00.000Z`) < new Date(`${requestedFrom}T12:00:00.000Z`)) {
    return NextResponse.json(
      { error: "The end date cannot be earlier than the start date." },
      { status: 400 },
    );
  }

  const timestamp = new Date().toISOString();
  const nextRequest: StudentAbsenceRequest = {
    id: createAbsenceRequestId(),
    schoolCode: profile.schoolCode,
    regNumber: profile.regNumber,
    studentName: profile.fullName,
    className: profile.className,
    requestedFrom,
    requestedTo,
    reason,
    note: body.note?.trim() || undefined,
    attachmentLabel: body.attachmentLabel?.trim() || undefined,
    attachmentUrl: body.attachmentUrl?.trim() || undefined,
    attachmentMimeType: body.attachmentMimeType?.trim() || undefined,
    attachmentSizeBytes:
      typeof body.attachmentSizeBytes === "number" ? body.attachmentSizeBytes : undefined,
    status: "pending",
    requestedAt: timestamp,
  };

  await saveStudentAbsenceRequest(nextRequest);
  return NextResponse.json({ request: nextRequest });
}
