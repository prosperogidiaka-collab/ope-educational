import { NextResponse } from "next/server";

import { canAccessSchool, isPlatformSuperAdmin, isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { readAcademicConfig } from "@/lib/academic-config-store";
import { buildRuntimeSchoolProfile } from "@/lib/academic-config";
import { readStoredSchoolProfile, writeStoredSchoolProfile } from "@/lib/school-profile-store";
import type { SchoolProfile, UserRole } from "@/lib/types";

type SchoolProfileUpdatePayload = Partial<
  Pick<
    SchoolProfile,
    | "name"
    | "shortName"
    | "motto"
    | "address"
    | "principalName"
    | "schoolAdminName"
    | "schoolAdminEmail"
    | "portalSlug"
    | "nextResumptionDate"
    | "logoUrl"
    | "watermarkLogoUrl"
    | "governmentStampUrl"
  >
>;

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function canManageSchoolProfile(role: UserRole) {
  return role === "super_admin" || isSchoolAdminRole(role);
}

export async function GET() {
  const [session, account, config, storedSchool] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readAcademicConfig(),
    readStoredSchoolProfile(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessSchool(account, storedSchool.schoolCode)) {
    return NextResponse.json({ error: "This school profile is outside your school scope." }, { status: 403 });
  }

  return NextResponse.json({ school: buildRuntimeSchoolProfile(config, storedSchool) });
}

export async function PUT(request: Request) {
  const [session, account, config, storedSchool] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readAcademicConfig(),
    readStoredSchoolProfile(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canAccessSchool(account, storedSchool.schoolCode)) {
    return NextResponse.json({ error: "This school profile is outside your school scope." }, { status: 403 });
  }

  if (!canManageSchoolProfile(account.role) && !isPlatformSuperAdmin(account)) {
    return NextResponse.json({ error: "Only the school admin can update school branding." }, { status: 403 });
  }

  const body = (await request.json()) as SchoolProfileUpdatePayload;
  const nextStoredSchool = await writeStoredSchoolProfile({
    ...storedSchool,
    name: readString(body.name, storedSchool.name),
    shortName: readString(body.shortName, storedSchool.shortName),
    motto: readString(body.motto, storedSchool.motto),
    address: readString(body.address, storedSchool.address),
    principalName: readString(body.principalName, storedSchool.principalName),
    schoolAdminName: readString(body.schoolAdminName, storedSchool.schoolAdminName ?? "School Admin"),
    schoolAdminEmail: readString(body.schoolAdminEmail, storedSchool.schoolAdminEmail ?? "admin@ope.edu.ng").toLowerCase(),
    portalSlug: readString(body.portalSlug, storedSchool.portalSlug).toLowerCase(),
    nextResumptionDate: readString(body.nextResumptionDate, storedSchool.nextResumptionDate),
    logoUrl: readString(body.logoUrl, storedSchool.logoUrl),
    watermarkLogoUrl: readString(body.watermarkLogoUrl, storedSchool.watermarkLogoUrl),
    governmentStampUrl: readString(body.governmentStampUrl, storedSchool.governmentStampUrl),
  });

  return NextResponse.json({ school: buildRuntimeSchoolProfile(config, nextStoredSchool) });
}
