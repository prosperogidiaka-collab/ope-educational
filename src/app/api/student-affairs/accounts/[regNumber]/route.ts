import { NextResponse } from "next/server";

import { canAccessSchool } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { canManageStudentRecords } from "@/lib/student-affairs-permissions";
import { getStudentProfile } from "@/lib/student-profiles-store";
import {
  getStudentPortalCredentialByRegNumber,
  saveStudentPortalCredential,
} from "@/lib/student-portal-credentials-store";
import type { StudentPortalCredential } from "@/lib/types";

interface RouteContext {
  params: Promise<{
    regNumber: string;
  }>;
}

const CREDENTIAL_STATUSES = new Set<StudentPortalCredential["status"]>([
  "ready",
  "sent",
  "reset_required",
]);
const ACCOUNT_STATES = new Set<StudentPortalCredential["accountState"]>(["active", "disabled"]);

export async function PUT(request: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const regNumber = decodeURIComponent(resolvedParams.regNumber);
  const [session, account, credential, profile] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    getStudentPortalCredentialByRegNumber(regNumber),
    getStudentProfile(regNumber),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!credential) {
    return NextResponse.json({ error: "Student account not found." }, { status: 404 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Student profile not found for this account." }, { status: 404 });
  }

  if (!canAccessSchool(account, credential.schoolCode)) {
    return NextResponse.json({ error: "This student account is outside your school scope." }, { status: 403 });
  }

  if (!canManageStudentRecords(account)) {
    return NextResponse.json(
      { error: "Only the school admin, super admin, or registrar can manage student login details." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as Partial<StudentPortalCredential>;
  const nextStatus = body.status && CREDENTIAL_STATUSES.has(body.status) ? body.status : credential.status;
  let nextAccountState =
    body.accountState && ACCOUNT_STATES.has(body.accountState)
      ? body.accountState
      : credential.accountState;

  if (nextAccountState === "active" && profile.studentStatus !== "active") {
    return NextResponse.json(
      {
        error: `This portal account cannot be reactivated while the student profile is marked as ${profile.studentStatus}.`,
      },
      { status: 400 },
    );
  }

  const nextPassword =
    typeof body.temporaryPassword === "string" && body.temporaryPassword.trim()
      ? body.temporaryPassword.trim()
      : credential.temporaryPassword;
  const nextCredential: StudentPortalCredential = {
    ...credential,
    username:
      typeof body.username === "string" && body.username.trim()
        ? body.username.trim()
        : credential.username,
    temporaryPassword: nextPassword,
    status: nextStatus,
    accountState: nextAccountState,
    couponCode:
      typeof body.couponCode === "string"
        ? body.couponCode.trim().toUpperCase()
        : credential.couponCode,
    disabledReason:
      nextAccountState === "active"
        ? undefined
        : typeof body.disabledReason === "string"
          ? body.disabledReason.trim() || credential.disabledReason || "Portal access disabled from Students Affairs."
          : credential.disabledReason,
    generatedBy: account.fullName,
    generatedAt: new Date().toISOString(),
    lastLoginAt: credential.lastLoginAt,
  };

  await saveStudentPortalCredential(nextCredential);
  return NextResponse.json({ credential: nextCredential });
}
