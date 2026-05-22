import { NextResponse } from "next/server";

import {
  getStoredStaffAccountById,
  readStoredStaffAccounts,
  writeStoredStaffAccounts,
} from "@/lib/staff-accounts-store";
import { requirePlatformSuperAdmin } from "@/lib/super-admin-access";
import type { AccountStatus, StaffAccount } from "@/lib/types";

interface RouteContext {
  params: Promise<{
    accountId: string;
  }>;
}

interface AccountUpdatePayload {
  status?: AccountStatus;
  grantedSchoolCodes?: string[];
  lastAction?: string;
}

function normalizeSchoolCodes(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

export async function GET(_: Request, { params }: RouteContext) {
  const access = await requirePlatformSuperAdmin();

  if ("error" in access) {
    return access.error;
  }

  const resolvedParams = await params;
  const account = await getStoredStaffAccountById(decodeURIComponent(resolvedParams.accountId));

  if (!account) {
    return NextResponse.json({ error: "Staff account not found." }, { status: 404 });
  }

  const { password: _password, ...publicAccount } = account;
  return NextResponse.json({ account: publicAccount });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const access = await requirePlatformSuperAdmin();

  if ("error" in access) {
    return access.error;
  }

  const resolvedParams = await params;
  const accountId = decodeURIComponent(resolvedParams.accountId);
  const body = (await request.json()) as AccountUpdatePayload;
  const accounts = await readStoredStaffAccounts();
  const current = accounts.find((item) => item.id === accountId);

  if (!current) {
    return NextResponse.json({ error: "Staff account not found." }, { status: 404 });
  }

  if (current.role === "super_admin") {
    return NextResponse.json({ error: "The platform super admin account cannot be edited here." }, { status: 400 });
  }

  const nextGrantedSchoolCodes = normalizeSchoolCodes(body.grantedSchoolCodes);
  const nextStatus = body.status ?? current.status;
  const nextAccount = {
    ...current,
    status: nextStatus,
    grantedSchoolCodes: nextGrantedSchoolCodes,
    lastAction:
      body.lastAction?.trim() ||
      (nextStatus !== current.status
        ? `${access.account.fullName} changed account status to ${nextStatus}.`
        : nextGrantedSchoolCodes.length !== (current.grantedSchoolCodes ?? []).length
          ? `${access.account.fullName} updated cross-school access scope.`
          : current.lastAction),
  };

  await writeStoredStaffAccounts(
    accounts.map((item) => (item.id === accountId ? nextAccount : item)),
  );

  const { password: _password, ...publicAccount } = nextAccount;
  return NextResponse.json({ account: publicAccount as StaffAccount });
}
