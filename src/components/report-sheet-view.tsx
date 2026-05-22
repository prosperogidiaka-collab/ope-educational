import Link from "next/link";
import type { ReactNode } from "react";

import { PrintButton } from "@/components/print-button";
import { buildAcademicComponentLabels, buildAssessmentBreakdown } from "@/lib/academic-config";
import type {
  ResultSheetDraft,
  ResultSheetSubjectRow,
} from "@/lib/report-sheet";
import type {
  AcademicConfig,
  ResultTemplateSchema,
  TemplateAcademicColumn,
  TemplateZoneId,
} from "@/lib/types";

interface ReportSheetViewProps {
  draft: ResultSheetDraft;
  templateSchema?: ResultTemplateSchema;
  verificationHref?: string;
  showActions?: boolean;
  academicConfig?: AcademicConfig;
}

function buildVerificationPattern(seed: string) {
  return Array.from({ length: 81 }, (_, index) => {
    const value = seed.charCodeAt(index % seed.length) + index * 7;
    return value % 3 === 0;
  });
}

function renderAcademicCell(row: ResultSheetSubjectRow, column: TemplateAcademicColumn) {
  const values: Record<TemplateAcademicColumn, string> = {
    test1: row.test1,
    test2: row.test2,
    exam: row.exam,
    total: row.total,
    grade: row.grade,
    subjectPosition: row.subjectPosition,
    classAverage: row.classAverage,
    classHighest: row.classHighest,
    classLowest: row.classLowest,
    teacherRemark: row.teacherRemark,
  };

  return values[column];
}

export const academicColumnLabels: Record<TemplateAcademicColumn, string> = {
  test1: "Test 1",
  test2: "Test 2",
  exam: "Exam",
  total: "Total",
  grade: "Grade",
  subjectPosition: "Subject Pos.",
  classAverage: "Class Avg.",
  classHighest: "Class Highest",
  classLowest: "Class Lowest",
  teacherRemark: "Subject Teacher's Remark",
};

function resolvedAcademicColumnLabels(academicConfig?: AcademicConfig) {
  const componentLabels = academicConfig ? buildAcademicComponentLabels(academicConfig) : null;

  return {
    ...academicColumnLabels,
    test1: componentLabels?.test1 ?? academicColumnLabels.test1,
    test2: componentLabels?.test2 ?? academicColumnLabels.test2,
    exam: componentLabels?.exam ?? academicColumnLabels.exam,
  };
}

const defaultSchema: ResultTemplateSchema = {
  id: "default_live_schema",
  name: "Default",
  summary: "Compact one-page result layout.",
  primaryColor: "#0f4c5c",
  fontFamily: "Georgia",
  borderStyle: "executive",
  terminology: {
    termLabel: "Term",
    teacherRemarkLabel: "Subject Teacher",
    classTeacherRemarkLabel: "Class Teacher",
    principalRemarkLabel: "Principal",
  },
  zones: ["header", "student_bio", "academic_table", "remarks"],
  header: {
    logoPosition: "left",
    showSchoolName: true,
    showAddress: true,
    showSchoolCode: true,
    showGovernmentStamp: false,
  },
  studentBio: {
    showPassport: false,
    showDob: false,
    showAge: false,
    showGender: false,
    showRegNumber: true,
    showHouse: true,
    showHostel: false,
  },
  academicTable: {
    columns: ["exam", "total", "grade"],
  },
  qualitative: {
    showAffective: false,
    showPsychomotor: false,
  },
  signatures: {
    showClassTeacherSignature: false,
    showPrincipalSignature: false,
  },
  watermark: {
    enabled: true,
    opacity: 0.05,
  },
  controls: {
    showGradingLegend: false,
    showTrendAnalysis: false,
    showVerificationQr: true,
    previewWithSampleData: true,
  },
};

