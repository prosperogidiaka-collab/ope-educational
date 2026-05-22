import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { canAccessSchool } from "@/lib/auth";
import { combineClassArm, inferBaseClassName } from "@/lib/class-structure";
import { school, subjectTeacherAssignments } from "@/lib/demo-data";
import type { StaffAccount, SubjectTeacherAssignment } from "@/lib/types";

const SUBJECT_TEACHER_ASSIGNMENTS_STORE_PATH = path.join(
  process.cwd(),
  "data",
  "subject-teacher-assignments.json",
);

type AssignmentScopeViewer = Pick<StaffAccount, "role" | "schoolCode" | "grantedSchoolCodes">;

function normalizeAssignment(assignment: SubjectTeacherAssignment): SubjectTeacherAssignment {
  const arm = assignment.arm.trim();
  const baseClassName = inferBaseClassName(assignment.className, arm);

  return {
    ...assignment,
    schoolCode: assignment.schoolCode || school.schoolCode,
    className: combineClassArm(baseClassName, arm) || assignment.className.trim(),
    arm,
    subjectType: assignment.subjectType ?? "core",
    active: assignment.active ?? true,
    assignmentSource: assignment.assignmentSource ?? "seed",
    manualOverride: assignment.manualOverride ?? false,
    assignedBy:
      assignment.schoolCode === school.schoolCode && assignment.assignedBy === school.principalName
        ? school.schoolAdminName ?? "School Admin"
        : assignment.assignedBy,
  };
}

function buildSeedStore() {
  return subjectTeacherAssignments.map(normalizeAssignment);
}

async function ensureSubjectTeacherAssignmentsStoreFile() {
  await mkdir(path.dirname(SUBJECT_TEACHER_ASSIGNMENTS_STORE_PATH), { recursive: true });

  try {
    await readFile(SUBJECT_TEACHER_ASSIGNMENTS_STORE_PATH, "utf8");
  } catch {
    await writeFile(
      SUBJECT_TEACHER_ASSIGNMENTS_STORE_PATH,
      JSON.stringify(buildSeedStore(), null, 2),
      "utf8",
    );
  }
}

export async function readSubjectTeacherAssignments(): Promise<SubjectTeacherAssignment[]> {
  await ensureSubjectTeacherAssignmentsStoreFile();

  try {
    const fileContents = await readFile(SUBJECT_TEACHER_ASSIGNMENTS_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as SubjectTeacherAssignment[];
    const normalized = parsed.map(normalizeAssignment);

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeSubjectTeacherAssignments(normalized);
    }

    return normalized;
  } catch {
    return buildSeedStore();
  }
}

export async function writeSubjectTeacherAssignments(assignments: SubjectTeacherAssignment[]) {
  await ensureSubjectTeacherAssignmentsStoreFile();
  await writeFile(
    SUBJECT_TEACHER_ASSIGNMENTS_STORE_PATH,
    JSON.stringify(assignments.map(normalizeAssignment), null, 2),
    "utf8",
  );
}

export async function getSubjectTeacherAssignment(assignmentId: string) {
  const assignments = await readSubjectTeacherAssignments();
  return assignments.find((assignment) => assignment.id === assignmentId) ?? null;
}

export async function listAssignmentsForTeacherAccount(accountId: string) {
  const assignments = await readSubjectTeacherAssignments();
  return assignments.filter((assignment) => assignment.active !== false && assignment.teacherAccountId === accountId);
}

export async function saveSubjectTeacherAssignment(nextAssignment: SubjectTeacherAssignment) {
  const assignments = await readSubjectTeacherAssignments();
  const nextAssignments = assignments.map((assignment) =>
    assignment.id === nextAssignment.id ? normalizeAssignment(nextAssignment) : assignment,
  );

  await writeSubjectTeacherAssignments(nextAssignments);
  return normalizeAssignment(nextAssignment);
}

export async function readVisibleSubjectTeacherAssignments(viewer?: AssignmentScopeViewer | null) {
  const assignments = await readSubjectTeacherAssignments();

  if (!viewer) {
    return assignments;
  }

  return assignments.filter((assignment) => assignment.active !== false && canAccessSchool(viewer, assignment.schoolCode));
}
