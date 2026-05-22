import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { canAccessSchool } from "@/lib/auth";
import { readAcademicConfig } from "@/lib/academic-config-store";
import { combineClassArm, inferBaseClassName } from "@/lib/class-structure";
import { classOfferings, school } from "@/lib/demo-data";
import type { ClassOffering, StaffAccount } from "@/lib/types";

const CLASS_OFFERINGS_STORE_PATH = path.join(process.cwd(), "data", "class-offerings.json");

type ClassOfferingScopeViewer = Pick<StaffAccount, "role" | "schoolCode" | "grantedSchoolCodes">;

function offeringId(className: string, session: string) {
  return `${session}-${className}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
}

function normalizeClassOffering(
  offering: ClassOffering,
  session: string,
): ClassOffering {
  const baseClassName = offering.baseClassName || inferBaseClassName(offering.className, offering.arm);
  const arm = offering.arm.trim();
  const className = combineClassArm(baseClassName, arm) || offering.className.trim();

  return {
    ...offering,
    id: offering.id || offeringId(className, offering.session || session),
    schoolCode: offering.schoolCode || school.schoolCode,
    session: offering.session || session,
    baseClassName,
    className,
    arm,
    subjectIds: Array.from(new Set(offering.subjectIds ?? [])),
    electiveSubjectIds: Array.from(new Set(offering.electiveSubjectIds ?? [])),
    pendingTeachers: Array.from(new Set(offering.pendingTeachers ?? [])),
    status: offering.status ?? "active",
    updatedAt: offering.updatedAt ?? "2026-05-16T08:00:00.000Z",
    updatedBy: offering.updatedBy ?? (school.schoolAdminName ?? "School Admin"),
  };
}

async function buildSeedStore() {
  const config = await readAcademicConfig();
  return classOfferings.map((offering) => normalizeClassOffering(offering, config.session));
}

async function ensureClassOfferingsStoreFile() {
  await mkdir(path.dirname(CLASS_OFFERINGS_STORE_PATH), { recursive: true });

  try {
    await readFile(CLASS_OFFERINGS_STORE_PATH, "utf8");
  } catch {
    await writeFile(CLASS_OFFERINGS_STORE_PATH, JSON.stringify(await buildSeedStore(), null, 2), "utf8");
  }
}

export async function readClassOfferings(): Promise<ClassOffering[]> {
  await ensureClassOfferingsStoreFile();
  const config = await readAcademicConfig();

  try {
    const fileContents = await readFile(CLASS_OFFERINGS_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as ClassOffering[];
    const normalized = parsed.map((offering) => normalizeClassOffering(offering, config.session));

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeClassOfferings(normalized);
    }

    return normalized.filter((offering) => offering.session === config.session);
  } catch {
    return buildSeedStore();
  }
}

export async function readAllClassOfferings(): Promise<ClassOffering[]> {
  await ensureClassOfferingsStoreFile();
  const config = await readAcademicConfig();

  try {
    const fileContents = await readFile(CLASS_OFFERINGS_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as ClassOffering[];
    const normalized = parsed.map((offering) => normalizeClassOffering(offering, config.session));

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeClassOfferings(normalized);
    }

    return normalized;
  } catch {
    return buildSeedStore();
  }
}

export async function writeClassOfferings(offerings: ClassOffering[]) {
  await ensureClassOfferingsStoreFile();
  const config = await readAcademicConfig();
  await writeFile(
    CLASS_OFFERINGS_STORE_PATH,
    JSON.stringify(
      offerings.map((offering) => normalizeClassOffering(offering, config.session)),
      null,
      2,
    ),
    "utf8",
  );
}

export async function readVisibleClassOfferings(viewer?: ClassOfferingScopeViewer | null) {
  const offerings = await readClassOfferings();

  if (!viewer) {
    return offerings;
  }

  return offerings.filter((offering) => canAccessSchool(viewer, offering.schoolCode || ""));
}

export async function getClassOffering(className: string) {
  const config = await readAcademicConfig();
  const offerings = await readAllClassOfferings();
  return offerings.find(
    (offering) => offering.className === className && offering.session === config.session,
  ) ?? null;
}

export async function saveClassOffering(
  nextOffering: ClassOffering,
  previousClassName?: string,
  previousSession?: string,
) {
  const offerings = await readAllClassOfferings();
  const matchClassName = previousClassName ?? nextOffering.className;
  const matchSession = previousSession ?? nextOffering.session;
  const existingIndex = offerings.findIndex(
    (offering) => offering.className === matchClassName && offering.session === matchSession,
  );

  if (existingIndex >= 0) {
    offerings[existingIndex] = nextOffering;
  } else {
    offerings.push(nextOffering);
  }

  await writeClassOfferings(offerings);
  return nextOffering;
}
