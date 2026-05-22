import { NextResponse } from "next/server";

import {
  getSchoolPortfolioItemById,
  readSchoolPortfolio,
  writeSchoolPortfolio,
} from "@/lib/school-portfolio-store";
import { requirePlatformSuperAdmin } from "@/lib/super-admin-access";
import type { SchoolPortfolioItem } from "@/lib/types";

interface RouteContext {
  params: Promise<{
    schoolId: string;
  }>;
}

type SchoolUpdatePayload = Partial<
  Pick<
    SchoolPortfolioItem,
    "name" | "status" | "plan" | "students" | "storageUsedGb" | "storageQuotaGb" | "renewalDate" | "portalSlug" | "notes"
  >
>;

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(_: Request, { params }: RouteContext) {
  const access = await requirePlatformSuperAdmin();

  if ("error" in access) {
    return access.error;
  }

  const resolvedParams = await params;
  const school = await getSchoolPortfolioItemById(decodeURIComponent(resolvedParams.schoolId));

  if (!school) {
    return NextResponse.json({ error: "School not found." }, { status: 404 });
  }

  return NextResponse.json({ school });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const access = await requirePlatformSuperAdmin();

  if ("error" in access) {
    return access.error;
  }

  const resolvedParams = await params;
  const schoolId = decodeURIComponent(resolvedParams.schoolId);
  const body = (await request.json()) as SchoolUpdatePayload;
  const schools = await readSchoolPortfolio();
  const current = schools.find((item) => item.id === schoolId);

  if (!current) {
    return NextResponse.json({ error: "School not found." }, { status: 404 });
  }

  const nextPortalSlug = body.portalSlug ? toSlug(body.portalSlug) : current.portalSlug;

  if (schools.some((item) => item.id !== schoolId && item.portalSlug === nextPortalSlug)) {
    return NextResponse.json({ error: "That portal slug is already in use by another school." }, { status: 409 });
  }

  const updatedSchool: SchoolPortfolioItem = {
    ...current,
    name: body.name?.trim() || current.name,
    status: body.status ?? current.status,
    plan: body.plan?.trim() || current.plan,
    students: body.students === undefined ? current.students : Math.max(0, Number(body.students) || 0),
    storageUsedGb:
      body.storageUsedGb === undefined ? current.storageUsedGb : Math.max(0, Number(body.storageUsedGb) || 0),
    storageQuotaGb:
      body.storageQuotaGb === undefined
        ? current.storageQuotaGb
        : Math.max(Number(body.storageQuotaGb) || current.storageQuotaGb, Number(body.storageUsedGb ?? current.storageUsedGb) || 0),
    portalSlug: nextPortalSlug,
    notes: body.notes?.trim() || current.notes,
    lastFollowUpAt: new Date().toISOString(),
  };

  await writeSchoolPortfolio(
    schools.map((item) => (item.id === schoolId ? updatedSchool : item)),
  );

  return NextResponse.json({ school: updatedSchool });
}
