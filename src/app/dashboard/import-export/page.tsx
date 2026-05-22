import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { studentPortalCredentials } from "@/lib/demo-data";
import { getLiveResults } from "@/lib/live-results";
import { readVisibleStaffAccounts } from "@/lib/staff-accounts-store";
import { readVisibleSubjectTeacherAssignments } from "@/lib/subject-teacher-assignments-store";

export const dynamic = "force-dynamic";

export default async function ImportExportPage() {
  const currentAccount = await getCurrentStaffAccount();
  const [staffAccounts, assignments, liveResults] = await Promise.all([
    readVisibleStaffAccounts(currentAccount),
    readVisibleSubjectTeacherAssignments(currentAccount),
    getLiveResults(),
  ]);

  return (
    <AppShell
      activeHref="/dashboard/import-export"
      eyebrow="Bulk Import and Export"
      title="Bulk import and export desk"
      description="Use one clear desk for large staff, subject, class-arm, and student registration movements instead of handling them one by one."
    >
      <section className="metric-grid compact">
        <MetricCard label="Staff accounts" value={`${staffAccounts.length}`} helper="Users that can be exported or bulk-created" />
        <MetricCard label="Assignments" value={`${assignments.length}`} helper="Subject-class rows currently mapped" />
        <MetricCard label="Students" value={`${liveResults.summaries.length}`} helper="Registered student records in the live result server" />
        <MetricCard label="Portal credentials" value={`${studentPortalCredentials.length}`} helper="Student access records ready for export" />
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Bulk Import</p>
              <h3>What should be uploaded from files</h3>
            </div>
          </div>
          <div className="stack-list">
            <div className="flow-step">
              <strong>Staff accounts and role scopes</strong>
              <p>Prepare bulk onboarding for teachers, principals, registrars, and support roles with clean account status control.</p>
            </div>
            <div className="flow-step">
              <strong>Class arms and subject registration</strong>
              <p>Load the exact arms, sections, tracks, and subject structures before the term opens for score entry.</p>
            </div>
            <div className="flow-step">
              <strong>Student registrations and portal access</strong>
              <p>Upload students in batches, then issue usernames, temporary passwords, and result coupons from one place.</p>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Bulk Export</p>
              <h3>What should leave the platform cleanly</h3>
            </div>
          </div>
          <div className="stack-list">
            <div className="flow-step">
              <strong>Operational exports</strong>
              <p>Pull out staff accounts, subject mappings, student access sheets, and class-arm structures for admin review.</p>
            </div>
            <div className="flow-step">
              <strong>Academic exports</strong>
              <p>Prepare term-based outputs for broadsheets, published sheets, and archive desks without re-entering data manually.</p>
            </div>
            <div className="flow-step">
              <strong>Compliance exports</strong>
              <p>Pass corrected score history, approval traces, and audit-ready packages into evidence or inspection workflows.</p>
            </div>
          </div>
        </article>
      </section>

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Source Menus</p>
            <h3>Open the records that feed the bulk desk</h3>
          </div>
        </div>
        <div className="card-grid">
          <Link href="/dashboard/staff-accounts" className="selection-card">
            <strong>Staff accounts</strong>
            <p>Review the people and roles that belong in staff import or export packs.</p>
          </Link>
          <Link href="/dashboard/teacher-assignments" className="selection-card">
            <strong>Teacher assignments</strong>
            <p>Check subject-class ownership before importing or exporting assignment maps.</p>
          </Link>
          <Link href="/dashboard/class-arms" className="selection-card">
            <strong>Class arms</strong>
            <p>Open the arm structure that should be reflected in import templates and export packs.</p>
          </Link>
          <Link href="/dashboard/student-access" className="selection-card">
            <strong>Student access</strong>
            <p>Manage portal usernames, passwords, and coupons before issuing access files.</p>
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
