import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { SchoolBrandingPanel } from "@/components/school-branding-panel";
import {
  notifications,
  principalHighlights,
} from "@/lib/demo-data";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { formatDateOnly, resultStatusLabel } from "@/lib/calculations";
import { getLiveResults } from "@/lib/live-results";
import { readResultLocks } from "@/lib/result-locks-store";
import { readVisibleStaffAccounts } from "@/lib/staff-accounts-store";
import { readVisibleSubjectTeacherAssignments } from "@/lib/subject-teacher-assignments-store";

export const dynamic = "force-dynamic";

export default async function SchoolAdminDashboardPage() {
  const currentAccount = await getCurrentStaffAccount();
  const [
    { academicConfig, school, summaries: studentSummaries, subjectSheets },
    staffAccounts,
    subjectAssignments,
    resultLocks,
  ] = await Promise.all([
    getLiveResults(),
    readVisibleStaffAccounts(currentAccount),
    readVisibleSubjectTeacherAssignments(currentAccount),
    readResultLocks(),
  ]);

  const unlockRequests = studentSummaries
    .filter((summary) => summary.bundle.unlockRequest)
    .map((summary) => ({
      studentName: summary.bundle.student.fullName,
      regNumber: summary.bundle.student.regNumber,
      request: summary.bundle.unlockRequest!,
    }));
  const assignedCount = subjectAssignments.filter((assignment) => assignment.teacherAccountId).length;
  const lockedCount = resultLocks.filter((lock) => lock.locked).length;
  const correctionCount = Object.values(subjectSheets).filter(
    (sheet) => sheet.sheetStatus === "corrections_requested",
  ).length;
  const activeAccounts = staffAccounts.filter((account) => account.status === "active").length;
  const activeAssessmentSlots = academicConfig.scoreComponents.length;

  return (
    <AppShell
      activeHref="/dashboard/school-admin"
      eyebrow="School Admin Control Center"
      title={`${currentAccount?.fullName ?? school.schoolAdminName ?? "School admin"} operations desk`}
      description="Use this page as the school-admin overview and watchlist. The real working menus stay in the sidebar so the control surface is not duplicated here."
    >
      <section className="surface-card">
        <div className="callout-banner">
          <strong>The school admin is now separate from the academic principal identity.</strong>
          <p className="muted">
            Tenant administration, access governance, and software controls live here, while the principal still remains part of school identity and report terminology where applicable.
          </p>
        </div>
      </section>

      <section className="metric-grid">
        {principalHighlights.map((stat) => (
          <MetricCard key={stat.label} label={stat.label} value={stat.value} helper={stat.helper} />
        ))}
      </section>

      <SchoolBrandingPanel school={school} canManage />

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Current Scope</p>
              <h3>Live operational summary</h3>
            </div>
          </div>
          <div className="inline-metrics">
            <div>
              <span>Active workflow</span>
              <strong>{school.session} - {school.term}</strong>
            </div>
            <div>
              <span>Assessment slots</span>
              <strong>{activeAssessmentSlots}</strong>
            </div>
            <div>
              <span>Locked classes</span>
              <strong>{lockedCount}</strong>
            </div>
            <div>
              <span>Correction flags</span>
              <strong>{correctionCount}</strong>
            </div>
            <div>
              <span>Teacher assignment coverage</span>
              <strong>{assignedCount} / {subjectAssignments.length}</strong>
            </div>
            <div>
              <span>Active staff accounts</span>
              <strong>{activeAccounts}</strong>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Role Boundaries</p>
              <h3>Who owns which duty now</h3>
            </div>
          </div>
          <div className="stack-list">
            <div className="flow-step">
              <strong>School admin</strong>
              <p>Owns tenant administration, teacher assignments, result locks, score overrides, publication checks, report output, and school-level setup.</p>
            </div>
            <div className="flow-step">
              <strong>Registrar</strong>
              <p>Owns student access, class-arm setup, subject registration, and related registration desks only when assigned that duty.</p>
            </div>
            <div className="flow-step">
              <strong>Super admin</strong>
              <p>Owns full cross-school and platform-wide access, including subscription follow-up and app-wide controls that should never sit inside a single school tenant.</p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Controlled Unlock</p>
              <h3>Post-publish correction queue</h3>
            </div>
          </div>
          <div className="stack-list">
            {unlockRequests.length > 0 ? (
              unlockRequests.map((item) => (
                <div key={item.regNumber} className="alert-card">
                  <strong>{item.studentName}</strong>
                  <p className="muted">{item.regNumber}</p>
                  <p>{item.request.reason}</p>
                  <span
                    className={`status-pill status-${
                      item.request.status === "approved"
                        ? "approved"
                        : item.request.status === "declined"
                          ? "corrections_requested"
                          : "under_review"
                    }`}
                  >
                    {resultStatusLabel(item.request.status)}
                  </span>
                </div>
              ))
            ) : (
              <div className="flow-step">
                <strong>No unlock requests are waiting.</strong>
                <p>The score review and result lock menus are currently clear.</p>
              </div>
            )}
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Alerts</p>
              <h3>Recent admin and publication feed</h3>
            </div>
          </div>
          <div className="timeline">
            {notifications.map((item) => (
              <article key={item.id} className="timeline-item">
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                <span>{item.audience} - {formatDateOnly(item.timestamp)}</span>
              </article>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
