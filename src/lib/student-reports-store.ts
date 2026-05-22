import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { canAccessSchool } from "@/lib/auth";
import { classOfferings, resultBundles, school } from "@/lib/demo-data";
import type { StaffAccount, StudentReportEntry } from "@/lib/types";

const STUDENT_REPORTS_STORE_PATH = path.join(process.cwd(), "data", "student-reports.json");
const REPORT_SEED_TIMESTAMP = "2026-04-11T14:20:00.000Z";

type StudentReportScopeViewer = Pick<StaffAccount, "role" | "schoolCode" | "grantedSchoolCodes">;

function normalizeStudentReport(report: StudentReportEntry): StudentReportEntry {
  return {
    ...report,
    schoolCode: report.schoolCode || school.schoolCode,
    showOnPortal: Boolean(report.showOnPortal),
    showOnResultSheet: Boolean(report.showOnResultSheet),
    praise: Boolean(report.praise),
    attachmentLabel: report.attachmentLabel?.trim() || undefined,
    attachmentUrl: report.attachmentUrl?.trim() || undefined,
    updatedAt: report.updatedAt || report.createdAt,
  };
}

function buildSeedStore(): StudentReportEntry[] {
  return resultBundles.flatMap((bundle, index) => {
    const student = bundle.student;
    const classOffering = classOfferings.find((item) => item.className === student.className);
    const classTeacherName = classOffering?.classTeacher ?? "Class Teacher";
    const baseDate = `2026-04-${(11 + index).toString().padStart(2, "0")}T14:20:00.000Z`;

    return [
      normalizeStudentReport({
        id: `student_report_${index + 1}_remark`,
        schoolCode: school.schoolCode,
        regNumber: student.regNumber,
        studentName: student.fullName,
        className: student.className,
        title: "Class teacher term remark",
        body: student.classTeacherComment,
        category: "result_comment",
        authorName: classTeacherName,
        authorRole: "class_teacher",
        showOnPortal: true,
        showOnResultSheet: true,
        praise: false,
        createdAt: baseDate,
        updatedAt: baseDate,
      }),
      normalizeStudentReport({
        id: `student_report_${index + 1}_praise`,
        schoolCode: school.schoolCode,
        regNumber: student.regNumber,
        studentName: student.fullName,
        className: student.className,
        title: "Teacher praise and follow-up",
        body: student.teacherRemark,
        category: "praise",
        authorName: school.schoolAdminName ?? "School Admin",
        authorRole: "school_admin",
        showOnPortal: true,
        showOnResultSheet: false,
        praise: true,
        createdAt: REPORT_SEED_TIMESTAMP,
        updatedAt: REPORT_SEED_TIMESTAMP,
      }),
      normalizeStudentReport({
        id: `student_report_${index + 1}_improvement`,
        schoolCode: school.schoolCode,
        regNumber: student.regNumber,
        studentName: student.fullName,
        className: student.className,
        title: "Improvement focus",
        body: student.improvementComment,
        category: "guidance",
        authorName: classTeacherName,
        authorRole: "class_teacher",
        showOnPortal: true,
        showOnResultSheet: false,
        praise: false,
        createdAt: `2026-04-${(15 + index).toString().padStart(2, "0")}T10:10:00.000Z`,
        updatedAt: `2026-04-${(15 + index).toString().padStart(2, "0")}T10:10:00.000Z`,
      }),
    ];
  });
}

async function ensureStudentReportsStoreFile() {
  await mkdir(path.dirname(STUDENT_REPORTS_STORE_PATH), { recursive: true });

  try {
    await readFile(STUDENT_REPORTS_STORE_PATH, "utf8");
  } catch {
    await writeFile(STUDENT_REPORTS_STORE_PATH, JSON.stringify(buildSeedStore(), null, 2), "utf8");
  }
}

export async function readStudentReports(): Promise<StudentReportEntry[]> {
  await ensureStudentReportsStoreFile();

  try {
    const fileContents = await readFile(STUDENT_REPORTS_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as StudentReportEntry[];
    const normalized = parsed.map(normalizeStudentReport);

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeStudentReports(normalized);
    }

    return normalized;
  } catch {
    return buildSeedStore();
  }
}

export async function writeStudentReports(reports: StudentReportEntry[]) {
  await ensureStudentReportsStoreFile();
  await writeFile(
    STUDENT_REPORTS_STORE_PATH,
    JSON.stringify(reports.map(normalizeStudentReport), null, 2),
    "utf8",
  );
}

export async function readVisibleStudentReports(viewer?: StudentReportScopeViewer | null) {
  const reports = await readStudentReports();

  if (!viewer) {
    return reports;
  }

  return reports.filter((report) => canAccessSchool(viewer, report.schoolCode));
}

export async function listStudentReportsForRegNumber(regNumber: string, viewer?: StudentReportScopeViewer | null) {
  const reports = await readVisibleStudentReports(viewer);
  return reports.filter((report) => report.regNumber === regNumber);
}

export async function saveStudentReport(nextReport: StudentReportEntry) {
  const reports = await readStudentReports();
  const existingIndex = reports.findIndex((report) => report.id === nextReport.id);

  if (existingIndex >= 0) {
    reports[existingIndex] = normalizeStudentReport(nextReport);
  } else {
    reports.unshift(normalizeStudentReport(nextReport));
  }

  await writeStudentReports(reports);
  return normalizeStudentReport(nextReport);
}
