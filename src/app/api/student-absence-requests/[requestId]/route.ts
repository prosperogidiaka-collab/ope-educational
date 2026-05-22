import { NextResponse } from "next/server";

import { canAccessSchool } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { getStudentAbsenceRequestById, saveStudentAbsenceRequest } from "@/lib/student-absence-requests-store";
import { canDecideStudentAbsenceRequests } from "@/lib/student-affairs-permissions";
import type { StudentAbsenceRequestStatus } from "@/lib/types";

interface RouteContext {
  params: Promise<{
    requestId: string;
  }>;
}

const REQUEST_STATUSES = new Set<StudentAbsenceRequestStatus>(["pending", "approved", "rejected"]);

export async function PUT(request: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const requestId = decodeURIComponent(resolvedParams.requestId);
  const [session, account, absenceRequest] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    getStudentAbsenceRequestById(requestId),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!absenceRequest) {
    return NextResponse.json({ error: "Absence request not found." }, { status: 404 });
  }

  if (!canAccessSchool(account, absenceRequest.schoolCode)) {
    return NextResponse.json({ error: "This absence request is outside your school scope." }, { status: 403 });
  }

  if (!canDecideStudentAbsenceRequests(account)) {
    return NextResponse.json(
      { error: "Only the school admin, super admin, or assigned student-affairs officer can decide this request." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    status?: StudentAbsenceRequestStatus;
    decisionNote?: string;
  };
  const nextStatus = body.status && REQUEST_STATUSES.has(body.status) ? body.status : absenceRequest.status;
  const nextRequest = {
    ...absenceRequest,
    status: nextStatus,
    decidedAt: nextStatus === "pending" ? undefined : new Date().toISOString(),
    decidedBy: nextStatus === "pending" ? undefined : account.fullName,
    decisionNote: body.decisionNote?.trim() || absenceRequest.decisionNote,
  };

  await saveStudentAbsenceRequest(nextRequest);
  return NextResponse.json({ request: nextRequest });
}
