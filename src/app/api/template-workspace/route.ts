import { NextResponse } from "next/server";

import { canAccess, canAccessSchool } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { readTemplateWorkspace, writeTemplateWorkspace } from "@/lib/template-workspace-store";
import type { ResultTemplateWorkspace } from "@/lib/types";

export async function GET() {
  const [session, account, workspace] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readTemplateWorkspace(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccess(session.role, "/dashboard/templates")) {
    return NextResponse.json({ error: "Only the school admin can open the template workspace." }, { status: 403 });
  }

  if (!canAccessSchool(account, workspace.schoolCode)) {
    return NextResponse.json({ error: "This template workspace does not belong to your account scope." }, { status: 403 });
  }

  return NextResponse.json({ workspace });
}

export async function PUT(request: Request) {
  const [session, account, currentWorkspace] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readTemplateWorkspace(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccess(session.role, "/dashboard/templates")) {
    return NextResponse.json({ error: "Only the school admin can update the template workspace." }, { status: 403 });
  }

  if (!canAccessSchool(account, currentWorkspace.schoolCode)) {
    return NextResponse.json({ error: "This template workspace does not belong to your account scope." }, { status: 403 });
  }

  const workspace = (await request.json()) as ResultTemplateWorkspace;
  await writeTemplateWorkspace({
    ...currentWorkspace,
    ...workspace,
    schoolCode: currentWorkspace.schoolCode,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
