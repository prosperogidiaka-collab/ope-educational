import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import {
  ClassResponsibilityPanel,
  GovernanceSnapshotPanels,
  ScopeGuardrailsPanel,
  SubjectAssignmentsPanel,
} from "@/components/governance-panels";
import { MetricCard } from "@/components/metric-card";
import { readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { readVisibleClassOfferings } from "@/lib/class-offerings-store";
import { roleGovernancePolicy } from "@/lib/demo-data";
import { readVisibleStaffAccounts } from "@/lib/staff-accounts-store";
import { readVisibleSubjectTeacherAssignments } from "@/lib/subject-teacher-assignments-store";

export const dynamic = "force-dynamic";

export default async function TeacherAssignmentsPage() {
  const currentAccount = await getCurrentStaffAccount();
  const [accounts, assignments, offerings, school] = await Promise.all([
    readVisibleStaffAccounts(currentAccount),
    readVisibleSubjectTeacherAssignments(currentAccount),
    readVisibleClassOfferings(currentAccount),
    readRuntimeSchoolProfile(),
  ]);
  const assignedCount = assignments.filter((assignment) => assignment.teacherAccountId).length;
  const unassignedCount = assignments.length - assignedCount;
  const classCount = new Set(assignments.map((assignment) => assignment.className)).size;
  const classTeacherCount = offerings.filter((offering) => offering.classTeacher).length;
  const canManage = Boolean(
    currentAccount &&
      (currentAccount.canRegisterTeachers ||
        currentAccount.canDisableTeachers ||
        currentAccount.role === "registrar" ||
        currentAccount.canRegisterStudents),
  );

  return (
    <AppShell
      activeHref="/dashboard/teacher-assignments"
      eyebrow="Subject and Class Assignment"
      title="Teacher subject and class assignment control"
      description="Map teacher accounts to subject slots and class responsibility from one page. Assign, unassign, and verify score-entry or class-duty scope without shared logins."
    >
      <section className="metric-grid compact">
        <MetricCard label="Subject-class arms" value={`${assignments.length}`} helper="Total assignment rows available this term" />
        <MetricCard label="Assigned" value={`${assignedCount}`} helper="Already mapped to active staff accounts" />
        <MetricCard label="Unassigned" value={`${unassignedCount}`} helper="Needs a subject teacher before score entry opens" />
        <MetricCard label="Class arms" value={`${classCount}`} helper="Covered by the current assignment register" />
        <MetricCard label="Class-teacher duties" value={`${classTeacherCount}`} helper="Class arms already attached to a teacher account" />
      </section>

      <GovernanceSnapshotPanels school={school} policy={roleGovernancePolicy} />
      <SubjectAssignmentsPanel accounts={accounts} assignments={assignments} canManage={canManage} />
      <ClassResponsibilityPanel accounts={accounts} offerings={offerings} canManage={canManage} />

      <section className="grid-layout two-wide">
        <ScopeGuardrailsPanel school={school} accounts={accounts} />

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Related Controls</p>
              <h3>Other setup pages tied to assignments</h3>
            </div>
          </div>
          <div className="stack-list">
            <Link href="/dashboard/class-arms" className="selection-card">
              <strong>Class arms</strong>
              <p>Define each arm, track, section, and ownership structure for the class registry.</p>
            </Link>
            <Link href="/dashboard/subject-registration" className="selection-card">
              <strong>Subject registration</strong>
              <p>Specify compulsory and elective subjects available inside each class arm.</p>
            </Link>
            <Link href="/dashboard/staff-accounts" className="selection-card">
              <strong>Staff accounts</strong>
              <p>Review active, disabled, and registrar-owned accounts before mapping them to subjects.</p>
            </Link>
            <Link href="/dashboard/result-locks" className="selection-card">
              <strong>Result locks</strong>
              <p>Freeze or reopen classes after assignments have been reviewed and scores have been entered.</p>
            </Link>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
