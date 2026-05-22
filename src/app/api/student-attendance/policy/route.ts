import { NextResponse } from "next/server";

import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { canManageAttendancePolicy } from "@/lib/student-affairs-permissions";
import {
  readStudentAttendancePolicy,
  writeStudentAttendancePolicy,
} from "@/lib/student-attendance-store";
import type { StudentAttendancePolicy } from "@/lib/types";

export async function PUT(request: Request) {
  const [session, account, policy] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readStudentAttendancePolicy(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageAttendancePolicy(account)) {
    return NextResponse.json(
      { error: "Only the school admin or super admin can change attendance activation for the term." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as Partial<StudentAttendancePolicy>;
  const nextPolicy: StudentAttendancePolicy = {
    ...policy,
    attendanceEnabled:
      typeof body.attendanceEnabled === "boolean" ? body.attendanceEnabled : policy.attendanceEnabled,
    classTeacherCommentEnabled:
      typeof body.classTeacherCommentEnabled === "boolean"
        ? body.classTeacherCommentEnabled
        : policy.classTeacherCommentEnabled,
    updatedAt: new Date().toISOString(),
    updatedBy: account.fullName,
  };

  await writeStudentAttendancePolicy(nextPolicy);
  return NextResponse.json({ policy: nextPolicy });
}
