import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { readAcademicConfig } from "@/lib/academic-config-store";
import { combineClassArm, inferBaseClassName } from "@/lib/class-structure";
import { school } from "@/lib/demo-data";
import type { SchoolTimetable, TimetableEntry, TimetablePeriod } from "@/lib/types";

const SCHOOL_TIMETABLE_STORE_PATH = path.join(process.cwd(), "data", "school-timetable.json");

const DEFAULT_PERIODS: TimetablePeriod[] = [
  { id: "period_1", label: "Period 1", startTime: "08:00", endTime: "08:40" },
  { id: "period_2", label: "Period 2", startTime: "08:40", endTime: "09:20" },
  { id: "period_3", label: "Period 3", startTime: "09:20", endTime: "10:00" },
  { id: "period_4", label: "Period 4", startTime: "10:20", endTime: "11:00" },
  { id: "period_5", label: "Period 5", startTime: "11:00", endTime: "11:40" },
  { id: "period_6", label: "Period 6", startTime: "11:40", endTime: "12:20" },
  { id: "period_7", label: "Period 7", startTime: "12:50", endTime: "13:30" },
  { id: "period_8", label: "Period 8", startTime: "13:30", endTime: "14:10" },
];

function normalizePeriods(periods: TimetablePeriod[]) {
  return periods.map((period, index) => ({
    ...period,
    id: period.id || `period_${index + 1}`,
    label: period.label.trim(),
    startTime: period.startTime.trim(),
    endTime: period.endTime.trim(),
  }));
}

function normalizeEntries(entries: TimetableEntry[]) {
  return entries
    .map((entry) => ({
      ...entry,
      schoolCode: entry.schoolCode || school.schoolCode,
      teacherName: entry.teacherName.trim(),
      subjectName: entry.subjectName.trim(),
      baseClassName:
        entry.baseClassName?.trim() ||
        inferBaseClassName(entry.className, entry.arm),
      className: combineClassArm(
        entry.baseClassName?.trim() || inferBaseClassName(entry.className, entry.arm),
        entry.arm,
      ) || entry.className.trim(),
      arm: entry.arm.trim(),
      track: entry.track?.trim() || undefined,
      room: entry.room?.trim() || undefined,
    }))
    .sort((left, right) => {
      const dayCompare = left.day.localeCompare(right.day);
      if (dayCompare !== 0) {
        return dayCompare;
      }
      const periodCompare = left.periodLabel.localeCompare(right.periodLabel);
      if (periodCompare !== 0) {
        return periodCompare;
      }
      return left.className.localeCompare(right.className);
    });
}

async function buildSeedStore(): Promise<SchoolTimetable> {
  const config = await readAcademicConfig();

  return {
    schoolCode: school.schoolCode,
    session: config.session,
    term: config.term,
    publishState: "draft",
    updatedAt: "2026-05-16T08:40:00.000Z",
    updatedBy: school.schoolAdminName ?? "School Admin",
    periods: DEFAULT_PERIODS,
    entries: [],
  };
}

async function ensureSchoolTimetableStoreFile() {
  await mkdir(path.dirname(SCHOOL_TIMETABLE_STORE_PATH), { recursive: true });

  try {
    await readFile(SCHOOL_TIMETABLE_STORE_PATH, "utf8");
  } catch {
    await writeFile(SCHOOL_TIMETABLE_STORE_PATH, JSON.stringify(await buildSeedStore(), null, 2), "utf8");
  }
}

function normalizeSchoolTimetable(timetable: SchoolTimetable, session: string, term: string): SchoolTimetable {
  return {
    ...timetable,
    schoolCode: timetable.schoolCode || school.schoolCode,
    session: timetable.session || session,
    term: timetable.term || term,
    periods: normalizePeriods(timetable.periods?.length ? timetable.periods : DEFAULT_PERIODS),
    entries: normalizeEntries(timetable.entries ?? []),
  };
}

export async function readSchoolTimetable(): Promise<SchoolTimetable> {
  await ensureSchoolTimetableStoreFile();
  const config = await readAcademicConfig();

  try {
    const fileContents = await readFile(SCHOOL_TIMETABLE_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as SchoolTimetable;
    const normalized = normalizeSchoolTimetable(parsed, config.session, config.term);

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeSchoolTimetable(normalized);
    }

    return normalized;
  } catch {
    return buildSeedStore();
  }
}

export async function writeSchoolTimetable(timetable: SchoolTimetable) {
  await ensureSchoolTimetableStoreFile();
  const config = await readAcademicConfig();
  await writeFile(
    SCHOOL_TIMETABLE_STORE_PATH,
    JSON.stringify(normalizeSchoolTimetable(timetable, config.session, config.term), null, 2),
    "utf8",
  );
}

export async function saveSchoolTimetable(nextTimetable: SchoolTimetable) {
  const config = await readAcademicConfig();
  const normalized = normalizeSchoolTimetable(nextTimetable, config.session, config.term);
  await writeSchoolTimetable(normalized);
  return normalized;
}
