import {
  buildLegacyScoreSnapshot,
  normalizeComponentScoreMap,
} from "@/lib/academic-config";
import type { AcademicConfig, ResultStatus, TeacherGridRow } from "@/lib/types";

export interface TeacherScoreSheetRow {
  regNumber: string;
  fullName: string;
  componentScores: Record<string, number | null>;
  test1: number | null;
  test2: number | null;
  exam: number | null;
  teacherComment: string;
  status: ResultStatus;
}

export interface TeacherScoreSheetDraft {
  assignmentId: string;
  subjectCode: string;
  subjectName: string;
  className: string;
  teacherName: string;
  sheetStatus: ResultStatus;
  rows: TeacherScoreSheetRow[];
  updatedAt: string;
  submittedAt?: string;
  /** Last account that changed score rows or comments on this sheet. */
  lastEditedBy?: string;
  lastEditedByRole?: string;
  /** Set by a reviewer (HOD / principal / assigned reviewer) when sending a sheet back. */
  reviewNote?: string;
  reviewedBy?: string;
  reviewedByRole?: string;
  reviewedAt?: string;
}

export type TeacherScoreSheetStore = Record<string, TeacherScoreSheetDraft>;

export function teacherGridRowToSheetRow(row: TeacherGridRow, config?: AcademicConfig): TeacherScoreSheetRow {
  const componentScores = normalizeComponentScoreMap(row.componentScores, config, {
    test1: row.test1,
    test2: row.test2,
    exam: row.exam,
  });
  const legacyScores = buildLegacyScoreSnapshot(componentScores, config);

  return {
    regNumber: row.regNumber,
    fullName: row.fullName,
    componentScores,
    test1: legacyScores.test1,
    test2: legacyScores.test2,
    exam: legacyScores.exam,
    teacherComment: row.teacherComment ?? "",
    status: row.status,
  };
}

export function mergeTeacherSheetRows(
  baseRows: TeacherGridRow[],
  savedRows: TeacherScoreSheetRow[] | null | undefined,
  config?: AcademicConfig,
): TeacherGridRow[] {
  if (!savedRows || savedRows.length === 0) {
    return baseRows;
  }

  const byReg = new Map(savedRows.map((row) => [row.regNumber, row]));

  return baseRows.map((row) => {
    const saved = byReg.get(row.regNumber);

    if (!saved) {
      return row;
    }

    const componentScores = normalizeComponentScoreMap(saved.componentScores, config, {
      test1: saved.test1,
      test2: saved.test2,
      exam: saved.exam,
    });
    const legacyScores = buildLegacyScoreSnapshot(componentScores, config);

    return {
      ...row,
      componentScores,
      test1: legacyScores.test1,
      test2: legacyScores.test2,
      exam: legacyScores.exam,
      teacherComment: typeof saved.teacherComment === "string" ? saved.teacherComment : row.teacherComment,
      status: saved.status === "locked" ? "submitted" : saved.status || row.status,
    };
  });
}
