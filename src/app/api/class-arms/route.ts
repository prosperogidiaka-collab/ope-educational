import { NextResponse } from "next/server";

import { isSchoolAdminRole } from "@/lib/auth";
import { readAcademicConfig } from "@/lib/academic-config-store";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { combineClassArm } from "@/lib/class-structure";
import { readClassOfferings, saveClassOffering } from "@/lib/class-offerings-store";
import { getSchoolClass } from "@/lib/school-classes-store";
import type { ClassOffering, GradeSection } from "@/lib/types";

function canManageClassArms(account: NonNullable<Awaited<ReturnType<typeof getCurrentStaffAccount>>>) {
  return isSchoolAdminRole(account.role) || account.role === "registrar" || Boolean(account.canRegisterStudents);
}

export async function POST(request: Request) {
  const [session, account, config, currentOfferings] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readAcademicConfig(),
    readClassOfferings(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageClassArms(account)) {
    return NextResponse.json(
      { error: "Only the school admin, principal, or assigned registrar can create class arms." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as Partial<ClassOffering>;
  const baseClassName = body.baseClassName?.trim().replace(/\s+/g, " ") ?? "";
  const arm = body.arm?.trim() ?? "";
  const className = combineClassArm(baseClassName, arm);

  if (!baseClassName || !arm) {
    return NextResponse.json({ error: "Select a class and enter the arm label." }, { status: 400 });
  }

  const schoolClass = await getSchoolClass(baseClassName);

  if (!schoolClass) {
    return NextResponse.json({ error: "Create the class first before adding an arm to it." }, { status: 400 });
  }

  if (currentOfferings.some((offering) => offering.className.toLowerCase() === className.toLowerCase())) {
    return NextResponse.json({ error: "This class arm already exists in the live session." }, { status: 400 });
  }

  const nextOffering: ClassOffering = {
    id: `${config.session}-${className}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase(),
    schoolCode: account.schoolCode,
    session: config.session,
    baseClassName,
    className,
    arm,
    section: body.section === "junior" ? "junior" : schoolClass.section ?? ("senior" as GradeSection),
    track: body.track?.trim() || "General",
    classTeacher: body.classTeacher?.trim() || "Class Teacher",
    hod: body.hod?.trim() || "HOD",
    subjectIds: [],
    electiveSubjectIds: [],
    publicationProgress: 0,
    pendingTeachers: [],
    status: "active",
    updatedAt: new Date().toISOString(),
    updatedBy: account.fullName,
  };

  await saveClassOffering(nextOffering);
  return NextResponse.json({ offering: nextOffering });
}
