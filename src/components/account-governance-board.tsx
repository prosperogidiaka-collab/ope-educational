"use client";

import {
  GovernanceSnapshotPanels,
  RegistrarCredentialsPanel,
  ResultLocksPanel,
  ScopeGuardrailsPanel,
  StaffAccountsPanel,
  SubjectAssignmentsPanel,
} from "@/components/governance-panels";
import type {
  ResultLockRecord,
  RoleGovernancePolicy,
  SchoolProfile,
  StaffAccount,
  StudentPortalCredential,
  SubjectTeacherAssignment,
} from "@/lib/types";

interface AccountGovernanceBoardProps {
  school: SchoolProfile;
  accounts: StaffAccount[];
  credentials: StudentPortalCredential[];
  policy: RoleGovernancePolicy;
  assignments: SubjectTeacherAssignment[];
  resultLocks: ResultLockRecord[];
  canManage: boolean;
}

export function AccountGovernanceBoard({
  school,
  accounts,
  credentials,
  policy,
  assignments,
  resultLocks,
  canManage,
}: AccountGovernanceBoardProps) {
  return (
    <>
      <GovernanceSnapshotPanels school={school} policy={policy} />
      <SubjectAssignmentsPanel accounts={accounts} assignments={assignments} canManage={canManage} />
      <ResultLocksPanel resultLocks={resultLocks} canManage={canManage} />
      <StaffAccountsPanel accounts={accounts} canManage={canManage} />
      <section className="grid-layout two-wide">
        <RegistrarCredentialsPanel credentials={credentials} />
        <ScopeGuardrailsPanel school={school} accounts={accounts} />
      </section>
    </>
  );
}
