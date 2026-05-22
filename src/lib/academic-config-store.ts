import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import {
  buildRuntimeSchoolProfile,
  DEFAULT_ACADEMIC_CONFIG,
  normalizeAcademicConfig,
} from "@/lib/academic-config";
import { readResultLocks, writeResultLocks } from "@/lib/result-locks-store";
import { readStoredSchoolProfile } from "@/lib/school-profile-store";
import type { AcademicConfig } from "@/lib/types";

const ACADEMIC_CONFIG_STORE_PATH = path.join(process.cwd(), "data", "academic-config.json");

function buildSeedStore() {
  return DEFAULT_ACADEMIC_CONFIG;
}

async function ensureAcademicConfigStoreFile() {
  await mkdir(path.dirname(ACADEMIC_CONFIG_STORE_PATH), { recursive: true });

  try {
    await readFile(ACADEMIC_CONFIG_STORE_PATH, "utf8");
  } catch {
    await writeFile(ACADEMIC_CONFIG_STORE_PATH, JSON.stringify(buildSeedStore(), null, 2), "utf8");
  }
}

export async function readAcademicConfig(): Promise<AcademicConfig> {
  await ensureAcademicConfigStoreFile();

  try {
    const fileContents = await readFile(ACADEMIC_CONFIG_STORE_PATH, "utf8");
    return normalizeAcademicConfig(JSON.parse(fileContents) as AcademicConfig);
  } catch {
    return buildSeedStore();
  }
}

export async function writeAcademicConfig(config: AcademicConfig) {
  await ensureAcademicConfigStoreFile();
  const normalized = normalizeAcademicConfig(config);
  await writeFile(ACADEMIC_CONFIG_STORE_PATH, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

export async function saveAcademicConfig(config: AcademicConfig) {
  const normalized = await writeAcademicConfig(config);
  const currentLocks = await readResultLocks();
  const nextLocks = currentLocks.map((lock) => ({
    ...lock,
    id: `${lock.className}-${normalized.session}-${normalized.term}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase(),
    session: normalized.session,
    term: normalized.term,
    note: lock.locked
      ? `Locked after review and publication checks for ${lock.className}.`
      : `Open for assigned subject teachers in ${lock.className}.`,
  }));

  await writeResultLocks(nextLocks);

  return normalized;
}

export async function readRuntimeSchoolProfile() {
  const [config, schoolProfile] = await Promise.all([readAcademicConfig(), readStoredSchoolProfile()]);
  return buildRuntimeSchoolProfile(config, schoolProfile);
}
