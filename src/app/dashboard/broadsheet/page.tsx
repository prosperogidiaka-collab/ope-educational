import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { PrintButton } from "@/components/print-button";
import { buildAssessmentBreakdown } from "@/lib/academic-config";
import { formatDate, ordinal, resultStatusLabel } from "@/lib/calculations";
import { subjects } from "@/lib/demo-data";
import { readClassOfferings } from "@/lib/class-offerings-store";
import { getLiveResults } from "@/lib/live-results";
import type { ResultStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function statusShortLabel(status: ResultStatus) {
  switch (status) {
    case "locked":
      return "Locked";
    case "submitted":
      return "Submitted";
    case "corrections_requested":
      return "Corrections";
    case "under_review":
      return "Review";
    case "principal_approved":
      return "Approved";
    case "published":
      return "Published";
    default:
      return resultStatusLabel(status);
  }
}

export default async function BroadsheetPage() {
  const [{ academicConfig, school, summaries }, classOfferings] = await Promise.all([
    getLiveResults(),
    readClassOfferings(),
  ]);
  const classSubjects = subjects.filter((subject) =>
    summaries.some((summary) => summary.bundle.student.registeredSubjectIds.includes(subject.id)),
  );
  const ordered = [...summaries].sort((left, right) => {
    if (left.position > 0 && right.position > 0) return left.position - right.position;
    if (left.position > 0) return -1;
    if (right.position > 0) return 1;
    return right.weightedAverage - left.weightedAverage;
  });
  const className = ordered[0]?.bundle.student.className ?? classSubjects[0]?.className ?? "Class";
  const classOffering = classOfferings.find((offering) => offering.className === className) ?? null;
  const subjectColumnWidth = `${Math.max(4.2, Number((45 / Math.max(classSubjects.length, 1)).toFixed(2)))}%`;
  const rankedCount = ordered.filter((summary) => summary.position > 0).length;
  const completeCount = ordered.filter((summary) => summary.incompleteSubjects === 0).length;
  const lockedCount = ordered.filter((summary) => summary.bundle.status === "locked").length;
  const completeSheets = ordered.filter((summary) => summary.incompleteSubjects === 0);
  const classAverage = completeSheets.length
    ? Number(
        (
          completeSheets.reduce((sum, summary) => sum + summary.weightedAverage, 0) /
          completeSheets.length
        ).toFixed(2),
      )
    : 0;

  const subjectAverages = classSubjects.map((subject) => {
    const totals = summaries.flatMap((summary) => {
      const entry = summary.computedSubjects.find((item) => item.subjectId === subject.id);
      return entry && !entry.isIncomplete ? [entry.total] : [];
    });
    return totals.length ? Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length) : 0;
  });

  return (
    <AppShell
      activeHref="/dashboard/broadsheet"
      eyebrow="Broadsheet"
      title={`${className} class broadsheet`}
      description="Print a clean landscape broadsheet with official class totals, averages, subject scores, ranking position, and publication status."
    >
      <div className="button-row no-print" style={{ marginBottom: "1rem" }}>
        <Link href="/dashboard/score-review" className="secondary-button">
          Back to Score Review
        </Link>
        <PrintButton />
      </div>

      <div id="print-area" className="broadsheet-page">
        <header className="broadsheet-head">
          <div className="report-logo-frame">
            <img src={school.logoUrl} alt={`${school.name} logo`} className="report-logo-image" />
          </div>
          <div className="broadsheet-head-copy">
            <p className="eyebrow">Class Result Broadsheet</p>
            <h1>{school.name}</h1>
            <p>{school.address}</p>
            <p>
              {school.session} Academic Session - {school.term} - {school.examType} - {className}
            </p>
          </div>
        </header>

        <section className="broadsheet-meta-strip">
          <div>
            <span>Section</span>
            <strong>{classOffering?.section ?? academicConfig.section}</strong>
          </div>
          <div>
            <span>Track</span>
            <strong>{classOffering?.track ?? "General"}</strong>
          </div>
          <div>
            <span>Class Teacher</span>
            <strong>{classOffering?.classTeacher ?? "Assigned class teacher"}</strong>
          </div>
          <div>
            <span>HOD</span>
            <strong>{classOffering?.hod ?? "Assigned HOD"}</strong>
          </div>
        </section>

        <section className="broadsheet-overview">
          <article className="broadsheet-stat">
            <span>Students</span>
            <strong>{ordered.length}</strong>
          </article>
          <article className="broadsheet-stat">
            <span>Subjects</span>
            <strong>{classSubjects.length}</strong>
          </article>
          <article className="broadsheet-stat">
            <span>Ranked</span>
            <strong>{rankedCount}</strong>
          </article>
          <article className="broadsheet-stat">
            <span>Complete Sheets</span>
            <strong>{completeCount}</strong>
          </article>
          <article className="broadsheet-stat">
            <span>Class Average</span>
            <strong>{classAverage}%</strong>
          </article>
          <article className="broadsheet-stat">
            <span>Locked</span>
            <strong>{lockedCount}</strong>
          </article>
        </section>

        <table className="data-table broadsheet-table">
          <colgroup>
            <col style={{ width: "3%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "10%" }} />
            {classSubjects.map((subject) => (
              <col key={subject.id} style={{ width: subjectColumnWidth }} />
            ))}
            <col style={{ width: "4%" }} />
            <col style={{ width: "4%" }} />
            <col style={{ width: "4%" }} />
            <col style={{ width: "4%" }} />
            <col style={{ width: "3.5%" }} />
            <col style={{ width: "3.5%" }} />
            <col style={{ width: "5%" }} />
          </colgroup>
          <thead>
            <tr>
              <th colSpan={3} className="broadsheet-group-heading">
                Student Register
              </th>
              <th colSpan={classSubjects.length} className="broadsheet-group-heading">
                Subject Scores
              </th>
              <th colSpan={7} className="broadsheet-group-heading">
                Result Summary
              </th>
            </tr>
            <tr>
              <th>#</th>
              <th>Student</th>
              <th>Reg No.</th>
              {classSubjects.map((subject) => (
                <th key={subject.id} title={subject.name} className="broadsheet-subject-col">
                  {subject.code}
                </th>
              ))}
              <th title="Total">Tot.</th>
              <th title="Average">Avg.</th>
              <th title="Weighted Average">Wtd.</th>
              <th>GPA</th>
              <th>Grd.</th>
              <th>Pos.</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((summary, index) => {
              const byId = new Map(summary.computedSubjects.map((entry) => [entry.subjectId, entry]));
              return (
                <tr key={summary.bundle.student.regNumber}>
                  <td>{index + 1}</td>
                  <td className="broadsheet-name">{summary.bundle.student.fullName}</td>
                  <td>{summary.bundle.student.regNumber}</td>
                  {classSubjects.map((subject) => {
                    const entry = byId.get(subject.id);
                    if (!entry) {
                      return (
                        <td key={subject.id} className="broadsheet-na">
                          -
                        </td>
                      );
                    }
                    return (
                      <td key={subject.id} className={entry.isIncomplete ? "broadsheet-missing" : ""}>
                        {entry.isIncomplete ? "X" : entry.total}
                      </td>
                    );
                  })}
                  <td>{summary.total}</td>
                  <td>{summary.average}</td>
                  <td>{summary.weightedAverage}</td>
                  <td>{summary.gradePoints.toFixed(2)}</td>
                  <td>{summary.incompleteSubjects > 0 ? "-" : summary.overallGrade.label}</td>
                  <td>{summary.position > 0 ? ordinal(summary.position) : "-"}</td>
                  <td>
                    <span className={`status-pill status-${summary.bundle.status} broadsheet-status-screen`}>
                      {resultStatusLabel(summary.bundle.status)}
                    </span>
                    <span className="broadsheet-status-print">{statusShortLabel(summary.bundle.status)}</span>
                  </td>
                </tr>
              );
            })}
            <tr className="broadsheet-summary-row">
              <td colSpan={3}>Subject average</td>
              {subjectAverages.map((average, index) => (
                <td key={classSubjects[index].id}>{average || "-"}</td>
              ))}
              <td colSpan={7} />
            </tr>
          </tbody>
        </table>

        <p className="broadsheet-foot">
          X = incomplete entry - active assessment structure: {buildAssessmentBreakdown(academicConfig)} -
          Generated {formatDate(new Date().toISOString())}
        </p>
      </div>
    </AppShell>
  );
}
