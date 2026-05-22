import { formatDate, formatDateOnly, getScoreValue, ordinal, resultStatusLabel } from "@/lib/calculations";
import type {
  AcademicConfig,
  GradeBand,
  PdfTemplate,
  RatingItem,
  SchoolProfile,
  ScoreField,
  StudentSummary,
} from "@/lib/types";

export interface GradeLegendEntry {
  label: string;
  range: string;
  remark: string;
}

const DEFAULT_GRADE_LEGEND: GradeLegendEntry[] = [
  { label: "A", range: "75 - 100", remark: "Excellent" },
  { label: "B", range: "65 - 74", remark: "Very Good" },
  { label: "C", range: "55 - 64", remark: "Good" },
  { label: "D", range: "45 - 54", remark: "Fair" },
  { label: "E", range: "40 - 44", remark: "Pass" },
  { label: "F", range: "0 - 39", remark: "Needs Support" },
];

const REPORT_DISCLAIMER =
  "This report is computer-generated and is only valid with the school's official stamp and the verification ID shown below. Any alteration renders it void.";

function buildGradeLegend(gradeBands?: GradeBand[]): GradeLegendEntry[] {
  if (!gradeBands || gradeBands.length === 0) {
    return DEFAULT_GRADE_LEGEND;
  }

  return [...gradeBands]
    .sort((left, right) => right.min - left.min)
    .map((band) => ({ label: band.label, range: `${band.min} - ${band.max}`, remark: band.remark }));
}

export interface BuildResultSheetOptions {
  classSize?: number;
  gradeBands?: GradeBand[];
  generatedAt?: string;
  academicConfig?: AcademicConfig;
}

export interface ResultSheetSubjectRow {
  id: string;
  subjectName: string;
  test1: string;
  test2: string;
  continuousAssessment: string;
  exam: string;
  total: string;
  grade: string;
  classAverage: string;
  classHighest: string;
  classLowest: string;
  subjectPosition: string;
  teacherRemark: string;
}

export interface ResultSheetDraft {
  regNumberKey: string;
  template: PdfTemplate;
  status: string;
  schoolCode: string;
  logoUrl: string;
  watermarkLogoUrl: string;
  governmentStampUrl: string;
  principalSignatureUrl: string;
  classTeacherSignatureUrl: string;
  schoolName: string;
  schoolMotto: string;
  schoolAddress: string;
  schoolSession: string;
  schoolTerm: string;
  schoolExamType: string;
  principalName: string;
  portalSlug: string;
  studentName: string;
  regNumber: string;
  className: string;
  classSize: string;
  house: string;
  gender: string;
  dateOfBirth: string;
  age: string;
  guardianName: string;
  photoInitials: string;
  passportUrl?: string;
  position: string;
  total: string;
  totalObtainable: string;
  average: string;
  weightedAverage: string;
  overallGrade: string;
  overallRemark: string;
  gpa: string;
  attendancePresent: string;
  attendanceAbsent: string;
  attendanceLate: string;
  attendanceExcused: string;
  attendancePossible: string;
  attendancePercent: string;
  bestSubject: string;
  weakestSubject: string;
  feeStatus: string;
  resumptionDate: string;
  subjectTeacherRemark: string;
  classTeacherRemark: string;
  principalRemark: string;
  verificationId: string;
  publishedAt: string;
  generatedOn: string;
  disclaimer: string;
  gradeLegend: GradeLegendEntry[];
  affectiveRatings: RatingItem[];
  psychomotorRatings: RatingItem[];
  trend: {
    label: string;
    average: number;
  }[];
  subjectRows: ResultSheetSubjectRow[];
}

export type ResultSheetDraftStore = Record<string, ResultSheetDraft>;

function subjectScoreValue(entry: StudentSummary["computedSubjects"][number], field: ScoreField) {
  const value = getScoreValue(entry, field);
  return value === null ? "-" : String(value);
}

