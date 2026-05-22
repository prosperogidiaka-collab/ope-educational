import { NextResponse } from "next/server";

import { isSchoolAdminRole } from "@/lib/auth";
import { readAcademicConfig } from "@/lib/academic-config-store";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { readSchoolClasses, saveSchoolClass } from "@/lib/school-classes-store";
import type { GradeSection, SchoolClassRecord } from "@/lib/types";

function canManageClasses(account: NonNullable<Awaited<ReturnType<typeof getCurrentStaffAccount>>>) {
  return isSchoolAdminRole(account.role) || account.role === "registrar" || Boolean(account.canRegisterStudents);
}

export async function POST(request: Request) {
  const [session, account, config, schoolClasses] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readAcademicConfig(),
    readSchoolClasses(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageClasses(account)) {
    return NextResponse.json(
      { error: "Only the school admin, principal, or assigned registrar can create classes." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as Partial<SchoolClassRecord>;
  const className = body.className?.trim().replace(/\s+/g, " ") ?? "";

  if (!className) {
    return NextResponse.json({ error: "Class name is required." }, { status: 400 });
  }

  if (schoolClasses.some((record) => record.className.toLowerCase() === className.toLowerCase())) {
    return NextResponse.json({ error: "This class already exists in the live session." }, { status: 400 });
  }

  const nextRecord: SchoolClassRecord = {
    id: `${config.session}-${className}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase(),
    schoolCode: account.schoolCode,
    session: config.session,
    className,
    section: body.section === "junior" ? "junior" : ("senior" as GradeSection),
    status: "active",
    updatedAt: new Date().toISOString(),
    updatedBy: account.fullName,
  };

  await saveSchoolClass(nextRecord);
  return NextResponse.json({ schoolClass: nextRecord });
}
