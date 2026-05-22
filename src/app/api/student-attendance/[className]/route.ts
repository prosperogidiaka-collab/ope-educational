import { NextResponse } from "next/server";

import { canAccessSchool } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { canMarkClassAttendance } from "@/lib/student-affairs-permissions";
import {
  buildAttendanceSummaryMap,
  getAttendanceRegister,
  saveAttendanceRegister,
} from "@/lib/student-attendance-store";
import { readStudentProfiles } from "@/lib/student-profiles-store";
import type {
  StudentAttendanceEntry,
  StudentAttendanceRegister,
  StudentAttendanceStatus,
} from "@/lib/types";

interface RouteContext {
  params: Promise<{
    className: string;
  }>;
}

const ATTENDANCE_STATUSES = new Set<StudentAttendanceStatus>(["present", "absent", "late", "excused"]);

function toRegisterId(className: string, date: string) {
  return `${className}-${date}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
}

export async function PUT(request: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const className = decodeURIComponent(resolvedParams.className);
  const [session, account, profiles] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readStudentProfiles(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canMarkClassAttendance(account, className)) {
    return NextResponse.json(
      { error: "Only the class teacher, school admin, or super admin can submit attendance for this class." },
      { status: 403 },
    );
  }

  const classProfiles = profiles.filter((profile) => profile.className === className);
  const schoolCode = classProfiles[0]?.schoolCode ?? account.schoolCode;

  if (!schoolCode || !canAccessSchool(account, schoolCode)) {
    return NextResponse.json({ error: "This class is outside your school scope." }, { status: 403 });
  }

  const body = (await request.json()) as {
    date?: string;
    session?: string;
    term?: string;
    arm?: string;
    entries?: StudentAttendanceEntry[];
  };
  const date = body.date?.trim() ?? "";

  if (!date || !Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: "Attendance date and entries are required." }, { status: 400 });
  }

  const existingRegister = await getAttendanceRegister(className, date);
  const studentsByRegNumber = new Map(classProfiles.map((profile) => [profile.regNumber, profile]));
  const normalizedEntries: StudentAttendanceEntry[] = body.entries
    .filter((entry) => entry?.regNumber && ATTENDANCE_STATUSES.has(entry.status))
    .map((entry) => ({
      regNumber: entry.regNumber,
      studentName:
        studentsByRegNumber.get(entry.regNumber)?.fullName ?? entry.studentName ?? entry.regNumber,
      status: entry.status,
      note: entry.note?.trim() || undefined,
    }));

  if (normalizedEntries.length === 0) {
    return NextResponse.json({ error: "No valid attendance entries were submitted." }, { status: 400 });
  }

  const nextRegister: StudentAttendanceRegister = {
    id: existingRegister?.id ?? toRegisterId(className, date),
    schoolCode,
    className,
    arm: body.arm?.trim() || classProfiles[0]?.arm || existingRegister?.arm || className,
    session: body.session?.trim() || existingRegister?.session || "",
    term: body.term?.trim() || existingRegister?.term || "",
    date,
    recordedByAccountId: account.id,
    recordedByName: account.fullName,
    updatedAt: new Date().toISOString(),
    entries: normalizedEntries,
  };

  await saveAttendanceRegister(nextRegister);
  const summaryMap = await buildAttendanceSummaryMap();
  const classSummaries = classProfiles.map((profile) => summaryMap.get(profile.regNumber)).filter(Boolean);

  return NextResponse.json({ register: nextRegister, summaries: classSummaries });
}
