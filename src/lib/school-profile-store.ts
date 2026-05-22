import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { school } from "@/lib/demo-data";
import type { SchoolProfile } from "@/lib/types";

const SCHOOL_PROFILE_STORE_PATH = path.join(process.cwd(), "data", "school-profile.json");

function readText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeSchoolProfile(profile: SchoolProfile): SchoolProfile {
  return {
    ...school,
    ...profile,
    schoolCode: readText(profile.schoolCode, school.schoolCode).toUpperCase(),
    name: readText(profile.name, school.name),
    shortName: readText(profile.shortName, school.shortName),
    motto: readText(profile.motto, school.motto),
    address: readText(profile.address, school.address),
    principalName: readText(profile.principalName, school.principalName),
    schoolAdminName: readText(profile.schoolAdminName, school.schoolAdminName ?? "School Admin"),
    schoolAdminEmail: readText(profile.schoolAdminEmail, school.schoolAdminEmail ?? "admin@ope.edu.ng").toLowerCase(),
    session: readText(profile.session, school.session),
    term: readText(profile.term, school.term),
    examType: readText(profile.examType, school.examType),
    portalSlug: readText(profile.portalSlug, school.portalSlug).toLowerCase(),
    nextResumptionDate: readText(profile.nextResumptionDate, school.nextResumptionDate),
    logoUrl: readText(profile.logoUrl, school.logoUrl),
    watermarkLogoUrl: readText(profile.watermarkLogoUrl, school.watermarkLogoUrl),
    governmentStampUrl: readText(profile.governmentStampUrl, school.governmentStampUrl),
  };
}

async function ensureSchoolProfileStoreFile() {
  await mkdir(path.dirname(SCHOOL_PROFILE_STORE_PATH), { recursive: true });

  try {
    await readFile(SCHOOL_PROFILE_STORE_PATH, "utf8");
  } catch {
    await writeFile(SCHOOL_PROFILE_STORE_PATH, JSON.stringify(school, null, 2), "utf8");
  }
}

export async function readStoredSchoolProfile(): Promise<SchoolProfile> {
  await ensureSchoolProfileStoreFile();

  try {
    const fileContents = await readFile(SCHOOL_PROFILE_STORE_PATH, "utf8");
    const parsed = normalizeSchoolProfile(JSON.parse(fileContents) as SchoolProfile);

    if (JSON.stringify(JSON.parse(fileContents)) !== JSON.stringify(parsed)) {
      await writeStoredSchoolProfile(parsed);
    }

    return parsed;
  } catch {
    return normalizeSchoolProfile(school);
  }
}

export async function writeStoredSchoolProfile(profile: SchoolProfile) {
  await ensureSchoolProfileStoreFile();
  const normalized = normalizeSchoolProfile(profile);
  await writeFile(SCHOOL_PROFILE_STORE_PATH, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}
