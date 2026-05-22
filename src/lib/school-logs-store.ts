import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { canAccessSchool } from "@/lib/auth";
import { school } from "@/lib/demo-data";
import type { SchoolLogEntry, StaffAccount } from "@/lib/types";

const SCHOOL_LOGS_STORE_PATH = path.join(process.cwd(), "data", "school-logs.json");

type SchoolLogScopeViewer = Pick<StaffAccount, "role" | "schoolCode" | "grantedSchoolCodes">;

function normalizeSchoolLog(entry: SchoolLogEntry): SchoolLogEntry {
  return {
    ...entry,
    schoolCode: entry.schoolCode || school.schoolCode,
    reportingWindow: entry.reportingWindow?.trim() || undefined,
    visitorName: entry.visitorName?.trim() || undefined,
    visitorPurpose: entry.visitorPurpose?.trim() || undefined,
    attachmentLabel: entry.attachmentLabel?.trim() || undefined,
    attachmentUrl: entry.attachmentUrl?.trim() || undefined,
    attachmentMimeType: entry.attachmentMimeType?.trim() || undefined,
  };
}

function buildSeedStore(): SchoolLogEntry[] {
  return [
    normalizeSchoolLog({
      id: "school_log_001",
      schoolCode: school.schoolCode,
      category: "daily_report",
      title: "Daily school operations summary",
      body: "Morning assembly, lesson supervision, and sanitation checks were completed. Two late teachers were counselled and the science lab restock was escalated.",
      logDate: "2026-05-15",
      reportingWindow: "Daily",
      authorName: "Mrs. Folasade Adekunle",
      authorRole: "registrar",
      createdAt: "2026-05-15T15:20:00.000Z",
      updatedAt: "2026-05-15T15:20:00.000Z",
    }),
    normalizeSchoolLog({
      id: "school_log_002",
      schoolCode: school.schoolCode,
      category: "visitor",
      title: "Visitor log entry",
      body: "PTA chairman visited the school to review the inter-house sports readiness and speak with the school admin.",
      logDate: "2026-05-14",
      reportingWindow: "Visitor",
      visitorName: "Mr. Adeyemi",
      visitorPurpose: "PTA follow-up on sports preparations",
      authorName: "Mrs. Folasade Adekunle",
      authorRole: "registrar",
      createdAt: "2026-05-14T13:10:00.000Z",
      updatedAt: "2026-05-14T13:10:00.000Z",
    }),
  ];
}

async function ensureSchoolLogsStoreFile() {
  await mkdir(path.dirname(SCHOOL_LOGS_STORE_PATH), { recursive: true });

  try {
    await readFile(SCHOOL_LOGS_STORE_PATH, "utf8");
  } catch {
    await writeFile(SCHOOL_LOGS_STORE_PATH, JSON.stringify(buildSeedStore(), null, 2), "utf8");
  }
}

export async function readSchoolLogs(): Promise<SchoolLogEntry[]> {
  await ensureSchoolLogsStoreFile();

  try {
    const fileContents = await readFile(SCHOOL_LOGS_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as SchoolLogEntry[];
    const normalized = parsed.map(normalizeSchoolLog);

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeSchoolLogs(normalized);
    }

    return normalized;
  } catch {
    return buildSeedStore();
  }
}

export async function writeSchoolLogs(entries: SchoolLogEntry[]) {
  await ensureSchoolLogsStoreFile();
  await writeFile(
    SCHOOL_LOGS_STORE_PATH,
    JSON.stringify(entries.map(normalizeSchoolLog), null, 2),
    "utf8",
  );
}

export async function readVisibleSchoolLogs(viewer?: SchoolLogScopeViewer | null) {
  const entries = await readSchoolLogs();

  if (!viewer) {
    return entries;
  }

  return entries.filter((entry) => canAccessSchool(viewer, entry.schoolCode));
}

export async function saveSchoolLog(nextEntry: SchoolLogEntry) {
  const entries = await readSchoolLogs();
  const existingIndex = entries.findIndex((entry) => entry.id === nextEntry.id);

  if (existingIndex >= 0) {
    entries[existingIndex] = normalizeSchoolLog(nextEntry);
  } else {
    entries.unshift(normalizeSchoolLog(nextEntry));
  }

  await writeSchoolLogs(entries);
  return normalizeSchoolLog(nextEntry);
}
