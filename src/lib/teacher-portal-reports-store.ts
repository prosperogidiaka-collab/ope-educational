import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { canAccessSchool } from "@/lib/auth";
import { school } from "@/lib/demo-data";
import type { StaffAccount, TeacherPortalReportEntry } from "@/lib/types";

const TEACHER_PORTAL_REPORTS_STORE_PATH = path.join(process.cwd(), "data", "teacher-portal-reports.json");

type TeacherPortalReportScopeViewer = Pick<StaffAccount, "role" | "schoolCode" | "grantedSchoolCodes">;

function normalizeTeacherPortalReport(entry: TeacherPortalReportEntry): TeacherPortalReportEntry {
  return {
    ...entry,
    schoolCode: entry.schoolCode || school.schoolCode,
    showOnTeacherPortal: entry.showOnTeacherPortal !== false,
    attachmentLabel: entry.attachmentLabel?.trim() || undefined,
    attachmentUrl: entry.attachmentUrl?.trim() || undefined,
    attachmentMimeType: entry.attachmentMimeType?.trim() || undefined,
  };
}

function buildSeedStore(): TeacherPortalReportEntry[] {
  return [
    normalizeTeacherPortalReport({
      id: "teacher_report_001",
      schoolCode: school.schoolCode,
      teacherAccountId: "acct_teacher_001",
      teacherName: "Mr. Kalejaiye",
      category: "commendation",
      title: "Prompt score-entry and lesson delivery",
      body: "Mathematics lesson delivery and assessment turnaround for SS2 Gold were completed early this week. Keep the same pace as moderation closes.",
      showOnTeacherPortal: true,
      authorName: school.schoolAdminName ?? "School Admin",
      authorRole: "school_admin",
      createdAt: "2026-05-15T12:15:00.000Z",
      updatedAt: "2026-05-15T12:15:00.000Z",
    }),
  ];
}

async function ensureTeacherPortalReportsStoreFile() {
  await mkdir(path.dirname(TEACHER_PORTAL_REPORTS_STORE_PATH), { recursive: true });

  try {
    await readFile(TEACHER_PORTAL_REPORTS_STORE_PATH, "utf8");
  } catch {
    await writeFile(TEACHER_PORTAL_REPORTS_STORE_PATH, JSON.stringify(buildSeedStore(), null, 2), "utf8");
  }
}

export async function readTeacherPortalReports(): Promise<TeacherPortalReportEntry[]> {
  await ensureTeacherPortalReportsStoreFile();

  try {
    const fileContents = await readFile(TEACHER_PORTAL_REPORTS_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as TeacherPortalReportEntry[];
    const normalized = parsed.map(normalizeTeacherPortalReport);

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeTeacherPortalReports(normalized);
    }

    return normalized;
  } catch {
    return buildSeedStore();
  }
}

export async function writeTeacherPortalReports(entries: TeacherPortalReportEntry[]) {
  await ensureTeacherPortalReportsStoreFile();
  await writeFile(
    TEACHER_PORTAL_REPORTS_STORE_PATH,
    JSON.stringify(entries.map(normalizeTeacherPortalReport), null, 2),
    "utf8",
  );
}

export async function readVisibleTeacherPortalReports(viewer?: TeacherPortalReportScopeViewer | null) {
  const entries = await readTeacherPortalReports();

  if (!viewer) {
    return entries;
  }

  return entries.filter((entry) => canAccessSchool(viewer, entry.schoolCode));
}

export async function listTeacherPortalReportsForTeacherAccount(
  teacherAccountId: string,
  viewer?: TeacherPortalReportScopeViewer | null,
) {
  const entries = await readVisibleTeacherPortalReports(viewer);
  return entries.filter((entry) => entry.teacherAccountId === teacherAccountId && entry.showOnTeacherPortal);
}

export async function saveTeacherPortalReport(nextEntry: TeacherPortalReportEntry) {
  const entries = await readTeacherPortalReports();
  const existingIndex = entries.findIndex((entry) => entry.id === nextEntry.id);

  if (existingIndex >= 0) {
    entries[existingIndex] = normalizeTeacherPortalReport(nextEntry);
  } else {
    entries.unshift(normalizeTeacherPortalReport(nextEntry));
  }

  await writeTeacherPortalReports(entries);
  return normalizeTeacherPortalReport(nextEntry);
}
