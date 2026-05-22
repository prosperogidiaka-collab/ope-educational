import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { canAccessSchool } from "@/lib/auth";
import { classOfferings, resultBundles, school } from "@/lib/demo-data";
import type {
  StaffAccount,
  StudentAttendanceAggregate,
  StudentAttendancePolicy,
  StudentAttendanceRegister,
  StudentAttendanceStatus,
} from "@/lib/types";

const STUDENT_ATTENDANCE_REGISTERS_STORE_PATH = path.join(
  process.cwd(),
  "data",
  "student-attendance-registers.json",
);
const STUDENT_ATTENDANCE_POLICY_STORE_PATH = path.join(
  process.cwd(),
  "data",
  "student-attendance-policy.json",
);
const DEFAULT_ATTENDANCE_END_DATE = "2026-05-15";

type AttendanceScopeViewer = Pick<StaffAccount, "role" | "schoolCode" | "grantedSchoolCodes">;

function toRegisterId(className: string, date: string) {
  return `${className}-${date}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
}

function listWeekdaysEndingAt(endDateIso: string, totalDays: number) {
  const result: string[] = [];
  const cursor = new Date(`${endDateIso}T12:00:00.000Z`);

  while (result.length < totalDays) {
    const day = cursor.getUTCDay();

    if (day !== 0 && day !== 6) {
      result.unshift(cursor.toISOString().slice(0, 10));
    }

    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return result;
}

function firstOpenSlot(schedule: StudentAttendanceStatus[], preferredIndex: number) {
  for (let offset = 0; offset < schedule.length; offset += 1) {
    const forwardIndex = (preferredIndex + offset) % schedule.length;

    if (schedule[forwardIndex] === "present") {
      return forwardIndex;
    }
  }

  return -1;
}

function buildStatusSchedule(
  possible: number,
  counts: { absent: number; late: number; excused: number },
  offsetSeed: number,
) {
  const schedule = Array.from({ length: possible }, () => "present" as StudentAttendanceStatus);

  for (let index = 0; index < counts.absent; index += 1) {
    const slot = firstOpenSlot(schedule, (offsetSeed * 3 + index * 11) % possible);
    if (slot >= 0) {
      schedule[slot] = "absent";
    }
  }

  for (let index = 0; index < counts.late; index += 1) {
    const slot = firstOpenSlot(schedule, (offsetSeed * 5 + index * 13 + 2) % possible);
    if (slot >= 0) {
      schedule[slot] = "late";
    }
  }

  for (let index = 0; index < counts.excused; index += 1) {
    const slot = firstOpenSlot(schedule, (offsetSeed * 7 + index * 17 + 4) % possible);
    if (slot >= 0) {
      schedule[slot] = "excused";
    }
  }

  return schedule;
}

function buildSeedRegisters(): StudentAttendanceRegister[] {
  const studentsByClass = new Map<string, typeof resultBundles>();

  resultBundles.forEach((bundle) => {
    const current = studentsByClass.get(bundle.student.className) ?? [];
    current.push(bundle);
    studentsByClass.set(bundle.student.className, current);
  });

  return Array.from(studentsByClass.entries()).flatMap(([className, bundles]) => {
    const possibleDays = Math.max(...bundles.map((bundle) => bundle.student.attendance.possible), 0);

    if (possibleDays <= 0) {
      return [];
    }

    const classOffering = classOfferings.find((item) => item.className === className);
    const schoolDates = listWeekdaysEndingAt(DEFAULT_ATTENDANCE_END_DATE, possibleDays);
    const schedulesByRegNumber = new Map(
      bundles.map((bundle, index) => [
        bundle.student.regNumber,
        buildStatusSchedule(
          bundle.student.attendance.possible,
          {
            absent: bundle.student.attendance.absent,
            late: bundle.student.attendance.late,
            excused: bundle.student.attendance.excused ?? 0,
          },
          index + 1,
        ),
      ]),
    );

    return schoolDates.map((date, dayIndex) => ({
      id: toRegisterId(className, date),
      schoolCode: school.schoolCode,
      className,
      arm: classOffering?.arm ?? (className.split(" ").slice(1).join(" ") || className),
      session: school.session,
      term: school.term,
      date,
      recordedByName: classOffering?.classTeacher ?? "Class Teacher",
      updatedAt: `${date}T14:00:00.000Z`,
      entries: bundles.map((bundle) => ({
        regNumber: bundle.student.regNumber,
        studentName: bundle.student.fullName,
        status: schedulesByRegNumber.get(bundle.student.regNumber)?.[dayIndex] ?? "present",
      })),
    }));
  });
}

function buildSeedPolicy(): StudentAttendancePolicy {
  return {
    schoolCode: school.schoolCode,
    session: school.session,
    term: school.term,
    attendanceEnabled: true,
    classTeacherCommentEnabled: true,
    updatedAt: "2026-05-12T08:10:00.000Z",
    updatedBy: school.schoolAdminName ?? "School Admin",
  };
}

function normalizePolicy(
  policy: StudentAttendancePolicy,
  runtimeSchool: Pick<StudentAttendancePolicy, "schoolCode" | "session" | "term">,
): StudentAttendancePolicy {
  return {
    ...policy,
    schoolCode: runtimeSchool.schoolCode,
    session: runtimeSchool.session,
    term: runtimeSchool.term,
  };
}

function normalizeRegister(register: StudentAttendanceRegister): StudentAttendanceRegister {
  return {
    ...register,
    schoolCode: register.schoolCode || school.schoolCode,
    arm: register.arm || register.className.split(" ").slice(1).join(" ") || register.className,
    entries: register.entries.map((entry) => ({
      ...entry,
      status: entry.status ?? "present",
    })),
  };
}

async function ensureStudentAttendanceRegistersStoreFile() {
  await mkdir(path.dirname(STUDENT_ATTENDANCE_REGISTERS_STORE_PATH), { recursive: true });

  try {
    await readFile(STUDENT_ATTENDANCE_REGISTERS_STORE_PATH, "utf8");
  } catch {
    await writeFile(
      STUDENT_ATTENDANCE_REGISTERS_STORE_PATH,
      JSON.stringify(buildSeedRegisters(), null, 2),
      "utf8",
    );
  }
}

async function ensureStudentAttendancePolicyStoreFile() {
  await mkdir(path.dirname(STUDENT_ATTENDANCE_POLICY_STORE_PATH), { recursive: true });

  try {
    await readFile(STUDENT_ATTENDANCE_POLICY_STORE_PATH, "utf8");
  } catch {
    await writeFile(
      STUDENT_ATTENDANCE_POLICY_STORE_PATH,
      JSON.stringify(buildSeedPolicy(), null, 2),
      "utf8",
    );
  }
}

export async function readStudentAttendanceRegisters(): Promise<StudentAttendanceRegister[]> {
  await ensureStudentAttendanceRegistersStoreFile();

  try {
    const fileContents = await readFile(STUDENT_ATTENDANCE_REGISTERS_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as StudentAttendanceRegister[];
    const normalized = parsed.map(normalizeRegister);

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeStudentAttendanceRegisters(normalized);
    }

    return normalized;
  } catch {
    return buildSeedRegisters();
  }
}

export async function writeStudentAttendanceRegisters(registers: StudentAttendanceRegister[]) {
  await ensureStudentAttendanceRegistersStoreFile();
  await writeFile(
    STUDENT_ATTENDANCE_REGISTERS_STORE_PATH,
    JSON.stringify(registers.map(normalizeRegister), null, 2),
    "utf8",
  );
}

export async function readStudentAttendancePolicy(): Promise<StudentAttendancePolicy> {
  await ensureStudentAttendancePolicyStoreFile();

  try {
    const [fileContents, runtimeSchool] = await Promise.all([
      readFile(STUDENT_ATTENDANCE_POLICY_STORE_PATH, "utf8"),
      readRuntimeSchoolProfile(),
    ]);
    const parsed = JSON.parse(fileContents) as StudentAttendancePolicy;
    const normalized = normalizePolicy(parsed, runtimeSchool);

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeStudentAttendancePolicy(normalized);
    }

    return normalized;
  } catch {
    const runtimeSchool = await readRuntimeSchoolProfile();
    return normalizePolicy(buildSeedPolicy(), runtimeSchool);
  }
}

export async function writeStudentAttendancePolicy(policy: StudentAttendancePolicy) {
  await ensureStudentAttendancePolicyStoreFile();
  const runtimeSchool = await readRuntimeSchoolProfile();
  await writeFile(
    STUDENT_ATTENDANCE_POLICY_STORE_PATH,
    JSON.stringify(normalizePolicy(policy, runtimeSchool), null, 2),
    "utf8",
  );
}

export async function readVisibleStudentAttendanceRegisters(viewer?: AttendanceScopeViewer | null) {
  const registers = await readStudentAttendanceRegisters();

  if (!viewer) {
    return registers;
  }

  return registers.filter((register) => canAccessSchool(viewer, register.schoolCode));
}

export async function listAttendanceRegistersForClass(className: string, viewer?: AttendanceScopeViewer | null) {
  const registers = await readVisibleStudentAttendanceRegisters(viewer);
  return registers.filter((register) => register.className === className);
}

export async function getAttendanceRegister(className: string, date: string) {
  const registers = await readStudentAttendanceRegisters();
  return registers.find((register) => register.className === className && register.date === date) ?? null;
}

export async function saveAttendanceRegister(nextRegister: StudentAttendanceRegister) {
  const registers = await readStudentAttendanceRegisters();
  const existingIndex = registers.findIndex((register) => register.id === nextRegister.id);
  const normalized = normalizeRegister(nextRegister);

  if (existingIndex >= 0) {
    registers[existingIndex] = normalized;
  } else {
    registers.push(normalized);
  }

  await writeStudentAttendanceRegisters(registers);
  return normalized;
}

export async function buildAttendanceSummaryMap() {
  const [policy, registers] = await Promise.all([
    readStudentAttendancePolicy(),
    readStudentAttendanceRegisters(),
  ]);

  const summaryMap = new Map<string, StudentAttendanceAggregate>();

  if (!policy.attendanceEnabled) {
    return summaryMap;
  }

  const relevantRegisters = registers.filter(
    (register) => register.session === policy.session && register.term === policy.term,
  );

  relevantRegisters.forEach((register) => {
    register.entries.forEach((entry) => {
      const current = summaryMap.get(entry.regNumber) ?? {
        regNumber: entry.regNumber,
        studentName: entry.studentName,
        className: register.className,
        arm: register.arm,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        possible: 0,
        percentage: 0,
      };

      current.possible += 1;
      current.lastMarkedAt = register.updatedAt;

      if (entry.status === "present") {
        current.present += 1;
      } else if (entry.status === "absent") {
        current.absent += 1;
      } else if (entry.status === "late") {
        current.late += 1;
      } else if (entry.status === "excused") {
        current.excused += 1;
      }

      current.percentage = current.possible
        ? Math.round((current.present / current.possible) * 100)
        : 0;
      summaryMap.set(entry.regNumber, current);
    });
  });

  return summaryMap;
}
