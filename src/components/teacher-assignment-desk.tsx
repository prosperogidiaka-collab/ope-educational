import Link from "next/link";

import { TeacherScoreEntry } from "@/components/teacher-score-entry";
import { isSchoolAdminRole } from "@/lib/auth";
import { commentTemplates, gradeScale } from "@/lib/demo-data";
import type { AcademicConfig, ResultLockRecord, StaffAccount, StudentSummary, Subject, SubjectTeacherAssignment } from "@/lib/types";

interface TeacherAssignmentDeskProps {
  account: StaffAccount;
  academicConfig: AcademicConfig;
  assignments: SubjectTeacherAssignment[];
  resultLocks: ResultLockRecord[];
  selectedAssignment: SubjectTeacherAssignment | null;
  selectedSubject: Subject | null;
  selectedStudents: StudentSummary[];
  selectedLock: ResultLockRecord | null;
  correctionWindowOpen: boolean;
  schoolTerm: string;
}

export function TeacherAssignmentDesk({
  account,
  academicConfig,
  assignments,
  resultLocks,
  selectedAssignment,
  selectedSubject,
  selectedStudents,
  selectedLock,
  correctionWindowOpen,
  schoolTerm,
}: TeacherAssignmentDeskProps) {
  const lockByClassName = new Map(resultLocks.map((lock) => [lock.className, lock]));

  return (
    <>
      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Subject Assignments</p>
            <h3>Your score-entry scope</h3>
          </div>
          <span className={`status-pill ${assignments.length > 0 ? "status-approved" : "status-under_review"}`}>
            {assignments.length} assignment{assignments.length === 1 ? "" : "s"}
          </span>
        </div>

        {assignments.length > 0 ? (
          <div className="card-grid">
            {assignments.map((assignment) => {
              const isActive = assignment.id === selectedAssignment?.id;
              const assignmentLock = lockByClassName.get(assignment.className) ?? null;
              const lockLabel = assignmentLock?.locked ? "Locked" : "Open";

              return (
                <Link
                  key={assignment.id}
                  href={`/dashboard/teacher/assignments?assignment=${encodeURIComponent(assignment.id)}`}
                  className={isActive ? "selection-card selected" : "selection-card"}
                >
                  <strong>{assignment.subjectName}</strong>
                  <p>{assignment.className}</p>
                  <p className="muted">{assignment.subjectCode} - {assignment.arm}</p>
                  <div className="button-row">
                    <span className={`status-pill ${lockLabel === "Locked" ? "status-locked" : "status-approved"}`}>
                      {lockLabel}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="callout-banner warning">
            <strong>No subject-class arm is assigned to this account yet.</strong>
            <p className="muted">
              Ask the school admin to assign this account to a subject and class arm before using the score sheet.
              {isSchoolAdminRole(account.role) ? " You can manage assignments from Teacher Assignments." : ""}
            </p>
            {isSchoolAdminRole(account.role) ? (
              <div className="button-row">
                <Link href="/dashboard/teacher-assignments" className="secondary-button">
                  Open teacher assignments
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {selectedAssignment && selectedSubject ? (
        <>
          <TeacherScoreEntry
            subject={{
              ...selectedSubject,
              teacherName: selectedAssignment.teacherName ?? account.fullName ?? selectedSubject.teacherName,
              className: selectedAssignment.className,
              section: selectedAssignment.section,
              track: selectedAssignment.track,
            }}
            gradeScale={gradeScale}
            students={selectedStudents}
            config={academicConfig}
            commentTemplates={commentTemplates}
            isLocked={Boolean(selectedLock?.locked)}
            lockNote={selectedLock?.note}
            lockActor={selectedLock?.lockedBy}
            lockTimestamp={selectedLock?.lockedAt}
            canEditWhenLocked={Boolean(selectedLock?.locked && correctionWindowOpen)}
          />

          <section className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Assignment Scope</p>
                <h3>{schoolTerm} controls</h3>
              </div>
            </div>
            <div className="stack-list">
              <div className="flow-step">
                <strong>Class arm</strong>
                <p>{selectedAssignment.className}</p>
              </div>
              <div className="flow-step">
                <strong>Subject</strong>
                <p>{selectedAssignment.subjectName}</p>
              </div>
              <div className="flow-step">
                <strong>Scope rule</strong>
                <p>
                  This account can enter or edit only {selectedAssignment.subjectName} for {selectedAssignment.className}.
                </p>
              </div>
              <div className="flow-step">
                <strong>Result lock</strong>
                <p>
                  {selectedLock?.locked
                    ? correctionWindowOpen
                      ? `${selectedAssignment.className} is locked generally, but this returned sheet has a controlled correction window. You can edit, save, and resubmit this subject.`
                      : `${selectedAssignment.className} is locked for this term. Only the school admin can reopen it.`
                    : `This class is open for score entry. Once locked by the school admin, teachers can no longer edit this term's scores.`}
                </p>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {assignments.length > 0 && !selectedAssignment ? (
        <section className="surface-card">
          <div className="flow-step">
            <strong>No active assignment is selected.</strong>
            <p>Choose one subject card above to open its score-entry page on this separated assignments menu.</p>
          </div>
        </section>
      ) : null}
    </>
  );
}
