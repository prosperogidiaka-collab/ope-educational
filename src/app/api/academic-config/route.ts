import { NextResponse } from "next/server";

import { normalizeAcademicConfig, totalConfiguredWeight } from "@/lib/academic-config";
import { canAccessSchool, isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { readAcademicConfig, readRuntimeSchoolProfile, saveAcademicConfig } from "@/lib/academic-config-store";
import {
  readStudentAttendancePolicy,
  writeStudentAttendancePolicy,
} from "@/lib/student-attendance-store";
import type { AcademicConfig, UserRole } from "@/lib/types";

function canManageAcademicSetup(role: UserRole) {
  return isSchoolAdminRole(role);
}

export async function GET() {
  const [session, account, config, school] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readAcademicConfig(),
    readRuntimeSchoolProfile(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessSchool(account, school.schoolCode)) {
    return NextResponse.json({ error: "This school setup does not belong to your account scope." }, { status: 403 });
  }

  return NextResponse.json({ config, school });
}

export async function PUT(request: Request) {
  const [session, account, school] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readRuntimeSchoolProfile(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessSchool(account, school.schoolCode)) {
    return NextResponse.json({ error: "This school setup does not belong to your account scope." }, { status: 403 });
  }

  if (!canManageAcademicSetup(account.role)) {
    return NextResponse.json(
      { error: "Only the school admin can change the active term and assessment setup." },
      { status: 403 },
    );
  }

  const requestBody = (await request.json()) as
    | Partial<AcademicConfig>
    | {
        config?: Partial<AcademicConfig>;
        operation?: "term" | "assessment" | "ranking";
      };
  const operation =
    "operation" in requestBody && typeof requestBody.operation === "string"
      ? requestBody.operation
      : undefined;
  const incoming = normalizeAcademicConfig(
    "config" in requestBody && requestBody.config ? requestBody.config : (requestBody as Partial<AcademicConfig>),
  );
  const totalWeight = totalConfiguredWeight(incoming);

  if (incoming.scoreComponents.length === 0) {
    return NextResponse.json({ error: "Add at least one active score component." }, { status: 400 });
  }

  if (totalWeight !== 100) {
    return NextResponse.json(
      { error: `The active score components must total 100 marks. Current total is ${totalWeight}.` },
      { status: 400 },
    );
  }

  const config = await saveAcademicConfig(incoming);
  const nextSchool = await readRuntimeSchoolProfile();

  if (operation === "term") {
    const currentAttendancePolicy = await readStudentAttendancePolicy();

    await writeStudentAttendancePolicy({
      ...currentAttendancePolicy,
      schoolCode: nextSchool.schoolCode,
      session: nextSchool.session,
      term: nextSchool.term,
      attendanceEnabled: true,
      classTeacherCommentEnabled: true,
      updatedAt: new Date().toISOString(),
      updatedBy: account.fullName,
    });
  }

  return NextResponse.json({ config, school: nextSchool });
}
