import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { canAccessAccount, isSchoolAdminRole } from "@/lib/auth";
import { overviewStats, recentAuditFeed, school } from "@/lib/demo-data";
import { formatDate, ordinal, resultStatusLabel } from "@/lib/calculations";
import { getLiveResults } from "@/lib/live-results";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const account = await getCurrentStaffAccount();
  if (account?.role === "super_admin") {
    redirect("/dashboard/super-admin");
  }

  if (account?.role && isSchoolAdminRole(account.role)) {
    redirect("/dashboard/school-admin");
  }

  const { summaries: studentSummaries } = await getLiveResults();
  const topStudents = studentSummaries.filter((item) => item.position > 0).slice(0, 3);
  const quickLinks = [
    { href: "/dashboard/teacher", label: "Open score desk" },
    { href: "/dashboard/score-review", label: "Open score review" },
    { href: "/dashboard/audit", label: "Open audit desk" },
  ].filter((item) => (account ? canAccessAccount(account, item.href) : false));

  return (
    <AppShell
      activeHref="/dashboard"
      eyebrow="Operations Dashboard"
      title={`${school.shortName} control center`}
      description="Monitor publication progress, review blockers, ranking eligibility, audit activity, and the next actions for this term."
    >
      <section className="metric-grid">
        {overviewStats.map((stat) => (
          <MetricCard key={stat.label} label={stat.label} value={stat.value} helper={stat.helper} />
        ))}
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Leaderboard</p>
              <h3>Current class positions</h3>
            </div>
            {quickLinks.length > 0 ? (
              <div className="button-row">
                {quickLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="secondary-button">
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Student</th>
                  <th>Reg Number</th>
                  <th>Weighted Average</th>
                  <th>Overall Grade</th>
                  <th>Sheet Status</th>
                </tr>
              </thead>
              <tbody>
                {studentSummaries.map((student) => (
                  <tr key={student.bundle.student.regNumber}>
                    <td>{ordinal(student.position)}</td>
                    <td>{student.bundle.student.fullName}</td>
                    <td>{student.bundle.student.regNumber}</td>
                    <td>{student.weightedAverage}%</td>
                    <td>{student.overallGrade.label}</td>
                    <td>
                      <span className={`status-pill status-${student.bundle.status}`}>
                        {resultStatusLabel(student.bundle.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Recent Audit Trail</p>
              <h3>Protected system events</h3>
            </div>
          </div>
          <div className="timeline">
            {recentAuditFeed.map((event) => (
              <article key={event.id} className="timeline-item">
                <strong>{event.actor}</strong>
                <p>{event.note}</p>
                <span>{formatDate(event.timestamp)}</span>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Snapshot</p>
            <h3>Best performing students this term</h3>
          </div>
        </div>
        <div className="leaderboard three-up">
          {topStudents.map((student) => (
            <div key={student.bundle.student.regNumber} className="leader-card feature">
              <span className="score-chip">{ordinal(student.position)}</span>
              <strong>{student.bundle.student.fullName}</strong>
              <p className="muted">{student.bundle.student.regNumber}</p>
              <h4>{student.weightedAverage}%</h4>
              <p>{student.overallGrade.remark}</p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
