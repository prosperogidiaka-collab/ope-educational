import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import {
  GovernanceSnapshotPanels,
  StaffAccountsPanel,
} from "@/components/governance-panels";
import { MetricCard } from "@/components/metric-card";
import { readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { isSchoolAdminRole, ROLE_LABEL } from "@/lib/auth";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { roleGovernancePolicy } from "@/lib/demo-data";
import { readVisibleStaffAccounts } from "@/lib/staff-accounts-store";

export const dynamic = "force-dynamic";

export default async function StaffAccountsPage() {
  const currentAccount = await getCurrentStaffAccount();
  const [accounts, school] = await Promise.all([readVisibleStaffAccounts(currentAccount), readRuntimeSchoolProfile()]);
  const activeCount = accounts.filter((account) => account.status === "active").length;
  const disabledCount = accounts.filter((account) => account.status === "disabled").length;
  const teacherScopedCount = accounts.filter(
    (account) =>
      account.assignedSubjects.length > 0 || account.classTeacherArms.length > 0,
  ).length;
  const roleCount = new Set(accounts.map((account) => ROLE_LABEL[account.role])).size;
  const canManage = Boolean(
    currentAccount &&
      (isSchoolAdminRole(currentAccount.role) ||
        currentAccount.canRegisterTeachers ||
        currentAccount.canDisableTeachers),
  );

  return (
    <AppShell
      activeHref="/dashboard/staff-accounts"
      eyebrow="Staff Accounts"
      title="Account register and scope audit"
      description="Review every school-owned login, the role behind it, and the exact subject or class responsibility tied to that account."
    >
      <section className="metric-grid compact">
        <MetricCard label="Accounts" value={`${accounts.length}`} helper="All school staff accounts on this tenant" />
        <MetricCard label="Active" value={`${activeCount}`} helper="Can sign in and use their assigned menus" />
        <MetricCard label="Disabled" value={`${disabledCount}`} helper="Blocked from accessing the result workflow" />
        <MetricCard label="Role types" value={`${roleCount}`} helper="Distinct staff roles represented in the school" />
      </section>

      <GovernanceSnapshotPanels school={school} policy={roleGovernancePolicy} />
      <StaffAccountsPanel accounts={accounts} canManage={canManage} />

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Scope Summary</p>
              <h3>Who currently owns teaching scope</h3>
            </div>
          </div>
          <div className="inline-metrics">
            <div>
              <span>Teacher-scoped accounts</span>
              <strong>{teacherScopedCount}</strong>
            </div>
            <div>
              <span>School-admin accounts</span>
              <strong>{accounts.filter((account) => isSchoolAdminRole(account.role)).length}</strong>
            </div>
            <div>
              <span>Registrar accounts</span>
              <strong>{accounts.filter((account) => account.role === "registrar").length}</strong>
            </div>
            <div>
              <span>HOD accounts</span>
              <strong>{accounts.filter((account) => account.role === "hod").length}</strong>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Related Controls</p>
              <h3>Pages used with account governance</h3>
            </div>
          </div>
          <div className="stack-list">
            <Link href="/dashboard/teacher-assignments" className="selection-card">
              <strong>Subject and class assignment</strong>
              <p>Map each active account to subject slots and attach class responsibility where needed.</p>
            </Link>
            <Link href="/dashboard/student-access" className="selection-card">
              <strong>Student access</strong>
              <p>Review registrar-generated student usernames, passwords, and coupon access.</p>
            </Link>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