export function ReportSheetView({
  draft,
  templateSchema,
  verificationHref,
  showActions = true,
  academicConfig,
}: ReportSheetViewProps) {
  const schema = templateSchema ?? defaultSchema;
  const columnLabels = resolvedAcademicColumnLabels(academicConfig);
  const verificationPattern = buildVerificationPattern(`${draft.regNumberKey}-${draft.verificationId}`);
  const facts = [
    { label: "Best Subject", value: draft.bestSubject },
    { label: "Weakest Subject", value: draft.weakestSubject },
    { label: "Fee Status", value: draft.feeStatus },
    { label: "Resumption", value: draft.resumptionDate },
  ];
  const remarks = [
    { label: schema.terminology.teacherRemarkLabel, value: draft.subjectTeacherRemark },
    { label: schema.terminology.classTeacherRemarkLabel, value: draft.classTeacherRemark },
    { label: schema.terminology.principalRemarkLabel, value: draft.principalRemark },
  ];
  const bioDetails = [
    { label: "Student", value: draft.studentName, enabled: true },
    { label: "Reg Number", value: draft.regNumber, enabled: schema.studentBio.showRegNumber },
    { label: "Class", value: draft.className, enabled: true },
    { label: "House", value: draft.house, enabled: schema.studentBio.showHouse },
    { label: "Gender", value: draft.gender, enabled: schema.studentBio.showGender },
    { label: "Date of Birth", value: draft.dateOfBirth, enabled: schema.studentBio.showDob },
    { label: "Age", value: draft.age, enabled: schema.studentBio.showAge },
    { label: "Guardian", value: draft.guardianName, enabled: true },
    { label: "Position", value: draft.position, enabled: true },
  ].filter((item) => item.enabled);
  const visibleAcademicColumns = schema.academicTable.columns.length > 0 ? schema.academicTable.columns : defaultSchema.academicTable.columns;

  const zoneViews: Record<TemplateZoneId, ReactNode> = {
    header: (
      <header
        className={`report-header report-header-logo-${schema.header.logoPosition}`}
        key="header"
        style={{ ["--report-primary" as string]: schema.primaryColor, fontFamily: schema.fontFamily }}
      >
        {schema.watermark.enabled && (schema.watermark.imageUrl ?? draft.watermarkLogoUrl) ? (
          <img
            src={schema.watermark.imageUrl ?? draft.watermarkLogoUrl}
            alt=""
            aria-hidden="true"
            className="report-watermark-image"
            style={{ opacity: schema.watermark.opacity }}
          />
        ) : null}

        <div className="report-watermark">{draft.status}</div>

        {showActions ? (
          <div className="report-actions no-print">
            <PrintButton />
            {verificationHref ? (
              <Link href={verificationHref} className="secondary-button">
                Verify Result
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="report-brand">
          <div className="report-logo-frame">
            <img
              src={schema.header.logoUrl ?? draft.logoUrl}
              alt={`${draft.schoolName} logo`}
              className="report-logo-image"
            />
          </div>
          <div className="report-copy">
            <p className="eyebrow">Official Student Result</p>
            {schema.header.showSchoolName ? <h1>{draft.schoolName}</h1> : null}
            {draft.schoolMotto ? <p className="report-motto">&ldquo;{draft.schoolMotto}&rdquo;</p> : null}
            {schema.header.showAddress ? <p>{draft.schoolAddress}</p> : null}
            <p>
              {draft.schoolSession} Academic Session - {draft.schoolTerm} - {draft.schoolExamType}
            </p>
            {schema.header.showSchoolCode ? (
              <p className="report-school-code">School Code: {draft.schoolCode}</p>
            ) : null}
          </div>
          {schema.header.showGovernmentStamp ? (
            <img
              src={schema.header.governmentStampUrl ?? draft.governmentStampUrl}
              alt="Government approval stamp"
              className="report-stamp-image"
            />
          ) : null}
        </div>

        <div className="report-header-side">
          <span className={`status-pill status-${draft.status.toLowerCase().replace(/\s+/g, "_")}`}>
            {draft.status}
          </span>
          <div className="student-photo">
            {schema.studentBio.showPassport && draft.passportUrl ? (
              <img src={draft.passportUrl} alt={`${draft.studentName} passport`} className="student-photo-image" />
            ) : (
              <span>{draft.photoInitials}</span>
            )}
          </div>
        </div>
      </header>
    ),
    student_bio: (
      <section className="report-overview-grid" key="student_bio">
        <article className="report-panel">
          <p className="eyebrow">Student Information</p>
          <div className="report-meta-grid">
            {bioDetails.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="report-panel">
          <p className="eyebrow">Performance Summary</p>
          <div className="report-score-grid">
            <div>
              <span>Total Scored</span>
              <strong>{draft.total} / {draft.totalObtainable}</strong>
            </div>
            <div>
              <span>Average</span>
              <strong>{draft.average}</strong>
            </div>
            <div>
              <span>Weighted Avg.</span>
              <strong>{draft.weightedAverage}</strong>
            </div>
            <div>
              <span>Overall Grade</span>
              <strong>{draft.overallGrade}</strong>
            </div>
            <div>
              <span>GPA</span>
              <strong>{draft.gpa}</strong>
            </div>
            <div>
              <span>Position</span>
              <strong>
                {draft.position}
                {draft.classSize ? ` of ${draft.classSize}` : ""}
              </strong>
            </div>
          </div>
          <div className="report-mini-grid">
            <div>
              <span>Present</span>
              <strong>{draft.attendancePresent}</strong>
            </div>
            <div>
              <span>Absent</span>
              <strong>{draft.attendanceAbsent}</strong>
            </div>
            <div>
              <span>Late</span>
              <strong>{draft.attendanceLate}</strong>
            </div>
            <div>
              <span>Excused</span>
              <strong>{draft.attendanceExcused}</strong>
            </div>
            <div>
              <span>School Days</span>
              <strong>{draft.attendancePossible}</strong>
            </div>
            <div>
              <span>Attendance</span>
              <strong>{draft.attendancePercent}</strong>
            </div>
          </div>
        </article>
      </section>
    ),
    academic_table: (
      <section className="report-panel report-table-panel" key="academic_table">
        <div className="section-head report-table-head">
          <div>
            <p className="eyebrow">Subject Scores</p>
            <h3>Continuous assessment and examination</h3>
          </div>
        </div>

        <table className="data-table report-table">
          <thead>
            <tr>
              <th>Subject</th>
              {visibleAcademicColumns.map((column) => (
                <th key={column} className={column === "teacherRemark" ? "report-remark-col" : undefined}>
                  {columnLabels[column]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.subjectRows.map((row) => (
              <tr key={row.id}>
                <td>{row.subjectName}</td>
                {visibleAcademicColumns.map((column) => (
                  <td key={`${row.id}-${column}`} className={column === "teacherRemark" ? "report-remark-col" : undefined}>
                    {renderAcademicCell(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="report-table-foot muted">
          {academicConfig
            ? `Active assessment structure: ${buildAssessmentBreakdown(academicConfig)}. Subject Pos. is rank within the class for that subject.`
            : "CA = Test 1 + Assignment/Test 2 (40 marks), Exam (60 marks). Subject Pos. is rank within the class for that subject."}
        </p>
      </section>
    ),
    qualitative: (
      <section className="report-panel report-qualitative-panel" key="qualitative">
        <div className="section-head report-table-head">
          <div>
            <p className="eyebrow">Qualitative Section</p>
            <h3>Affective and psychomotor ratings</h3>
          </div>
        </div>
        <div className="report-qualitative-grid">
          {schema.qualitative.showAffective ? (
            <article className="report-subpanel">
              <strong>Affective Domain</strong>
              <div className="rating-grid">
                {draft.affectiveRatings.map((rating) => (
                  <div key={rating.label} className="rating-card">
                    <span>{rating.label}</span>
                    <strong>{rating.score}/5</strong>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
          {schema.qualitative.showPsychomotor ? (
            <article className="report-subpanel">
              <strong>Psychomotor</strong>
              <div className="rating-grid">
                {draft.psychomotorRatings.map((rating) => (
                  <div key={rating.label} className="rating-card">
                    <span>{rating.label}</span>
                    <strong>{rating.score}/5</strong>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </div>
        <p className="report-table-foot muted">Rating key: 5 = Excellent · 4 = Very Good · 3 = Good · 2 = Fair · 1 = Needs Improvement</p>
      </section>
    ),
    remarks: (
      <section className="report-bottom-grid" key="remarks">
        <article className="report-panel">
          <p className="eyebrow">Key Notes</p>
          <div className="report-note-list">
            {facts.map((item) => (
              <div key={item.label} className="report-note">
                <strong>{item.label}</strong>
                <p>{item.value}</p>
              </div>
            ))}
            {schema.controls.showGradingLegend ? (
              <div className="report-note report-grade-legend">
                <strong>Grading Key</strong>
                <table className="report-legend-table">
                  <thead>
                    <tr>
                      <th>Grade</th>
                      <th>Mark Range</th>
                      <th>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.gradeLegend.map((entry) => (
                      <tr key={entry.label}>
                        <td>{entry.label}</td>
                        <td>{entry.range}</td>
                        <td>{entry.remark}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {schema.controls.showTrendAnalysis ? (
              <div className="report-note">
                <strong>Previous {schema.terminology.termLabel} Comparison</strong>
                <div className="report-trend-list">
                  {draft.trend.map((point) => (
                    <div key={point.label} className="report-trend-row">
                      <span>{point.label}</span>
                      <div className="distribution-bar">
                        <span style={{ width: `${Math.min(point.average, 100)}%` }} />
                      </div>
                      <strong>{point.average}%</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </article>

        <article className="report-panel">
          <p className="eyebrow">Remarks</p>
          <div className="report-note-list">
            {remarks.map((item) => (
              <div key={item.label} className="report-note">
                <strong>{item.label}</strong>
                <p>{item.value}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    ),
    signatures: (
      <section className="report-panel report-signature-panel" key="signatures">
        <div className="section-head report-table-head">
          <div>
            <p className="eyebrow">Signature Block</p>
            <h3>Approved by school signatories</h3>
          </div>
        </div>
        <div className="report-signature-grid">
          {schema.signatures.showClassTeacherSignature ? (
            <div className="report-signature-card">
              <img
                src={schema.signatures.classTeacherSignatureUrl ?? draft.classTeacherSignatureUrl}
                alt="Class teacher signature"
                className="report-signature-image"
              />
              <span>Class Teacher Signature</span>
            </div>
          ) : null}
          {schema.signatures.showPrincipalSignature ? (
            <div className="report-signature-card">
              <img
                src={schema.signatures.principalSignatureUrl ?? draft.principalSignatureUrl}
                alt="Principal signature"
                className="report-signature-image"
              />
              <span>Principal Signature</span>
            </div>
          ) : null}
        </div>
      </section>
    ),
    verification: (
      <footer className="report-footer-bar" key="verification">
        <div className="report-footer-main">
          <div className="report-verification">
            <div className="verification-grid" aria-hidden="true">
              {verificationPattern.map((active, index) => (
                <span key={`${draft.regNumberKey}-${index}`} className={active ? "filled" : ""} />
              ))}
            </div>
            <div className="report-verification-copy">
              <strong>Verification ID: {draft.verificationId}</strong>
              <p>Released: {draft.publishedAt}</p>
              <p>School Code: {draft.schoolCode}</p>
              <p>Generated: {draft.generatedOn}</p>
            </div>
          </div>

          <div className="report-signoff">
            <div>
              <span>Next Term Begins</span>
              <strong>{draft.resumptionDate}</strong>
            </div>
            <div>
              <span>Principal</span>
              <strong>{draft.principalName}</strong>
            </div>
            <div>
              <span>Portal</span>
              <strong>{draft.portalSlug}</strong>
            </div>
          </div>
        </div>
        <p className="report-disclaimer">{draft.disclaimer}</p>
      </footer>
    ),
  };

  return (
    <div
      id="print-area"
      className={`report-sheet report-sheet-compact template-${draft.template} border-style-${schema.borderStyle}`}
      style={{ ["--report-primary" as string]: schema.primaryColor, fontFamily: schema.fontFamily }}
    >
      {schema.zones.map((zone) => zoneViews[zone])}
    </div>
  );
}
