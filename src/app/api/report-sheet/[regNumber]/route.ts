import { NextResponse } from "next/server";

import { canAccess, canAccessSchool } from "@/lib/auth";
import { readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import {
  deleteReportSheetOverride,
  getReportSheetOverride,
  saveReportSheetOverride,
} from "@/lib/report-sheet-store";
import type { ResultSheetDraft } from "@/lib/report-sheet";

interface RouteContext {
  params: Promise<{
    regNumber: string;
  }>;
}

async function ensureReportEditorAccess() {
  const [session, account, school] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readRuntimeSchoolProfile(),
  ]);

  if (!session || !account || account.status !== "active") {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }

  if (!canAccess(session.role, "/dashboard/report-editor")) {
    return { error: NextResponse.json({ error: "Only the school admin can manage report-sheet overrides." }, { status: 403 }) };
  }

  if (!canAccessSchool(account, school.schoolCode)) {
    return { error: NextResponse.json({ error: "This report editor does not belong to your account scope." }, { status: 403 }) };
  }

  return { session, account, school };
}

export async function GET(_: Request, { params }: RouteContext) {
  const access = await ensureReportEditorAccess();

  if ("error" in access) {
    return access.error;
  }

  const resolvedParams = await params;
  const regNumber = decodeURIComponent(resolvedParams.regNumber);
  const override = await getReportSheetOverride(regNumber);

  return NextResponse.json({ override });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const access = await ensureReportEditorAccess();

  if ("error" in access) {
    return access.error;
  }

  const resolvedParams = await params;
  const regNumber = decodeURIComponent(resolvedParams.regNumber);
  const draft = (await request.json()) as ResultSheetDraft;
  const savedDraft = await saveReportSheetOverride(regNumber, draft);

  return NextResponse.json({ override: savedDraft });
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const access = await ensureReportEditorAccess();

  if ("error" in access) {
    return access.error;
  }

  const resolvedParams = await params;
  const regNumber = decodeURIComponent(resolvedParams.regNumber);

  await deleteReportSheetOverride(regNumber);

  return NextResponse.json({ ok: true });
}
