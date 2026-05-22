import { NextResponse } from "next/server";

import { canAccessSchool, isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import {
  getStoredStaffAccountById,
  readStoredStaffAccounts,
  writeStoredStaffAccounts,
} from "@/lib/staff-accounts-store";
import type { StaffAccount } from "@/lib/types";

interface RouteContext {
  params: Promise<{
    accountId: string;
  }>;
}

interface StaffAccountUpdatePayload {
  photoUrl?: string;
}

function canManageStaffProfiles(account: Pick<StaffAccount, "role" | "canRegisterTeachers" | "canDisableTeachers">) {
  return isSchoolAdminRole(account.role) || Boolean(account.canRegisterTeachers) || Boolean(account.canDisableTeachers);
}

export async function GET(_: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const [session, account, targetAccount] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    getStoredStaffAccountById(decodeURIComponent(resolvedParams.accountId)),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!targetAccount) {
    return NextResponse.json({ error: "Staff account not found." }, { status: 404 });
  }

  if (!canAccessSchool(account, targetAccount.schoolCode)) {
    return NextResponse.json({ error: "This staff account is outside your school scope." }, { status: 403 });
  }

  const { password: _password, ...publicAccount } = targetAccount;
  return NextResponse.json({ account: publicAccount });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const [session, account, targetAccount] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    getStoredStaffAccountById(decodeURIComponent(resolvedParams.accountId)),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!targetAccount) {
    return NextResponse.json({ error: "Staff account not found." }, { status: 404 });
  }

  if (!canAccessSchool(account, targetAccount.schoolCode)) {
    return NextResponse.json({ error: "This staff account is outside your school scope." }, { status: 403 });
  }

  if (!canManageStaffProfiles(account)) {
    return NextResponse.json({ error: "Only the school admin can update staff profile photos." }, { status: 403 });
  }

  const body = (await request.json()) as StaffAccountUpdatePayload;
  const nextPhotoUrl = typeof body.photoUrl === "string" ? body.photoUrl.trim() : targetAccount.photoUrl;
  const accounts = await readStoredStaffAccounts();
  const nextAccount = {
    ...targetAccount,
    photoUrl: nextPhotoUrl || undefined,
    lastAction: `${account.fullName} updated the staff profile photo on ${new Date().toISOString()}.`,
  };

  await writeStoredStaffAccounts(accounts.map((item) => (item.id === targetAccount.id ? nextAccount : item)));

  const { password: _password, ...publicAccount } = nextAccount;
  return NextResponse.json({ account: publicAccount });
}