export function buildResultSheetDraft(
  school: SchoolProfile,
  summary: StudentSummary,
  options?: BuildResultSheetOptions,
): ResultSheetDraft {
  const attendance = summary.bundle.student.attendance;
  const academicConfig = options?.academicConfig;
  const activeComponentKeys = new Set(academicConfig?.scoreComponents.map((component) => component.key) ?? []);
  const totalWeight =
    academicConfig?.scoreComponents.reduce((sum, component) => sum + component.weight, 0) ?? 100;
  const subjectCount = summary.computedSubjects.length;
  const attendancePercent = attendance.possible
    ? `${Math.round((attendance.present / attendance.possible) * 100)}%`
    : "N/A";

  return {
    regNumberKey: summary.bundle.student.regNumber,
    template: summary.bundle.template,
    status: resultStatusLabel(summary.bundle.status),
    schoolCode: school.schoolCode,
    logoUrl: school.logoUrl,
    watermarkLogoUrl: school.watermarkLogoUrl,
    governmentStampUrl: school.governmentStampUrl,
    principalSignatureUrl: "/assets/principal-signature.svg",
    classTeacherSignatureUrl: "/assets/class-teacher-signature.svg",
    schoolName: school.name,
    schoolMotto: school.motto,
    schoolAddress: school.address,
    schoolSession: school.session,
    schoolTerm: school.term,
    schoolExamType: school.examType,
    principalName: school.principalName,
    portalSlug: school.portalSlug,
    studentName: summary.bundle.student.fullName,
    regNumber: summary.bundle.student.regNumber,
    className: summary.bundle.student.className,
    classSize: options?.classSize ? String(options.classSize) : "",
    house: summary.bundle.student.house,
    gender: summary.bundle.student.gender,
    dateOfBirth: summary.bundle.student.dateOfBirth ? formatDateOnly(summary.bundle.student.dateOfBirth) : "N/A",
    age: summary.bundle.student.age ? String(summary.bundle.student.age) : "N/A",
    guardianName: summary.bundle.student.guardianName,
    photoInitials: summary.bundle.student.photoInitials,
    passportUrl: summary.bundle.student.passportUrl,
    position: summary.position > 0 ? ordinal(summary.position) : "Not ranked",
    total: String(summary.total),
    totalObtainable: String(subjectCount * totalWeight),
    average: `${summary.average}%`,
    weightedAverage: `${summary.weightedAverage}%`,
    overallGrade: summary.overallGrade.label,
    overallRemark: summary.overallGrade.remark,
    gpa: summary.gradePoints.toFixed(2),
    attendancePresent: String(attendance.present),
    attendanceAbsent: String(attendance.absent),
    attendanceLate: String(attendance.late),
    attendanceExcused: String(attendance.excused ?? 0),
    attendancePossible: String(attendance.possible),
    attendancePercent,
    bestSubject: summary.bestSubject?.subjectName ?? "N/A",
    weakestSubject: summary.weakestSubject?.subjectName ?? "N/A",
    feeStatus: resultStatusLabel(summary.bundle.student.feeStatus),
    resumptionDate: formatDateOnly(school.nextResumptionDate),
    subjectTeacherRemark: summary.overallGrade.remark,
    classTeacherRemark: summary.bundle.student.classTeacherComment,
    principalRemark: summary.bundle.student.principalComment || summary.overallRemarkSuggestion,
    verificationId: summary.bundle.verificationId,
    publishedAt: summary.bundle.publishedAt ? formatDateOnly(summary.bundle.publishedAt) : "Pending release",
    generatedOn: formatDate(options?.generatedAt ?? new Date().toISOString()),
    disclaimer: REPORT_DISCLAIMER,
    gradeLegend: buildGradeLegend(options?.gradeBands),
    affectiveRatings: summary.bundle.student.affectiveRatings,
    psychomotorRatings: summary.bundle.student.psychomotorRatings,
    trend: summary.bundle.student.trend,
    subjectRows: summary.computedSubjects.map((entry) => {
      const test1Active = activeComponentKeys.size === 0 || activeComponentKeys.has("test1");
      const test2Active = activeComponentKeys.size === 0 || activeComponentKeys.has("test2");
      const examActive = activeComponentKeys.size === 0 || activeComponentKeys.has("exam");
      const continuousAssessmentValue =
        (test1Active ? entry.test1 ?? 0 : 0) + (test2Active ? entry.test2 ?? 0 : 0);
      return {
        id: entry.subjectId,
        subjectName: entry.subjectName,
        test1: test1Active ? subjectScoreValue(entry, "test1") : "-",
        test2: test2Active ? subjectScoreValue(entry, "test2") : "-",
        continuousAssessment: entry.isIncomplete ? "-" : String(continuousAssessmentValue),
        exam: examActive ? subjectScoreValue(entry, "exam") : "-",
        total: String(entry.total),
        grade: entry.isIncomplete ? "Incomplete" : entry.grade.label,
        classAverage: `${entry.classAverage}%`,
        classHighest: entry.classHighest ? String(entry.classHighest) : "-",
        classLowest: entry.classLowest ? String(entry.classLowest) : "-",
        subjectPosition: entry.isIncomplete || entry.subjectPosition <= 0 ? "-" : ordinal(entry.subjectPosition),
        teacherRemark: entry.teacherComment ?? "",
      };
    }),
  };
}

export function mergeResultSheetDraft(
  baseDraft: ResultSheetDraft,
  overrideDraft?: Partial<ResultSheetDraft> | null,
): ResultSheetDraft {
  if (!overrideDraft) {
    return baseDraft;
  }

  const overrideRows = overrideDraft.subjectRows ?? [];

  return {
    ...baseDraft,
    ...overrideDraft,
    subjectRows:
      overrideRows.length > 0
        ? baseDraft.subjectRows.map((row) => ({
            ...row,
            ...(overrideRows.find((overrideRow) => overrideRow.id === row.id) ?? {}),
          }))
        : baseDraft.subjectRows,
  };
}
