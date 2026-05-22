import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { normalizeComponentScoreMap } from "@/lib/academic-config";
import { resultBundles, subjects } from "@/lib/demo-data";
import type { TeacherScoreSheetDraft, TeacherScoreSheetStore } from "@/lib/teacher-scores";

const TEACHER_SCORES_STORE_PATH = path.join(process.cwd(), "data", "teacher-scores.json");
const SEED_TIMESTAMP = "2026-04-08T08:42:00.000Z";

/**
 * Builds an initial set of teacher score sheets from the seeded demo bundles so that every
 * subject is immediately reviewable on the Class Review board (and visible on the Audit desk)
 * without a teacher having to re-key the data first.
 */
function buildSeedStore(): TeacherScoreSheetStore {
  const store: TeacherScoreSheetStore = {};

  for (const subject of subjects) {
    const rows = resultBundles
      .filter((bundle) => bundle.student.registeredSubjectIds.includes(subject.id))
      .map((bundle) => {
        const score = bundle.scores.find((entry) => entry.subjectId === subject.id);

        return {
          regNumber: bundle.student.regNumber,
          fullName: bundle.student.fullName,
          componentScores: normalizeComponentScoreMap(score?.componentScores, undefined, {
            test1: score?.test1,
            test2: score?.test2,
            exam: score?.exam,
          }),
          test1: score?.test1 ?? null,
          test2: score?.test2 ?? null,
          exam: score?.exam ?? null,
          teacherComment: score?.teacherComment ?? "",
          status: score?.status ?? ("submitted" as const),
        };
      });

    if (rows.length === 0) {
      continue;
    }

    const hasIncomplete = rows.some((row) => Object.values(row.componentScores).some((value) => value === null));

    store[subject.id] = {
      assignmentId: subject.id,
      subjectCode: subject.code,
      subjectName: subject.name,
      className: subject.className,
      teacherName: subject.teacherName,
      sheetStatus: hasIncomplete ? "draft" : "submitted",
      rows,
      updatedAt: SEED_TIMESTAMP,
      submittedAt: hasIncomplete ? undefined : SEED_TIMESTAMP,
    };
  }

  return store;
}

function isEmptyStore(value: unknown): value is Record<string, never> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0;
}

async function ensureTeacherScoresStoreFile() {
  await mkdir(path.dirname(TEACHER_SCORES_STORE_PATH), { recursive: true });

  let existing: string | null = null;

  try {
    existing = await readFile(TEACHER_SCORES_STORE_PATH, "utf8");
  } catch {
    existing = null;
  }

  let needsSeed = existing === null;

  if (!needsSeed && existing !== null) {
    try {
      needsSeed = isEmptyStore(JSON.parse(existing));
    } catch {
      needsSeed = true;
    }
  }

  if (needsSeed) {
    await writeFile(TEACHER_SCORES_STORE_PATH, JSON.stringify(buildSeedStore(), null, 2), "utf8");
  }
}

export async function readTeacherScoresStore(): Promise<TeacherScoreSheetStore> {
  await ensureTeacherScoresStoreFile();

  try {
    const fileContents = await readFile(TEACHER_SCORES_STORE_PATH, "utf8");
    return JSON.parse(fileContents) as TeacherScoreSheetStore;
  } catch {
    return buildSeedStore();
  }
}

export async function writeTeacherScoresStore(store: TeacherScoreSheetStore) {
  await mkdir(path.dirname(TEACHER_SCORES_STORE_PATH), { recursive: true });
  await writeFile(TEACHER_SCORES_STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function getTeacherScoreSheet(assignmentId: string) {
  const store = await readTeacherScoresStore();
  return store[assignmentId] ?? null;
}

export async function saveTeacherScoreSheet(assignmentId: string, draft: TeacherScoreSheetDraft) {
  const store = await readTeacherScoresStore();
  store[assignmentId] = draft;
  await writeTeacherScoresStore(store);
  return draft;
}

export async function deleteTeacherScoreSheet(assignmentId: string) {
  const store = await readTeacherScoresStore();
  delete store[assignmentId];
  await writeTeacherScoresStore(store);
}
