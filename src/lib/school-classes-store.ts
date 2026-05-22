import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { canAccessSchool } from "@/lib/auth";
import { readAcademicConfig } from "@/lib/academic-config-store";
import { inferBaseClassName } from "@/lib/class-structure";
import { classOfferings, school } from "@/lib/demo-data";
import type { SchoolClassRecord, StaffAccount } from "@/lib/types";

const SCHOOL_CLASSES_STORE_PATH = path.join(process.cwd(), "data", "school-classes.json");

type SchoolClassScopeViewer = Pick<StaffAccount, "role" | "schoolCode" | "grantedSchoolCodes">;

function classRecordId(className: string, session: string) {
  return `${session}-${className}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
}

function normalizeSchoolClass(record: SchoolClassRecord, session: string): SchoolClassRecord {
  return {
    ...record,
    id: record.id || classRecordId(record.className, record.session || session),
    schoolCode: record.schoolCode || school.schoolCode,
    session: record.session || session,
    className: record.className.trim().replace(/\s+/g, " "),
    status: record.status ?? "active",
    updatedAt: record.updatedAt ?? "2026-05-16T08:00:00.000Z",
    updatedBy: record.updatedBy ?? (school.schoolAdminName ?? "School Admin"),
  };
}

async function buildSeedStore() {
  const config = await readAcademicConfig();
  const recordMap = new Map<string, SchoolClassRecord>();

  classOfferings.forEach((offering) => {
    const baseClassName = inferBaseClassName(offering.className, offering.arm);

    if (!baseClassName || recordMap.has(baseClassName.toLowerCase())) {
      return;
    }

    recordMap.set(
      baseClassName.toLowerCase(),
      normalizeSchoolClass(
        {
          id: classRecordId(baseClassName, config.session),
          schoolCode: school.schoolCode,
          session: config.session,
          className: baseClassName,
          section: offering.section,
          status: "active",
          updatedAt: "2026-05-16T08:00:00.000Z",
          updatedBy: school.schoolAdminName ?? "School Admin",
        },
        config.session,
      ),
    );
  });

  return Array.from(recordMap.values()).sort((left, right) => left.className.localeCompare(right.className));
}

async function ensureSchoolClassesStoreFile() {
  await mkdir(path.dirname(SCHOOL_CLASSES_STORE_PATH), { recursive: true });

  try {
    await readFile(SCHOOL_CLASSES_STORE_PATH, "utf8");
  } catch {
    await writeFile(SCHOOL_CLASSES_STORE_PATH, JSON.stringify(await buildSeedStore(), null, 2), "utf8");
  }
}

export async function readSchoolClasses(): Promise<SchoolClassRecord[]> {
  await ensureSchoolClassesStoreFile();
  const config = await readAcademicConfig();

  try {
    const fileContents = await readFile(SCHOOL_CLASSES_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as SchoolClassRecord[];
    const normalized = parsed.map((record) => normalizeSchoolClass(record, config.session));

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeSchoolClasses(normalized);
    }

    return normalized.filter((record) => record.session === config.session);
  } catch {
    return buildSeedStore();
  }
}

export async function readAllSchoolClasses(): Promise<SchoolClassRecord[]> {
  await ensureSchoolClassesStoreFile();
  const config = await readAcademicConfig();

  try {
    const fileContents = await readFile(SCHOOL_CLASSES_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as SchoolClassRecord[];
    const normalized = parsed.map((record) => normalizeSchoolClass(record, config.session));

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeSchoolClasses(normalized);
    }

    return normalized;
  } catch {
    return buildSeedStore();
  }
}

export async function writeSchoolClasses(records: SchoolClassRecord[]) {
  await ensureSchoolClassesStoreFile();
  const config = await readAcademicConfig();
  await writeFile(
    SCHOOL_CLASSES_STORE_PATH,
    JSON.stringify(records.map((record) => normalizeSchoolClass(record, config.session)), null, 2),
    "utf8",
  );
}

export async function readVisibleSchoolClasses(viewer?: SchoolClassScopeViewer | null) {
  const records = await readSchoolClasses();

  if (!viewer) {
    return records;
  }

  return records.filter((record) => canAccessSchool(viewer, record.schoolCode));
}

export async function getSchoolClass(className: string) {
  const config = await readAcademicConfig();
  const records = await readAllSchoolClasses();
  return records.find(
    (record) => record.className.toLowerCase() === className.trim().toLowerCase() && record.session === config.session,
  ) ?? null;
}

export async function saveSchoolClass(
  nextRecord: SchoolClassRecord,
  previousClassName?: string,
  previousSession?: string,
) {
  const records = await readAllSchoolClasses();
  const matchClassName = previousClassName ?? nextRecord.className;
  const matchSession = previousSession ?? nextRecord.session;
  const existingIndex = records.findIndex(
    (record) =>
      record.className.toLowerCase() === matchClassName.trim().toLowerCase() &&
      record.session === matchSession,
  );

  if (existingIndex >= 0) {
    records[existingIndex] = nextRecord;
  } else {
    records.push(nextRecord);
  }

  await writeSchoolClasses(records);
  return nextRecord;
}
