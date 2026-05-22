"use client";

import { useMemo, useState } from "react";

import { formatDate, resultStatusLabel, stageLabel } from "@/lib/calculations";
import type { ReviewCase, StudentSummary } from "@/lib/types";

interface AuditBoardProps {
  students: StudentSummary[];
  cases: ReviewCase[];
}

export function AuditBoard({ students, cases }: AuditBoardProps) {
  const [records, setRecords] = useState(cases);
  const [selectedId, setSelectedId] = useState(cases[0]?.id ?? "");
  const [statusFilter, setStatusFilter] = useState<ReviewCase["status"] | "all">("all");

  const filteredCases = useMemo(
    () => records.filter((item) => statusFilter === "all" || item.status === statusFilter),
    [records, statusFilter],
  );
  const selectedCase = filteredCases.find((item) => item.id === selectedId) ?? filteredCases[0];

  const reviewStudents = students.filter((student) =>
    ["corrections_requested", "under_review"].includes(student.bundle.status),
  );

  function updateCase(id: string, status: ReviewCase["status"], note: string) {
    setRecords((current) =>
      current.map((item) => (item.id === id ? { ...item, status, note } : item)),
    );
  }

  return (
    <div className="grid-layout two-wide">
      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">HOD Review Queue</p>
            <h3>Flagged anomalies and incomplete sheets</h3>
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ReviewCase["status"] | "all")}
          >
            <option value="all">All statuses</option>
            <option value="under_review">Under review</option>
            <option value="corrections_requested">Corrections requested</option>
            <option value="hod_approved">HOD approved</option>
          </select>
        </div>

        <div className="stack-list">
          {filteredCases.map((record) => (
            <button
              key={record.id}
              type="button"
              className={record.id === selectedCase?.id ? "selection-card active" : "selection-card"}
              onClick={() => setSelectedId(record.id)}
            >
              <div className="audit-header">
                <div>
                  <strong>{record.studentName}</strong>
                  <p>{record.subject}</p>
                </div>
                <span className={`status-pill status-${record.status}`}>{resultStatusLabel(record.status)}</span>
              </div>
              <p>{record.anomaly}</p>
              <span className="muted">{record.teacher}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="surface-card">
        {selectedCase ? (
          <>
            <div className="section-head">
              <div>
                <p className="eyebrow">Review Workspace</p>
                <h3>
                  {selectedCase.studentName} - {selectedCase.subject}
                </h3>
              </div>
              <span className={`status-pill status-${selectedCase.status}`}>{resultStatusLabel(selectedCase.status)}</span>
            </div>

            <div className="comparison-grid">
              <article className="comparison-card">
                <span>Submitted value</span>
                <strong>{selectedCase.submittedValue}</strong>
              </article>
              <article className="comparison-card">
                <span>Corrected value</span>
                <strong>{selectedCase.correctedValue}</strong>
              </article>
            </div>

            <div className="callout-banner warning">
              <strong>Anomaly detected</strong>
              <p className="muted">{selectedCase.anomaly}</p>
            </div>

            <p>{selectedCase.note}</p>

            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  updateCase(
                    selectedCase.id,
                    "corrections_requested",
                    "Returned to teacher with reason and script reference attached.",
                  )
                }
              >
                Return to teacher
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  updateCase(
                    selectedCase.id,
                    "hod_approved",
                    "Correction accepted and forwarded to class teacher review.",
                  )
                }
              >
                Approve correction
              </button>
            </div>
          </>
        ) : null}
      </section>

      <section className="surface-card span-two">
        <div className="section-head">
          <div>
            <p className="eyebrow">Result Sheet Trail</p>
            <h3>Class teacher, bursary, and principal dependencies</h3>
          </div>
        </div>

        <div className="card-grid">
          {reviewStudents.map((student) => (
            <article key={student.bundle.student.regNumber} className="leader-card feature">
              <div className="audit-header">
                <div>
                  <strong>{student.bundle.student.fullName}</strong>
                  <p className="muted">{student.bundle.student.regNumber}</p>
                </div>
                <span className={`status-pill status-${student.bundle.status}`}>
                  {resultStatusLabel(student.bundle.status)}
                </span>
              </div>
              <p className="muted">{student.anomalies.join(" - ") || "No anomalies"}</p>
              <div className="stack-list compact">
                {student.bundle.approvals.map((approval) => (
                  <div key={approval.id} className="approval-card">
                    <div>
                      <strong>{stageLabel(approval.stage)}</strong>
                      <p>{approval.actor}</p>
                    </div>
                    <div>
                      <span className={`status-pill status-${approval.status}`}>{resultStatusLabel(approval.status)}</span>
                      <p>{formatDate(approval.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
