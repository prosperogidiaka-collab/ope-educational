import { NextResponse } from "next/server";

import { canAccessSchool, isSchoolAdminRole } from "@/lib/auth";
import { readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import {
  getResultLockForClass,
  saveResultLock,
} from "@/lib/result-locks-store";
import type { ResultLockRecord, UserRole } from "@/lib/types";

interface RouteContext {
  params: Promise<{
    className: string;
  }>;
}

function canManageLocks(role: UserRole) {
  return isSchoolAdminRole(role);
}

export async function PUT(request: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const className = decodeURIComponent(resolvedParams.className);
  const [session, account, existingLock, school] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    getResultLockForClass(className),
    readRuntimeSchoolProfile(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageLocks(account.role)) {
    return NextResponse.json(
      { error: "Only the school admin can lock or reopen results." },
      { status: 403 },
    );
  }

  if (!canAccessSchool(account, school.schoolCode)) {
    return NextResponse.json({ error: "This school lock desk does not belong to your account scope." }, { status: 403 });
  }

  if (!existingLock) {
    return NextResponse.json({ error: "Class result lock not found." }, { status: 404 });
  }

  const body = (await request.json()) as {
    locked: boolean;
    note?: string;
  };
  const timestamp = new Date().toISOString();
  const nextLock: ResultLockRecord = {
    ...existingLock,
    locked: body.locked,
    note: body.note?.trim() || existingLock.note,
    lockedAt: body.locked ? timestamp : existingLock.lockedAt,
    lockedBy: body.locked ? account.fullName : existingLock.lockedBy,
    unlockedAt: body.locked ? undefined : timestamp,
    unlockedBy: body.locked ? undefined : account.fullName,
  };
  const saved = await saveResultLock(nextLock);

  return NextResponse.json({ lock: saved });
}

export async function GET(_: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const className = decodeURIComponent(resolvedParams.className);
  const [session, account, school, lock] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readRuntimeSchoolProfile(),
    getResultLockForClass(className),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessSchool(account, school.schoolCode)) {
    return NextResponse.json({ error: "This school lock desk does not belong to your account scope." }, { status: 403 });
  }

  if (!lock) {
    return NextResponse.json({ error: "Class result lock not found." }, { status: 404 });
  }

  return NextResponse.json({ lock });
}
