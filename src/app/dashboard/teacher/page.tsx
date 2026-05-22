import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { loadTeacherWorkspace } from "@/lib/teacher-workspace";

export const dynamic = "force-dynamic";

export default async function TeacherWorkspacePage() {
  const account = await getCurrentStaffAccount();

  if (!account) {
    return null;
  }

  const workspace = await loadTeacherWorkspace(account);

  return (
    <AppShell
      activeHref="/dashboard/teacher"
      eyebrow="Teacher Workspace"
      title={`${account.fullName} workspace`}
      description="Each teacher activity now has its own menu. Open score entry, student reports, attendance, or leadership notes from separate pages instead of one compacted desk."
    >
      <section className="metric-grid compact">
        <MetricCard label="Assignments" value={`${workspace.counts.assignments}`} helper="Subject-class arms attached to this account" />
        <MetricCard label="Visible Students" value={`${workspace.counts.visibleStudents}`} helper="Students inside your current teaching or class-teacher scope" />
        <MetricCard label="Class Arms" value={`${workspace.counts.classTeacherArms}`} helper="Class-teacher attendance arms attached to this account" />
        <MetricCard label="Leadership Notes" value={`${workspace.counts.leadershipReports}`} helper="Notes posted about this teacher account" />
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Teaching Menus</p>
              <h3>Open one task per page</h3>
            </div>
          </div>
          <div className="card-grid">
            <Link href="/dashboard/teacher/assignments" className="selection-card">
              <strong>Score Entry and Assignments</strong>
              <p>Open your assigned subject sheets, save scores, and submit them from a dedicated page.</p>
              <span className="muted">
                {workspace.counts.assignments} assignment{workspace.counts.assignments === 1 ? "" : "s"} | {workspace.counts.lockedAssignments} locked
              </span>
            </Link>
            <Link href="/dashboard/teacher/students" className="selection-card">
              <strong>Student Reports</strong>
              <p>Log praise, guidance, discipline, health, and result comments without mixing them with scoring.</p>
              <span className="muted">
                {workspace.counts.visibleStudents} students | {workspace.counts.studentReports} report records
              </span>
            </Link>
            {workspace.counts.classTeacherArms > 0 ? (
              <Link href="/dashboard/teacher/attendance" className="selection-card">
                <strong>Class Attendance</strong>
                <p>Mark daily attendance on its own page whenever this account carries class-teacher responsibility.</p>
                <span className="muted">
                  {workspace.attendancePolicy.attendanceEnabled ? "Attendance active" : "Attendance paused"} | {workspace.counts.classTeacherArms} class arm{workspace.counts.classTeacherArms === 1 ? "" : "s"}
                </span>
              </Link>
            ) : (
              <div className="selection-card">
                <strong>Class Attendance</strong>
                <p>Attendance stays separated too, and it will open here once a class arm is assigned to this account.</p>
                <span className="muted">No class-teacher arm is attached yet.</span>
              </div>
            )}
            <Link href="/dashboard/teacher/leadership" className="selection-card">
              <strong>Leadership Notes</strong>
              <p>Read the notes and follow-up reports logged about this teacher account.</p>
              <span className="muted">
                {workspace.counts.leadershipReports} note{workspace.counts.leadershipReports === 1 ? "" : "s"}
              </span>
            </Link>
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Quick Context</p>
              <h3>What needs attention now</h3>
            </div>
          </div>
          <div className="stack-list">
            <div className="flow-step">
              <strong>Returned score sheets</strong>
              <p>
                {workspace.counts.returnedSheets > 0
                  ? `${workspace.counts.returnedSheets} sheet${workspace.counts.returnedSheets === 1 ? "" : "s"} need correction review from the assignments page.`
                  : "No returned score sheet is waiting for correction right now."}
              </p>
            </div>
            <div className="flow-step">
              <strong>Attendance status</strong>
              <p>
                {workspace.counts.classTeacherArms > 0
                  ? workspace.attendancePolicy.attendanceEnabled
                    ? `Attendance is active for ${workspace.counts.classTeacherArms} class arm${workspace.counts.classTeacherArms === 1 ? "" : "s"}.`
                    : "You have class-teacher arms, but the school admin has not activated attendance for this term yet."
                  : "This account does not currently carry any class-teacher arm for attendance."}
              </p>
            </div>
            <div className="flow-step">
              <strong>Student reporting scope</strong>
              <p>
                Student reports and follow-up notes now open on their own page for {workspace.counts.visibleStudents} visible student{workspace.counts.visibleStudents === 1 ? "" : "s"}.
              </p>
            </div>
            <div className="flow-step">
              <strong>Timetable</strong>
              <p>Your timetable remains on its own menu so lesson planning stays separate from teaching records and review work.</p>
            </div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
