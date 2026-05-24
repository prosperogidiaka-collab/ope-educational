import { NextResponse } from "next/server";

import { readPlatformSettings } from "@/lib/platform-settings-store";
import { readSchoolPortfolio, writeSchoolPortfolio } from "@/lib/school-portfolio-store";
import {
  readStoredStaffAccounts,
  writeStoredStaffAccounts,
} from "@/lib/staff-accounts-store";
import { requirePlatformSuperAdmin } from "@/lib/super-admin-access";
import type { SchoolPortfolioItem } from "@/lib/types";

interface CreateSchoolPayload {
  name?: string;
  schoolCode?: string;
  plan?: string;
  status?: SchoolPortfolioItem["status"];
  students?: number;
  storageQuotaGb?: number;
  renewalDate?: string;
  portalSlug?: string;
  notes?: string;
  schoolAdminName?: string;
  schoolAdminEmail?: string;
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toSchoolCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  const access = await requirePlatformSuperAdmin();

  if ("error" in access) {
    return access.error;
  }

  const schools = await readSchoolPortfolio();
  return NextResponse.json({ schools });
}

export async function POST(request: Request) {
  const access = await requirePlatformSuperAdmin();

  if ("error" in access) {
    return access.error;
  }

  const body = (await request.json()) as CreateSchoolPayload;
  const name = body.name?.trim() ?? "";
  const schoolCode = toSchoolCode(body.schoolCode ?? "");
  const portalSlug = toSlug(body.portalSlug ?? "");
  const schoolAdminName = body.schoolAdminName?.trim() ?? "";
  const schoolAdminEmail = body.schoolAdminEmail?.trim().toLowerCase() ?? "";

  if (!name || !schoolCode || !portalSlug || !schoolAdminName || !schoolAdminEmail) {
    return NextResponse.json(
      { error: "School name, school code, portal slug, school admin name, and school admin email are required." },
      { status: 400 },
    );
  }

  const [schools, storedAccounts] = await Promise.all([
    readSchoolPortfolio(),
    readStoredStaffAccounts(),
  ]);
  const platformSettings = await readPlatformSettings();

  if (!platformSettings.allowSchoolOnboarding) {
    return NextResponse.json(
      { error: "School onboarding is currently disabled in platform settings." },
      { status: 403 },
    );
  }

  if (schools.some((item) => item.schoolCode === schoolCode)) {
    return NextResponse.json({ error: "A school with that code already exists." }, { status: 409 });
  }

  if (schools.some((item) => item.portalSlug === portalSlug)) {
    return NextResponse.json({ error: "That portal slug is already in use." }, { status: 409 });
  }

  if (storedAccounts.some((account) => account.email.toLowerCase() === schoolAdminEmail)) {
    return NextResponse.json({ error: "That school-admin email is already in use." }, { status: 409 });
  }

  const timestamp = new Date().toISOString();
  const schoolId = `sch_${Date.now()}`;
  const school: SchoolPortfolioItem = {
    id: schoolId,
    schoolCode,
    name,
    status: body.status ?? "trial",
    plan: body.plan?.trim() || "Trial",
    students: Math.max(0, Number(body.students) || 0),
    storageUsedGb: 0,
    storageQuotaGb: Math.max(1, Number(body.storageQuotaGb) || 5),
    renewalDate: body.renewalDate?.trim() || timestamp.slice(0, 10),
    portalSlug,
    lastFollowUpAt: timestamp,
    notes: body.notes?.trim() || `School created by ${access.account.fullName}.`,
  };
  const schoolAdminAccount = {
    id: `acct_school_admin_${Date.now()}`,
    schoolCode,
    fullName: schoolAdminName,
    email: schoolAdminEmail,
    password: "Admin@123",
    role: "school_admin" as const,
    status: "active" as const,
    mustChangePassword: true,
    registeredBy: access.account.fullName,
    canRegisterTeachers: true,
    canDisableTeachers: true,
    canRegisterStudents: true,
    grantedSchoolCodes: [],
    assignedArms: [],
    assignedSubjects: [],
    classTeacherArms: [],
    lastAction: `Provisioned by ${access.account.fullName} on ${timestamp}.`,
  };

  await Promise.all([
    writeSchoolPortfolio([...schools, school]),
    writeStoredStaffAccounts([...storedAccounts, schoolAdminAccount]),
  ]);

  return NextResponse.json({
    school,
    account: (({ password: _password, ...publicAccount }) => publicAccount)(schoolAdminAccount),
  });
}
