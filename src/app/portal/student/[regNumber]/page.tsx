import Link from "next/link";
import { redirect } from "next/navigation";

import { studentPortalLogoutAction } from "@/app/portal/actions";
import { StudentPortalAbsencePanel } from "@/components/student-portal-absence-panel";
import { TimetableExportActions } from "@/components/timetable-export-actions";
import { readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { formatDate, formatDateOnly, resultStatusLabel } from "@/lib/calculations";
import { readClassOfferings } from "@/lib/class-offerings-store";
import { getLiveResults } from "@/lib/live-results";
import { readSchoolTimetable } from "@/lib/school-timetable-store";
import { listStudentAbsenceRequestsForRegNumber } from "@/lib/student-absence-requests-store";
import {
  buildAttendanceSummaryMap,
  readStudentAttendanceRegisters,
} from "@/lib/student-attendance-store";
import { getCurrentStudentPortalSession } from "@/lib/student-portal-auth-server";
import { getStudentProfile } from "@/lib/student-profiles-store";
import { listStudentReportsForRegNumber } from "@/lib/student-reports-store";
import { getStudentPortalCredentialByRegNumber } from "@/lib/student-portal-credentials-store";

export const dynamic = "force-dynamic";

type StudentPortalView = "overview" | "info" | "account" | "attendance" | "reports" | "timetable" | "absence";

interface StudentPortalDashboardPageProps {
  params: Promise<{
    regNumber: string;
  }>;
  searchParams?: Promise<{
    view?: string | string[];
  }>;
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function resolveView(value: string): StudentPortalView {
  const allowedViews: StudentPortalView[] = ["overview", "info", "account", "attendance", "reports", "timetable", "absence"];
  return allowedViews.includes(value as StudentPortalView) ? (value as StudentPortalView) : "overview";
}

export default async function StudentPortalDashboardPage({
  params,
  searchParams,
}: StudentPortalDashboardPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const regNumber = decodeURIComponent(resolvedParams.regNumber);
  const activeView = resolveView(firstParam(resolvedSearchParams?.view));
  const session = await getCurrentStudentPortalSession();

  if (!session) {
    redirect("/portal");
  }

  if (session.regNumber !== regNumber) {
    redirect(`/portal/student/${encodeURIComponent(session.regNumber)}`);
  }

  const [profile, credential, reports, absenceRequests, liveResults, attendanceSummaryMap, attendanceRegisters, timetable, classOfferings, school] = await Promise.all([
    getStudentProfile(regNumber),
    getStudentPortalCredentialByRegNumber(regNumber),
    listStudentReportsForRegNumber(regNumber),
    listStudentAbsenceRequestsForRegNumber(regNumber),
    getLiveResults(),
    buildAttendanceSummaryMap(),
    readStudentAttendanceRegisters(),
    readSchoolTimetable(),
    readClassOfferings(),
    readRuntimeSchoolProfile(),
  ]);

  if (!profile || !credential) {
    redirect("/portal");
  }

  if (credential.accountState !== "active" || profile.studentStatus !== "active") {
    redirect("/portal");
  }

  const summary = liveResults.summaries.find((item) => item.bundle.student.regNumber === regNumber);
  const attendanceSummary = attendanceSummaryMap.get(regNumber);
  const portalReports = reports
    .filter((report) => report.showOnPortal)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  const attendanceHistory = attendanceRegisters
    .filter((register) => register.entries.some((entry) => entry.regNumber === regNumber))
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 10)
    .map((register) => ({
      date: register.date,
      status: register.entries.find((entry) => entry.regNumber === regNumber)?.status ?? "present",
      teacher: register.recordedByName,
    }));
  const resultAvailable =
    !!summary &&
    !!summary.bundle.publishedAt &&
    ["published", "locked"].includes(summary.bundle.status) &&
    !summary.bundle.clearances.some((item) => item.status === "blocked");
  const classOffering = classOfferings.find((item) => item.className === profile.className) ?? null;
  const studentTimetableEntries =
    timetable.publishState === "published"
      ? timetable.entries.filter(
          (entry) =>
            entry.className === profile.className &&
            entry.arm === profile.arm &&
            (!entry.track || !profile.track || entry.track === profile.track),
        )
      : [];
  const studentTimetableMap = new Map<string, typeof studentTimetableEntries>();
  studentTimetableEntries.forEach((entry) => {
    const key = `${entry.day}-${entry.periodId}`;
    const current = studentTimetableMap.get(key) ?? [];
    current.push(entry);
    studentTimetableMap.set(key, current);
  });
  const timetableDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
  const navItems: Array<{ view: StudentPortalView; label: string; caption: string }> = [
    { view: "overview", label: "Overview", caption: "Summary and release status" },
    { view: "info", label: "Student Info", caption: "Biodata and guardian records" },
    { view: "account", label: "Student Account", caption: "Portal login and result access" },
    { view: "attendance", label: "Attendance", caption: "Attendance totals and history" },
    { view: "reports", label: "Reports", caption: "Teacher notes and praises" },
    { view: "timetable", label: "Timetable", caption: "Published arm timetable" },
    { view: "absence", label: "Absence Leave", caption: "Request and track approved absence" },
  ];

  const overviewView = (
    <>
      <section className="metric-grid compact">
        <article className="metric-card">
          <span>Portal Status</span>
          <strong>{resultStatusLabel(credential.accountState)}</strong>
          <p className="muted">
            Access pack: {resultStatusLabel(credential.status)} | Record: {resultStatusLabel(profile.studentStatus)}
          </p>
        </article>
        <article className="metric-card">
          <span>Attendance</span>
          <strong>{attendanceSummary ? `${attendanceSummary.percentage}%` : "N/A"}</strong>
          <p className="muted">
            {attendanceSummary
              ? `${attendanceSummary.present} present, ${attendanceSummary.absent} absent, ${attendanceSummary.late} late`
              : "No attendance summary available"}
          </p>
        </article>
        <article className="metric-card">
          <span>Reports on file</span>
          <strong>{portalReports.length}</strong>
          <p className="muted">Teacher and class notes visible on the portal</p>
        </article>
        <article className="metric-card">
          <span>Result Access</span>
          <strong>{resultAvailable ? "Available" : "Pending"}</strong>
          <p className="muted">Published results open directly from this account</p>
        </article>
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Class Summary</p>
              <h3>{profile.className} - {profile.arm}</h3>
            </div>
          </div>
          <div className="report-meta-grid">
            <div>
              <span>Student</span>
              <strong>{profile.fullName}</strong>
            </div>
            <div>
              <span>Class Teacher</span>
              <strong>{classOffering?.classTeacher ?? "Not yet assigned"}</strong>
            </div>
            <div>
              <span>Guardian</span>
              <strong>{profile.guardianName}</strong>
            </div>
            <div>
              <span>Guardian Phone</span>
              <strong>{profile.guardianPhone}</strong>
            </div>
            <div>
              <span>Father</span>
              <strong>{profile.fatherName} - {profile.fatherPhone}</strong>
            </div>
            <div>
              <span>Mother</span>
              <strong>{profile.motherName} - {profile.motherPhone}</strong>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Quick Actions</p>
              <h3>Open the most-used student items</h3>
            </div>
          </div>
          <div className="stack-list">
            <Link href={`/portal/student/${encodeURIComponent(regNumber)}?view=attendance`} className="selection-card">
              <strong>Attendance</strong>
              <p>Review attendance history and recent class marks.</p>
            </Link>
            <Link href={`/portal/student/${encodeURIComponent(regNumber)}?view=reports`} className="selection-card">
              <strong>Reports</strong>
              <p>Read the latest school notes, praises, and teacher follow-up.</p>
            </Link>
            <Link href={`/portal/student/${encodeURIComponent(regNumber)}?view=timetable`} className="selection-card">
              <strong>Timetable</strong>
              <p>Open the published timetable for your class arm.</p>
            </Link>
            {resultAvailable ? (
              <Link href={`/results/${encodeURIComponent(regNumber)}`} className="selection-card">
                <strong>Latest Result</strong>
                <p>Open the released result sheet attached to this account.</p>
              </Link>
            ) : (
              <div className="flow-step">
                <strong>Latest Result</strong>
                <p>The school has not released the current result yet.</p>
              </div>
            )}
          </div>
        </article>
      </section>
    </>
  );

  const infoView = (
    <section className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Student Information</p>
          <h3>Biodata and guardian profile</h3>
        </div>
      </div>
      <div className="profile-media-panel" style={{ marginBottom: "1rem" }}>
        <div className={profile.passportUrl ? "profile-photo-preview image" : "profile-photo-preview"}>
          {profile.passportUrl ? (
            <img src={profile.passportUrl} alt={`${profile.fullName} profile`} className="profile-photo-image" />
          ) : (
            <span>{profile.photoInitials || "S"}</span>
          )}
        </div>
      </div>
      <div className="report-meta-grid">
        <div>
          <span>Student</span>
          <strong>{profile.fullName}</strong>
        </div>
        <div>
          <span>Class / Arm</span>
          <strong>{profile.className} - {profile.arm}</strong>
        </div>
        <div>
          <span>Class Teacher</span>
          <strong>{classOffering?.classTeacher ?? "Not yet assigned"}</strong>
        </div>
        <div>
          <span>Guardian</span>
          <strong>{profile.guardianName}</strong>
        </div>
        <div>
          <span>Guardian Phone</span>
          <strong>{profile.guardianPhone}</strong>
        </div>
        <div>
          <span>Guardian Email</span>
          <strong>{profile.guardianEmail}</strong>
        </div>
        <div>
          <span>Father</span>
          <strong>{profile.fatherName} - {profile.fatherPhone}</strong>
        </div>
        <div>
          <span>Mother</span>
          <strong>{profile.motherName} - {profile.motherPhone}</strong>
        </div>
        <div>
          <span>Admission Date</span>
          <strong>{formatDateOnly(profile.admissionDate)}</strong>
        </div>
        <div>
          <span>Boarding</span>
          <strong>{profile.boardingStatus}</strong>
        </div>
        <div>
          <span>Blood Group / Genotype</span>
          <strong>{profile.bloodGroup} / {profile.genotype}</strong>
        </div>
        <div>
          <span>Home Address</span>
          <strong>{profile.homeAddress}</strong>
        </div>
      </div>
    </section>
  );

  const accountView = (
    <section className="grid-layout two-wide">
      <article className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Student Account</p>
            <h3>Portal and result access details</h3>
          </div>
        </div>
        <div className="stack-list compact">
          <div className="comparison-card">
            <span>Username</span>
            <strong>{credential.username}</strong>
          </div>
          <div className="comparison-card">
            <span>Temporary Password</span>
            <strong>{credential.temporaryPassword}</strong>
          </div>
          <div className="comparison-card">
            <span>Result Coupon</span>
            <strong>{credential.couponCode || "Not yet linked"}</strong>
          </div>
          <div className="comparison-card">
            <span>Generated By</span>
            <strong>{credential.generatedBy}</strong>
          </div>
          <div className="comparison-card">
            <span>Last Sign In</span>
            <strong>{credential.lastLoginAt ? formatDate(credential.lastLoginAt) : "First sign-in on current password"}</strong>
          </div>
          <div className="comparison-card">
            <span>Account Status</span>
            <strong>{resultStatusLabel(credential.accountState)} / {resultStatusLabel(profile.studentStatus)}</strong>
          </div>
        </div>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Result Access</p>
            <h3>Publication control</h3>
          </div>
        </div>
        <div className="stack-list">
          <div className="flow-step">
            <strong>Current result status</strong>
            <p>{resultAvailable ? "Released and available on this account." : "Not yet released by the school."}</p>
          </div>
          <div className="flow-step">
            <strong>Publication rule</strong>
            <p>Students can sign in at any time, but results appear only after the school publishes and clears them.</p>
          </div>
        </div>
        <div className="button-row">
          {resultAvailable ? (
            <Link href={`/results/${encodeURIComponent(regNumber)}`} className="primary-button">
              Open latest result
            </Link>
          ) : (
            <span className="status-pill status-under_review">Result not yet released</span>
          )}
        </div>
      </article>
    </section>
  );

  const attendanceView = (
    <section className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Attendance</p>
          <h3>Term attendance and recent class marks</h3>
        </div>
      </div>
      {attendanceSummary ? (
        <>
          <div className="inline-metrics">
            <div>
              <span>Present</span>
              <strong>{attendanceSummary.present}</strong>
            </div>
            <div>
              <span>Absent</span>
              <strong>{attendanceSummary.absent}</strong>
            </div>
            <div>
              <span>Late</span>
              <strong>{attendanceSummary.late}</strong>
            </div>
            <div>
              <span>Excused</span>
              <strong>{attendanceSummary.excused}</strong>
            </div>
            <div>
              <span>School Days</span>
              <strong>{attendanceSummary.possible}</strong>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Marked By</th>
                </tr>
              </thead>
              <tbody>
                {attendanceHistory.map((item) => (
                  <tr key={`${item.date}-${item.teacher}`}>
                    <td>{formatDateOnly(item.date)}</td>
                    <td>{resultStatusLabel(item.status)}</td>
                    <td>{item.teacher}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="flow-step">
          <strong>No attendance record is available yet.</strong>
          <p>The class teacher has not started the term register for this student.</p>
        </div>
      )}
    </section>
  );

  const reportsView = (
    <section className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">School Reports</p>
          <h3>Teacher notes, praise, and follow-up</h3>
        </div>
      </div>
      <div className="timeline">
        {portalReports.length > 0 ? (
          portalReports.map((report) => (
            <article key={report.id} className="timeline-item">
              <strong>{report.title}</strong>
              <p>{report.body}</p>
              <span>
                {report.authorName} - {resultStatusLabel(report.category)} - {formatDate(report.updatedAt)}
              </span>
              {report.attachmentLabel || report.attachmentUrl ? (
                <p className="muted">
                  Attachment reference: {report.attachmentLabel ?? report.attachmentUrl}
                </p>
              ) : null}
            </article>
          ))
        ) : (
          <div className="flow-step">
            <strong>No portal-visible report has been posted yet.</strong>
            <p>Teacher and class notes will appear here once they are logged for this student.</p>
          </div>
        )}
      </div>
    </section>
  );

  const timetableView = (
    <section className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Published Timetable</p>
          <h3>{profile.className} - {profile.arm}</h3>
        </div>
        {timetable.publishState === "published" ? (
          <div className="section-actions">
            <TimetableExportActions
              schoolName={school.shortName || school.name}
              title={`${profile.className} - ${profile.arm} Timetable`}
              subtitle={`Student timetable export for ${profile.fullName}.`}
              fileStem={`${school.shortName || school.name}-${profile.regNumber}-student-timetable`}
              periods={timetable.periods}
              pdfEntries={studentTimetableEntries}
            />
          </div>
        ) : null}
      </div>
      {timetable.publishState === "published" && timetable.periods.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table timetable-table">
            <thead>
              <tr>
                <th>Period</th>
                {timetableDays.map((day) => (
                  <th key={day}>{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timetable.periods.map((period) => (
                <tr key={period.id}>
                  <td>
                    <strong>{period.label}</strong>
                    <p className="muted">
                      {period.startTime} - {period.endTime}
                    </p>
                  </td>
                  {timetableDays.map((day) => {
                    const entries = studentTimetableMap.get(`${day}-${period.id}`) ?? [];

                    return (
                      <td key={`${day}-${period.id}`} className="timetable-cell">
                        {entries.length > 0 ? (
                          <div className="stack-list compact">
                            {entries.map((entry) => (
                              <div key={entry.id} className="timetable-card">
                                <strong>{entry.subjectName}</strong>
                                <p>{entry.teacherName}</p>
                                {entry.track ? <p className="muted">{entry.track}</p> : null}
                                {entry.room ? <span className="muted">{entry.room}</span> : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="muted">Free</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flow-step">
          <strong>Timetable is not yet published for student access.</strong>
          <p>The school timetable will appear here once the principal or school admin publishes it.</p>
        </div>
      )}
    </section>
  );

  const absenceView = <StudentPortalAbsencePanel requests={absenceRequests} studentStatus={profile.studentStatus} />;

  const activeContent =
    activeView === "overview"
      ? overviewView
      : activeView === "info"
        ? infoView
        : activeView === "account"
          ? accountView
          : activeView === "attendance"
            ? attendanceView
            : activeView === "reports"
              ? reportsView
              : activeView === "timetable"
                ? timetableView
                : absenceView;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <div className="brand-mark image-brand-mark">
            <img src={school.logoUrl} alt={`${school.name} logo`} className="brand-image" />
          </div>
          <div>
            <p className="eyebrow">Student Account</p>
            <h1>{school.shortName}</h1>
            <p className="muted">{profile.className}</p>
          </div>
        </div>

        <nav className="nav-list" aria-label="Student Portal">
          <div className="nav-section">
            <p className="nav-section-title">My Menu</p>
            <div className="nav-section-items">
              {navItems.map((item) => (
                <Link
                  key={item.view}
                  href={`/portal/student/${encodeURIComponent(regNumber)}?view=${item.view}`}
                  className={activeView === item.view ? "nav-item active" : "nav-item"}
                >
                  <span className="nav-item-label">{item.label}</span>
                  <span className="nav-item-caption">{item.caption}</span>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-id">
            <span className={profile.passportUrl ? "sidebar-avatar image" : "sidebar-avatar"}>
              {profile.passportUrl ? (
                <img src={profile.passportUrl} alt={`${profile.fullName} profile`} className="sidebar-avatar-image" />
              ) : (
                profile.photoInitials || "S"
              )}
            </span>
            <div>
              <strong>{profile.fullName}</strong>
              <span className="muted">{profile.regNumber}</span>
            </div>
          </div>
          <div className="button-row" style={{ width: "100%" }}>
            <Link href="/portal" className="secondary-button sidebar-signout">
              Portal Home
            </Link>
            <form action={studentPortalLogoutAction} style={{ width: "100%" }}>
              <button type="submit" className="secondary-button sidebar-signout">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="page-header">
          <p className="eyebrow">Student Dashboard</p>
          <div className="page-heading">
            <div>
              <h2>{profile.fullName}</h2>
              <p className="muted">
                {profile.className} - {profile.regNumber}
              </p>
            </div>
            <div className="header-chip">
              {resultAvailable ? "Result Released" : "Result Pending"}
            </div>
          </div>
        </header>

        {activeContent}
      </main>
    </div>
  );
}
