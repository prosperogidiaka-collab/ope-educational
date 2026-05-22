"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ReportSheetView } from "@/components/report-sheet-view";
import { buildAcademicComponentLabels } from "@/lib/academic-config";
import {
  buildResultSheetDraft,
  mergeResultSheetDraft,
  type ResultSheetDraft,
} from "@/lib/report-sheet";
import { buildShortResultPath } from "@/lib/short-links";
import type { AcademicConfig, ResultTemplateSchema, SchoolProfile, StudentSummary } from "@/lib/types";

interface PrincipalResultEditorProps {
  school: SchoolProfile;
  students: StudentSummary[];
  templateSchema?: ResultTemplateSchema;
  academicConfig?: AcademicConfig;
}

type DraftField = Exclude<keyof ResultSheetDraft, "subjectRows">;

export function PrincipalResultEditor({
  school,
  students,
  templateSchema,
  academicConfig,
}: PrincipalResultEditorProps) {
  const componentLabels = academicConfig ? buildAcademicComponentLabels(academicConfig) : null;
  const [selectedRegNumber, setSelectedRegNumber] = useState(students[0]?.bundle.student.regNumber ?? "");
  const [draft, setDraft] = useState<ResultSheetDraft>(() =>
    students[0]
      ? buildResultSheetDraft(school, students[0], {
          classSize: students.length,
          academicConfig,
        })
      : ({} as ResultSheetDraft),
  );
  const [saveMessage, setSaveMessage] = useState("Select a result sheet to edit.");
  const [isSyncing, setIsSyncing] = useState(false);

  const selectedSummary = useMemo(
    () => students.find((student) => student.bundle.student.regNumber === selectedRegNumber) ?? students[0],
    [selectedRegNumber, students],
  );
  const baseDraft = useMemo(
    () =>
      selectedSummary
        ? buildResultSheetDraft(school, selectedSummary, {
            classSize: students.length,
            academicConfig,
          })
        : null,
    [academicConfig, school, selectedSummary, students.length],
  );

  useEffect(() => {
    if (!baseDraft) {
      return;
    }

    const currentBaseDraft = baseDraft;
    let cancelled = false;

    async function loadSharedDraft() {
      setIsSyncing(true);

      try {
        const response = await fetch(`/api/report-sheet/${encodeURIComponent(selectedRegNumber)}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          override?: Partial<ResultSheetDraft> | null;
        };

        if (cancelled) {
          return;
        }

        setDraft(mergeResultSheetDraft(currentBaseDraft, payload.override ?? null));
        setSaveMessage("School-admin report edits are ready. Save to update the shared report for every device using this server.");
      } catch {
        if (cancelled) {
          return;
        }

        setDraft(currentBaseDraft);
        setSaveMessage("Could not load shared school-admin edits. Showing the base report sheet.");
      } finally {
        if (!cancelled) {
          setIsSyncing(false);
        }
      }
    }

    void loadSharedDraft();

    return () => {
      cancelled = true;
    };
  }, [baseDraft, selectedRegNumber]);

  if (!selectedSummary || !baseDraft) {
    return null;
  }

  function updateDraftField(field: DraftField, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
    setSaveMessage("Unsaved edits in progress.");
  }

  function updateSubjectRow(
    rowId: string,
    field: keyof ResultSheetDraft["subjectRows"][number],
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      subjectRows: current.subjectRows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    }));
    setSaveMessage("Unsaved edits in progress.");
  }

  async function saveDraft() {
    setIsSyncing(true);

    try {
      await fetch(`/api/report-sheet/${encodeURIComponent(selectedRegNumber)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });
      setSaveMessage("School-admin report edits saved. The result portal now serves this updated sheet to all devices on this server.");
    } catch {
      setSaveMessage("Save failed. The shared result sheet could not be updated.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function restoreOriginal() {
    if (!baseDraft) {
      return;
    }

    setIsSyncing(true);

    try {
      await fetch(`/api/report-sheet/${encodeURIComponent(selectedRegNumber)}`, {
        method: "DELETE",
      });
      setDraft(baseDraft);
      setSaveMessage("Original report restored for this student across the shared server.");
    } catch {
      setSaveMessage("Restore failed. The shared result sheet could not be reset.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <section className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Report Editor</p>
          <h3>Edit every printed report field before release</h3>
        </div>
        <div className="button-row">
          <Link
            href={buildShortResultPath(selectedSummary.bundle.coupon.code)}
            className="secondary-button"
          >
            Open student result
          </Link>
          <button type="button" className="secondary-button" onClick={() => void restoreOriginal()} disabled={isSyncing}>
            Restore original
          </button>
          <button type="button" className="primary-button" onClick={() => void saveDraft()} disabled={isSyncing}>
            Save school-admin edits
          </button>
        </div>
      </div>

      <div className="callout-banner">
        <strong>{saveMessage}</strong>
        <p className="muted">
          Keep names, remarks, and subject labels concise so the final sheet remains a clean single A4 page.
          {isSyncing ? " Sync in progress..." : ""}
        </p>
      </div>

      <div className="principal-editor-grid">
        <div className="stack-list">
          <article className="editor-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Sheet Target</p>
                <h3>Choose student result</h3>
              </div>
            </div>
            <label>
              Student result
              <select value={selectedRegNumber} onChange={(event) => setSelectedRegNumber(event.target.value)}>
                {students.map((student) => (
                  <option key={student.bundle.student.regNumber} value={student.bundle.student.regNumber}>
                    {student.bundle.student.fullName} - {student.bundle.student.regNumber}
                  </option>
                ))}
              </select>
            </label>
          </article>

          <article className="editor-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Header</p>
                <h3>School and release details</h3>
              </div>
            </div>
            <div className="form-grid compact-grid">
              <label>
                School name
                <input value={draft.schoolName} onChange={(event) => updateDraftField("schoolName", event.target.value)} />
              </label>
              <label>
                School address
                <input value={draft.schoolAddress} onChange={(event) => updateDraftField("schoolAddress", event.target.value)} />
              </label>
              <label>
                Session
                <input value={draft.schoolSession} onChange={(event) => updateDraftField("schoolSession", event.target.value)} />
              </label>
              <label>
                Term
                <input value={draft.schoolTerm} onChange={(event) => updateDraftField("schoolTerm", event.target.value)} />
              </label>
              <label>
                Exam type
                <input value={draft.schoolExamType} onChange={(event) => updateDraftField("schoolExamType", event.target.value)} />
              </label>
              <label>
                School code
                <input value={draft.schoolCode} onChange={(event) => updateDraftField("schoolCode", event.target.value)} />
              </label>
              <label>
                Principal name
                <input value={draft.principalName} onChange={(event) => updateDraftField("principalName", event.target.value)} />
              </label>
              <label>
                Portal slug
                <input value={draft.portalSlug} onChange={(event) => updateDraftField("portalSlug", event.target.value)} />
              </label>
              <label>
                Logo URL
                <input value={draft.logoUrl} onChange={(event) => updateDraftField("logoUrl", event.target.value)} />
              </label>
              <label>
                Government stamp URL
                <input value={draft.governmentStampUrl} onChange={(event) => updateDraftField("governmentStampUrl", event.target.value)} />
              </label>
              <label>
                Watermark logo URL
                <input value={draft.watermarkLogoUrl} onChange={(event) => updateDraftField("watermarkLogoUrl", event.target.value)} />
              </label>
              <label>
                Principal signature URL
                <input
                  value={draft.principalSignatureUrl}
                  onChange={(event) => updateDraftField("principalSignatureUrl", event.target.value)}
                />
              </label>
              <label>
                Class teacher signature URL
                <input
                  value={draft.classTeacherSignatureUrl}
                  onChange={(event) => updateDraftField("classTeacherSignatureUrl", event.target.value)}
                />
              </label>
            </div>
          </article>

          <article className="editor-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Student</p>
                <h3>Editable report identity and summary</h3>
              </div>
            </div>
            <div className="form-grid compact-grid">
              <label>
                Student name
                <input value={draft.studentName} onChange={(event) => updateDraftField("studentName", event.target.value)} />
              </label>
              <label>
                Reg number
                <input value={draft.regNumber} onChange={(event) => updateDraftField("regNumber", event.target.value)} />
              </label>
              <label>
                Gender
                <input value={draft.gender} onChange={(event) => updateDraftField("gender", event.target.value)} />
              </label>
              <label>
                Date of birth
                <input value={draft.dateOfBirth} onChange={(event) => updateDraftField("dateOfBirth", event.target.value)} />
              </label>
              <label>
                Age
                <input value={draft.age} onChange={(event) => updateDraftField("age", event.target.value)} />
              </label>
              <label>
                Class
                <input value={draft.className} onChange={(event) => updateDraftField("className", event.target.value)} />
              </label>
              <label>
                House
                <input value={draft.house} onChange={(event) => updateDraftField("house", event.target.value)} />
              </label>
              <label>
                Guardian
                <input value={draft.guardianName} onChange={(event) => updateDraftField("guardianName", event.target.value)} />
              </label>
              <label>
                Photo initials
                <input value={draft.photoInitials} onChange={(event) => updateDraftField("photoInitials", event.target.value.slice(0, 3))} />
              </label>
              <label>
                Passport image URL
                <input value={draft.passportUrl ?? ""} onChange={(event) => updateDraftField("passportUrl", event.target.value)} />
              </label>
              <label>
                Position
                <input value={draft.position} onChange={(event) => updateDraftField("position", event.target.value)} />
              </label>
              <label>
                Total
                <input value={draft.total} onChange={(event) => updateDraftField("total", event.target.value)} />
              </label>
              <label>
                Average
                <input value={draft.average} onChange={(event) => updateDraftField("average", event.target.value)} />
              </label>
              <label>
                Weighted average
                <input value={draft.weightedAverage} onChange={(event) => updateDraftField("weightedAverage", event.target.value)} />
              </label>
              <label>
                Grade
                <input value={draft.overallGrade} onChange={(event) => updateDraftField("overallGrade", event.target.value)} />
              </label>
              <label>
                Verification ID
                <input value={draft.verificationId} onChange={(event) => updateDraftField("verificationId", event.target.value)} />
              </label>
              <label>
                Published date
                <input value={draft.publishedAt} onChange={(event) => updateDraftField("publishedAt", event.target.value)} />
              </label>
            </div>
          </article>

          <article className="editor-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Attendance and Notes</p>
                <h3>Bottom summary fields</h3>
              </div>
            </div>
            <div className="form-grid compact-grid">
              <label>
                Present
                <input value={draft.attendancePresent} onChange={(event) => updateDraftField("attendancePresent", event.target.value)} />
              </label>
              <label>
                Absent
                <input value={draft.attendanceAbsent} onChange={(event) => updateDraftField("attendanceAbsent", event.target.value)} />
              </label>
              <label>
                Late
                <input value={draft.attendanceLate} onChange={(event) => updateDraftField("attendanceLate", event.target.value)} />
              </label>
              <label>
                School days
                <input value={draft.attendancePossible} onChange={(event) => updateDraftField("attendancePossible", event.target.value)} />
              </label>
              <label>
                Best subject
                <input value={draft.bestSubject} onChange={(event) => updateDraftField("bestSubject", event.target.value)} />
              </label>
              <label>
                Weakest subject
                <input value={draft.weakestSubject} onChange={(event) => updateDraftField("weakestSubject", event.target.value)} />
              </label>
              <label>
                Fee status
                <input value={draft.feeStatus} onChange={(event) => updateDraftField("feeStatus", event.target.value)} />
              </label>
              <label>
                Resumption date
                <input value={draft.resumptionDate} onChange={(event) => updateDraftField("resumptionDate", event.target.value)} />
              </label>
            </div>
          </article>

          <article className="editor-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Remarks</p>
                <h3>Printed comments</h3>
              </div>
            </div>
            <div className="stack-list">
              <label>
                Subject teacher remark
                <textarea
                  maxLength={120}
                  value={draft.subjectTeacherRemark}
                  onChange={(event) => updateDraftField("subjectTeacherRemark", event.target.value)}
                />
              </label>
              <label>
                Class teacher remark
                <textarea
                  maxLength={120}
                  value={draft.classTeacherRemark}
                  onChange={(event) => updateDraftField("classTeacherRemark", event.target.value)}
                />
              </label>
              <label>
                Principal remark
                <textarea
                  maxLength={120}
                  value={draft.principalRemark}
                  onChange={(event) => updateDraftField("principalRemark", event.target.value)}
                />
              </label>
            </div>
          </article>

          <article className="editor-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Subject Table</p>
                <h3>Edit printed rows</h3>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table report-edit-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>{componentLabels?.test1 ?? "Test 1"}</th>
                    <th>{componentLabels?.test2 ?? "Test 2"}</th>
                    <th>CA</th>
                    <th>{componentLabels?.exam ?? "Exam"}</th>
                    <th>Total</th>
                    <th>Grade</th>
                    <th>Class Avg.</th>
                    <th>Cl. High</th>
                    <th>Cl. Low</th>
                    <th>Sub. Pos.</th>
                    <th className="report-remark-col">Subject Teacher&apos;s Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.subjectRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          value={row.subjectName}
                          onChange={(event) => updateSubjectRow(row.id, "subjectName", event.target.value)}
                        />
                      </td>
                      <td>
                        <input value={row.test1} onChange={(event) => updateSubjectRow(row.id, "test1", event.target.value)} />
                      </td>
                      <td>
                        <input value={row.test2} onChange={(event) => updateSubjectRow(row.id, "test2", event.target.value)} />
                      </td>
                      <td>
                        <input
                          value={row.continuousAssessment}
                          onChange={(event) => updateSubjectRow(row.id, "continuousAssessment", event.target.value)}
                        />
                      </td>
                      <td>
                        <input value={row.exam} onChange={(event) => updateSubjectRow(row.id, "exam", event.target.value)} />
                      </td>
                      <td>
                        <input value={row.total} onChange={(event) => updateSubjectRow(row.id, "total", event.target.value)} />
                      </td>
                      <td>
                        <input value={row.grade} onChange={(event) => updateSubjectRow(row.id, "grade", event.target.value)} />
                      </td>
                      <td>
                        <input
                          value={row.classAverage}
                          onChange={(event) => updateSubjectRow(row.id, "classAverage", event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          value={row.classHighest}
                          onChange={(event) => updateSubjectRow(row.id, "classHighest", event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          value={row.classLowest}
                          onChange={(event) => updateSubjectRow(row.id, "classLowest", event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          value={row.subjectPosition}
                          onChange={(event) => updateSubjectRow(row.id, "subjectPosition", event.target.value)}
                        />
                      </td>
                      <td className="report-remark-col">
                        <textarea
                          rows={2}
                          maxLength={140}
                          value={row.teacherRemark}
                          onChange={(event) => updateSubjectRow(row.id, "teacherRemark", event.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <div className="editor-preview-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Live Preview</p>
              <h3>Report print sheet</h3>
            </div>
          </div>
          <ReportSheetView
            draft={draft}
            templateSchema={templateSchema}
            showActions={false}
            academicConfig={academicConfig}
          />
        </div>
      </div>
    </section>
  );
}
