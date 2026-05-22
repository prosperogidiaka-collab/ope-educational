import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { TeacherScoreEntry } from "@/components/teacher-score-entry";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import {
  commentTemplates,
  gradeScale,
  subjects,
} from "@/lib/demo-data";
import { getLiveResults } from "@/lib/live-results";
import { readResultLocks } from "@/lib/result-locks-store";
import { readVisibleSubjectTeacherAssignments } from "@/lib/subject-teacher-assignments-store";
import type { Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ScoreOverridesPageProps {
  searchParams?: Promise<{
    assignment?: string | string[];
  }>;
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function ScoreOverridesPage({ searchParams }: ScoreOverridesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const assignmentQuery = firstParam(resolvedSearchParams?.assignment);
  const account = await getCurrentStaffAccount();

  const [liveResults, assignments, resultLocks] = await Promise.all([
    getLiveResults(),
    readVisibleSubjectTeacherAssignments(account),
    readResultLocks(),
  ]);
  const { academicConfig } = liveResults;
  const lockByClassName = new Map(resultLocks.map((lock) => [lock.className, lock]));
  const selectedAssignment = assignments.find((assignment) => assignment.id === assignmentQuery) ?? assignments[0] ?? null;
  const selectedSubject: Subject | null = selectedAssignment
    ? {
        ...(subjects.find((subject) => subject.id === selectedAssignment.subjectId) ?? {
          id: selectedAssignment.subjectId,
          code: selectedAssignment.subjectCode,
          name: selectedAssignment.subjectName,
          weight: 1,
          className: selectedAssignment.className,
          teacherName: selectedAssignment.teacherName ?? "Assigned Teacher",
        }),
        className: selectedAssignment.className,
        teacherName: selectedAssignment.teacherName ?? "Assigned Teacher",
        section: selectedAssignment.section,
        track: selectedAssignment.track,
        isElective: selectedAssignment.subjectType === "elective",
      }
    : null;
  const selectedLock = selectedAssignment ? lockByClassName.get(selectedAssignment.className) ?? null : null;
  const students =
    selectedAssignment && selectedSubject
      ? liveResults.summaries.filter(
          (summary) =>
            summary.bundle.student.className === selectedAssignment.className &&
            summary.bundle.student.registeredSubjectIds.includes(selectedAssignment.subjectId),
        )
      : [];
  const submittedCount = Object.values(liveResults.subjectSheets).filter(
    (sheet) => sheet.sheetStatus === "submitted" || sheet.sheetStatus === "principal_approved",
  ).length;
  const correctionsCount = Object.values(liveResults.subjectSheets).filter(
    (sheet) => sheet.sheetStatus === "corrections_requested",
  ).length;

  return (
    <AppShell
      activeHref="/dashboard/score-overrides"
      eyebrow="Score Overrides"
      title={`${account?.fullName ?? "Principal"} raw score override desk`}
      description="Open any subject-class arm, inspect the saved teacher sheet, and make controlled school-admin corrections that reflect everywhere immediately."
    >
      <section className="metric-grid compact">
        <MetricCard label="Assignments" value={`${assignments.length}`} helper="Subject-class arms available for override review" />
        <MetricCard label="Locked classes" value={`${resultLocks.filter((lock) => lock.locked).length}`} helper="Teacher editing is frozen on these classes" />
        <MetricCard label="Submitted sheets" value={`${submittedCount}`} helper="Already in the review or approval flow" />
        <MetricCard label="Correction flags" value={`${correctionsCount}`} helper="Sheets with reviewer changes still pending" />
      </section>

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Override Targets</p>
            <h3>Select the exact subject-class arm to review</h3>
          </div>
          <span className="status-pill status-approved">School admin only</span>
        </div>

        <div className="card-grid">
          {assignments.map((assignment) => {
            const isActive = assignment.id === selectedAssignment?.id;
            const lock = lockByClassName.get(assignment.className);
            const sheet = liveResults.subjectSheets[assignment.id];

            return (
              <Link
                key={assignment.id}
                href={`/dashboard/score-overrides?assignment=${encodeURIComponent(assignment.id)}`}
                className={isActive ? "selection-card active" : "selection-card"}
              >
                <strong>{assignment.subjectName}</strong>
                <p>{assignment.className}</p>
                <p className="muted">
                  {assignment.teacherName ?? "Unassigned"} - {sheet?.sheetStatus?.replace(/_/g, " ") ?? "No sheet"}
                </p>
                <span className={`status-pill ${lock?.locked ? "status-locked" : "status-approved"}`}>
                  {lock?.locked ? "Teacher lock active" : "Open for teacher edits"}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {selectedAssignment && selectedSubject ? (
        <>
          <TeacherScoreEntry
            subject={{
              ...selectedSubject,
              teacherName: selectedAssignment.teacherName ?? selectedSubject.teacherName,
              className: selectedAssignment.className,
              section: selectedAssignment.section,
              track: selectedAssignment.track,
            }}
            gradeScale={gradeScale}
            students={students}
            config={academicConfig}
            commentTemplates={commentTemplates}
            isLocked={Boolean(selectedLock?.locked)}
            lockNote={selectedLock?.note}
            lockActor={selectedLock?.lockedBy}
            lockTimestamp={selectedLock?.lockedAt}
            mode="reviewer"
            actorName={account?.fullName}
            actorRole="School Admin"
            canEditWhenLocked
          />

          <section className="grid-layout two-wide">
            <article className="surface-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Override Rules</p>
                  <h3>How school-admin edits behave</h3>
                </div>
              </div>
              <div className="stack-list">
                <div className="flow-step">
                  <strong>Identity is preserved</strong>
                  <p>The assigned teacher stays attached to the sheet, while your override edit is saved under your own account identity.</p>
                </div>
                <div className="flow-step">
                  <strong>Locks still matter</strong>
                  <p>Teacher locks remain visible here, but this desk can make controlled corrections when a class has already been frozen.</p>
                </div>
                <div className="flow-step">
                  <strong>Live reflection</strong>
                  <p>Once you save or approve, the broadsheet, report editor, and student result pages all read the same corrected values.</p>
                </div>
              </div>
            </article>

            <article className="surface-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Next Step</p>
                  <h3>Where to verify the corrected output</h3>
                </div>
              </div>
              <div className="stack-list">
                <Link href="/dashboard/score-review" className="selection-card">
                  <strong>Score review</strong>
                  <p>Recheck flags, decisions, and approval notes after the override is saved.</p>
                </Link>
                <Link href="/dashboard/broadsheet" className="selection-card">
                  <strong>Broadsheet</strong>
                  <p>Print the class summary in landscape once the corrected subject totals are settled.</p>
                </Link>
                <Link href="/dashboard/report-editor" className="selection-card">
                  <strong>Report editor</strong>
                  <p>Open any student report after score correction to confirm the printed sheet now looks right.</p>
                </Link>
              </div>
            </article>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
