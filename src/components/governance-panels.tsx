"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { isSchoolAdminRole, ROLE_LABEL } from "@/lib/auth";
import { classOfferingLabel } from "@/lib/class-structure";
import { resultStatusLabel } from "@/lib/calculations";
import { buildInlineAttachmentPayload } from "@/lib/file-attachments";
import type {
  ClassOffering,
  ResultLockRecord,
  RoleGovernancePolicy,
  SchoolProfile,
  StaffAccount,
  StudentPortalCredential,
  SubjectTeacherAssignment,
} from "@/lib/types";

const ASSIGNABLE_ROLES = new Set(["teacher", "class_teacher", "hod", "school_admin", "principal"]);

function buildInitials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function uniqueAssignments(assignments: SubjectTeacherAssignment[]) {
  return [...assignments].sort((left, right) => {
    const classCompare = left.className.localeCompare(right.className);
    if (classCompare !== 0) {
      return classCompare;
    }

    return left.subjectName.localeCompare(right.subjectName);
  });
}

export function GovernanceSnapshotPanels({
  school,
  policy,
}: {
  school: SchoolProfile;
  policy: RoleGovernancePolicy;
}) {
  return (
    <section className="grid-layout two-wide">
      <article className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">School Identity</p>
            <h3>Registered code and uploaded assets</h3>
          </div>
        </div>
        <div className="school-identity-card">
          <img src={school.logoUrl} alt={`${school.name} logo`} className="school-identity-logo" />
          <div className="stack-list compact">
            <div className="comparison-card">
              <span>School code</span>
              <strong>{school.schoolCode}</strong>
            </div>
            <div className="comparison-card">
              <span>Portal slug</span>
              <strong>{school.portalSlug}</strong>
            </div>
            <div className="comparison-card">
              <span>Government stamp</span>
              <strong>Uploaded and available to the template builder</strong>
            </div>
          </div>
        </div>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Account Governance</p>
            <h3>Who can register and disable accounts</h3>
          </div>
        </div>
        <div className="stack-list compact">
          <div className="comparison-card">
            <span>School admin can register teachers</span>
            <strong>{policy.principalCanRegisterTeachers ? "Enabled" : "Disabled"}</strong>
          </div>
          <div className="comparison-card">
            <span>HOD can register teachers if school admin permits</span>
            <strong>
              {policy.hodCanRegisterTeachersIfPermitted && policy.hodTeacherRegistrationEnabled
                ? "Enabled"
                : "Disabled"}
            </strong>
          </div>
          <div className="comparison-card">
            <span>School admin can disable teacher accounts</span>
            <strong>{policy.principalCanDisableTeachers ? "Enabled" : "Disabled"}</strong>
          </div>
          <div className="comparison-card">
            <span>Super admin can disable school admin</span>
            <strong>{policy.superAdminCanDisablePrincipal ? "Enabled" : "Disabled"}</strong>
          </div>
          <div className="comparison-card">
            <span>Registrar manages student onboarding</span>
            <strong>{policy.registrarCanRegisterStudents ? "Enabled" : "Disabled"}</strong>
          </div>
        </div>
      </article>
    </section>
  );
}

export function SubjectAssignmentsPanel({
  accounts,
  assignments,
  canManage,
}: {
  accounts: StaffAccount[];
  assignments: SubjectTeacherAssignment[];
  canManage: boolean;
}) {
  const [localAccounts, setLocalAccounts] = useState(accounts);
  const [localAssignments, setLocalAssignments] = useState(assignments);
  const [assignmentTargets, setAssignmentTargets] = useState<Record<string, string>>(
    Object.fromEntries(assignments.map((assignment) => [assignment.id, assignment.teacherAccountId ?? ""])),
  );
  const [assignmentFeedback, setAssignmentFeedback] = useState(
    "Use one teacher account per subject slot. The same teacher account can also carry class responsibility separately.",
  );
  const [busyAssignmentId, setBusyAssignmentId] = useState<string | null>(null);

  const assignableAccounts = useMemo(
    () =>
      localAccounts.filter(
        (account) => account.status === "active" && ASSIGNABLE_ROLES.has(account.role),
      ),
    [localAccounts],
  );
  const sortedAssignments = useMemo(() => uniqueAssignments(localAssignments), [localAssignments]);

  async function saveAssignment(assignmentId: string) {
    setBusyAssignmentId(assignmentId);

    try {
      const response = await fetch(`/api/subject-teacher-assignments/${encodeURIComponent(assignmentId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherAccountId: assignmentTargets[assignmentId] || null,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        assignment?: SubjectTeacherAssignment;
        accounts?: StaffAccount[];
      };

      if (!response.ok || !payload.assignment || !payload.accounts) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalAssignments((current) =>
        current.map((assignment) =>
          assignment.id === payload.assignment?.id ? payload.assignment : assignment,
        ),
      );
      setLocalAccounts(payload.accounts);
      setAssignmentFeedback(
        payload.assignment.teacherName
          ? `${payload.assignment.subjectName} / ${payload.assignment.className} is now assigned to ${payload.assignment.teacherName}.`
          : `${payload.assignment.subjectName} / ${payload.assignment.className} is now unassigned.`,
      );
    } catch (error) {
      setAssignmentFeedback(
        error instanceof Error ? error.message : "Could not update the assignment right now.",
      );
    } finally {
      setBusyAssignmentId(null);
    }
  }

  return (
    <section className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Teacher Assignments</p>
          <h3>One account per teacher, one teacher per subject-class arm</h3>
        </div>
        <span className={`status-pill ${canManage ? "status-approved" : "status-under_review"}`}>
          {canManage ? "Granted control" : "Read only"}
        </span>
      </div>
      <div className="callout-banner">
          <strong>{assignmentFeedback}</strong>
          <p className="muted">
            Each row is one subject slot for one class arm. If a teacher already owns the slot,
            use the edit action to reassign or clear it. Class responsibility is assigned separately below.
          </p>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Class</th>
              <th>Arm</th>
              <th>Current Teacher</th>
              <th>Select Teacher</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedAssignments.map((assignment) => (
              <tr key={assignment.id}>
                <td>
                  <strong>{assignment.subjectName}</strong>
                  <p className="muted">{assignment.subjectCode}</p>
                </td>
                <td>{assignment.className}</td>
                <td>{assignment.arm}</td>
                <td>{assignment.teacherName ?? "Unassigned"}</td>
                <td>
                  <select
                    value={assignmentTargets[assignment.id] ?? ""}
                    onChange={(event) =>
                      setAssignmentTargets((current) => ({
                        ...current,
                        [assignment.id]: event.target.value,
                      }))
                    }
                    disabled={!canManage || busyAssignmentId === assignment.id}
                  >
                    <option value="">Unassigned</option>
                    {assignableAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.fullName} ({ROLE_LABEL[account.role]})
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!canManage || busyAssignmentId === assignment.id}
                    onClick={() => void saveAssignment(assignment.id)}
                  >
                    {busyAssignmentId === assignment.id
                      ? "Saving..."
                      : assignment.teacherAccountId
                        ? "Edit assignment"
                        : "Assign teacher"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ClassResponsibilityPanel({
  accounts,
  offerings,
  canManage,
}: {
  accounts: StaffAccount[];
  offerings: ClassOffering[];
  canManage: boolean;
}) {
  const [localOfferings, setLocalOfferings] = useState(offerings);
  const [classTeacherTargets, setClassTeacherTargets] = useState<Record<string, string>>(
    Object.fromEntries(
      offerings.map((offering) => [
        offering.className,
        accounts.find((account) => account.fullName === offering.classTeacher)?.id ?? "",
      ]),
    ),
  );
  const [feedback, setFeedback] = useState(
    "Class responsibility is assigned on a teacher account. It is not a different human role, just extra class scope on top of teaching access.",
  );
  const [busyClassName, setBusyClassName] = useState<string | null>(null);

  const assignableAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.status === "active" && ASSIGNABLE_ROLES.has(account.role),
      ),
    [accounts],
  );
  const sortedOfferings = useMemo(
    () => [...localOfferings].sort((left, right) => left.className.localeCompare(right.className)),
    [localOfferings],
  );

  async function saveClassResponsibility(className: string) {
    const offering = localOfferings.find((item) => item.className === className);

    if (!offering) {
      return;
    }

    const selectedTeacher = assignableAccounts.find((account) => account.id === classTeacherTargets[className]);
    setBusyClassName(className);

    try {
      const response = await fetch(`/api/class-arms/${encodeURIComponent(className)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...offering,
          classTeacher: selectedTeacher?.fullName ?? "",
        }),
      });
      const payload = (await response.json()) as { error?: string; offering?: ClassOffering };

      if (!response.ok || !payload.offering) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalOfferings((current) =>
        current.map((item) => (item.className === payload.offering?.className ? payload.offering! : item)),
      );
      setFeedback(
        payload.offering.classTeacher
          ? `${payload.offering.classTeacher} now carries class responsibility for ${classOfferingLabel(payload.offering)}.`
          : `Class responsibility for ${classOfferingLabel(payload.offering)} has been cleared.`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not update class responsibility right now.");
    } finally {
      setBusyClassName(null);
    }
  }

  return (
    <section className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Class Responsibility</p>
          <h3>Assign class teachers by class arm</h3>
        </div>
        <span className={`status-pill ${canManage ? "status-approved" : "status-under_review"}`}>
          {canManage ? "Granted control" : "Read only"}
        </span>
      </div>
      <div className="callout-banner">
        <strong>{feedback}</strong>
        <p className="muted">
          Any teaching account can be given a class arm to supervise attendance, class comments, and broadsheet follow-up.
        </p>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Class Arm</th>
              <th>Section / Track</th>
              <th>Current Class Teacher</th>
              <th>Select Teacher</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedOfferings.map((offering) => (
              <tr key={offering.className}>
                <td>
                  <strong>{classOfferingLabel(offering)}</strong>
                  <p className="muted">{offering.className}</p>
                </td>
                <td>
                  {resultStatusLabel(offering.section)}
                  <p className="muted">{offering.track}</p>
                </td>
                <td>{offering.classTeacher || "Unassigned"}</td>
                <td>
                  <select
                    value={classTeacherTargets[offering.className] ?? ""}
                    onChange={(event) =>
                      setClassTeacherTargets((current) => ({
                        ...current,
                        [offering.className]: event.target.value,
                      }))
                    }
                    disabled={!canManage || busyClassName === offering.className}
                  >
                    <option value="">Unassigned</option>
                    {assignableAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.fullName} ({ROLE_LABEL[account.role]})
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!canManage || busyClassName === offering.className}
                    onClick={() => void saveClassResponsibility(offering.className)}
                  >
                    {busyClassName === offering.className ? "Saving..." : "Save class assignment"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ResultLocksPanel({
  resultLocks,
  canManage,
}: {
  resultLocks: ResultLockRecord[];
  canManage: boolean;
}) {
  const [localLocks, setLocalLocks] = useState(resultLocks);
  const [lockFeedback, setLockFeedback] = useState(
    "Locking stops teachers from editing that class for the current term. Reopening restores score entry for assigned teachers.",
  );
  const [busyClassName, setBusyClassName] = useState<string | null>(null);

  async function toggleResultLock(lock: ResultLockRecord) {
    setBusyClassName(lock.className);

    try {
      const response = await fetch(`/api/result-locks/${encodeURIComponent(lock.className)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locked: !lock.locked,
          note: lock.locked
            ? `Reopened ${lock.className} for assigned subject teachers.`
            : `Locked ${lock.className} after review and publication checks.`,
        }),
      });
      const payload = (await response.json()) as { error?: string; lock?: ResultLockRecord };

      if (!response.ok || !payload.lock) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalLocks((current) =>
        current.map((item) => (item.id === payload.lock?.id ? payload.lock : item)),
      );
      setLockFeedback(
        payload.lock.locked
          ? `${payload.lock.className} is now locked. Teachers cannot edit scores for ${payload.lock.term}.`
          : `${payload.lock.className} has been reopened. Assigned teachers can edit again for ${payload.lock.term}.`,
      );
    } catch (error) {
      setLockFeedback(
        error instanceof Error ? error.message : "Could not change the result lock right now.",
      );
    } finally {
      setBusyClassName(null);
    }
  }

  return (
    <section className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Result Locks</p>
          <h3>Lock or reopen a class for the current term</h3>
        </div>
      </div>
      <div className="callout-banner">
        <strong>{lockFeedback}</strong>
        <p className="muted">
          Locking protects broadsheets, live report sheets, and student result views from further
          teacher edits until the class is reopened.
        </p>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Class Arm</th>
              <th>Session / Term</th>
              <th>Status</th>
              <th>Last Control</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {localLocks.map((lock) => (
              <tr key={lock.id}>
                <td>{lock.className}</td>
                <td>
                  {lock.session} - {lock.term}
                </td>
                <td>
                  <span className={`status-pill ${lock.locked ? "status-locked" : "status-approved"}`}>
                    {lock.locked ? "Locked" : "Open"}
                  </span>
                </td>
                <td>{lock.locked ? lock.lockedBy ?? "School Admin" : lock.unlockedBy ?? "Open for teachers"}</td>
                <td>
                  <button
                    type="button"
                    className={lock.locked ? "secondary-button" : "primary-button"}
                    disabled={!canManage || busyClassName === lock.className}
                    onClick={() => void toggleResultLock(lock)}
                  >
                    {busyClassName === lock.className
                      ? "Saving..."
                      : lock.locked
                        ? "Reopen result entry"
                        : "Lock results"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function StaffAccountsPanel({
  accounts,
  canManage = false,
}: {
  accounts: StaffAccount[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [localAccounts, setLocalAccounts] = useState(accounts);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? "");
  const [feedback, setFeedback] = useState(
    "Staff profile photos help the dashboard, assignment desks, and sign-in shell show the correct teacher identity.",
  );
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const selectedAccount =
    localAccounts.find((account) => account.id === selectedAccountId) ?? localAccounts[0] ?? null;

  async function loadProfilePhoto(file: File | null) {
    if (!selectedAccount) {
      return;
    }

    if (!file) {
      setLocalAccounts((current) =>
        current.map((account) =>
          account.id === selectedAccount.id
            ? {
                ...account,
                photoUrl: undefined,
              }
            : account,
        ),
      );
      setFeedback(`Cleared ${selectedAccount.fullName}'s profile photo locally. Save to apply the change.`);
      return;
    }

    try {
      const payload = await buildInlineAttachmentPayload(file);
      setLocalAccounts((current) =>
        current.map((account) =>
          account.id === selectedAccount.id
            ? {
                ...account,
                photoUrl: payload.url,
              }
            : account,
        ),
      );
      setFeedback(`Loaded ${selectedAccount.fullName}'s new profile photo. Save it to publish across the staff view.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not load that profile photo right now.");
    }
  }

  async function saveSelectedAccountPhoto() {
    if (!selectedAccount) {
      return;
    }

    setBusyAccountId(selectedAccount.id);

    try {
      const response = await fetch(`/api/staff-accounts/${encodeURIComponent(selectedAccount.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoUrl: selectedAccount.photoUrl ?? "",
        }),
      });
      const payload = (await response.json()) as { error?: string; account?: StaffAccount };

      if (!response.ok || !payload.account) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalAccounts((current) =>
        current.map((account) => (account.id === payload.account?.id ? payload.account : account)),
      );
      setFeedback(`${payload.account.fullName}'s profile photo is now live across the staff dashboard.`);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save the staff profile photo right now.");
    } finally {
      setBusyAccountId(null);
    }
  }

  return (
    <section className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Staff Accounts</p>
          <h3>School-admin, teacher, and registrar control</h3>
        </div>
      </div>
      {canManage ? (
        <div className="callout-banner">
          <strong>{feedback}</strong>
          <p className="muted">
            Upload a teacher or staff passport here and the saved image will also appear in the dashboard sidebar for that account.
          </p>
        </div>
      ) : null}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Role</th>
              <th>Status</th>
              <th>Registered By</th>
              <th>Arms</th>
              <th>Subjects</th>
              <th>Scope</th>
            </tr>
          </thead>
          <tbody>
            {localAccounts.map((account) => (
              <tr key={account.id}>
                <td>
                  <div className="table-person-cell">
                    <span className={account.photoUrl ? "table-avatar image" : "table-avatar"}>
                      {account.photoUrl ? (
                        <img src={account.photoUrl} alt={`${account.fullName} profile`} className="table-avatar-image" />
                      ) : (
                        buildInitials(account.fullName) || "S"
                      )}
                    </span>
                    <div>
                      <strong>{account.fullName}</strong>
                      <p className="muted">{account.email}</p>
                    </div>
                  </div>
                </td>
                <td>{ROLE_LABEL[account.role]}</td>
                <td>
                  <span
                    className={`status-pill status-${
                      account.status === "active"
                        ? "approved"
                        : account.status === "disabled"
                          ? "locked"
                          : "submitted"
                    }`}
                  >
                    {resultStatusLabel(account.status)}
                  </span>
                </td>
                <td>{account.registeredBy}</td>
                <td>{account.assignedArms.join(", ") || "-"}</td>
                <td>{account.assignedSubjects.join(", ") || "-"}</td>
                <td>
                  {account.classTeacherArms.length > 0
                    ? `Teacher account with class responsibility for ${account.classTeacherArms.join(", ")}`
                    : "Teacher or operational scope without class responsibility"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canManage && selectedAccount ? (
        <div className="profile-media-workbench">
          <div className="profile-media-panel">
            <label>
              <span>Choose staff account</span>
              <select value={selectedAccount.id} onChange={(event) => setSelectedAccountId(event.target.value)}>
                {localAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.fullName} ({ROLE_LABEL[account.role]})
                  </option>
                ))}
              </select>
            </label>
            <div className="stack-list compact">
              <div className="comparison-card">
                <span>Current role</span>
                <strong>{ROLE_LABEL[selectedAccount.role]}</strong>
              </div>
              <div className="comparison-card">
                <span>Class responsibility</span>
                <strong>{selectedAccount.classTeacherArms.join(", ") || "No class assigned yet"}</strong>
              </div>
              <div className="comparison-card">
                <span>Subject scope</span>
                <strong>{selectedAccount.assignedSubjects.join(", ") || "No subject assigned yet"}</strong>
              </div>
            </div>
          </div>

          <div className="profile-media-panel">
            <div className={selectedAccount.photoUrl ? "profile-photo-preview image" : "profile-photo-preview"}>
              {selectedAccount.photoUrl ? (
                <img src={selectedAccount.photoUrl} alt={`${selectedAccount.fullName} profile`} className="profile-photo-image" />
              ) : (
                <span>{buildInitials(selectedAccount.fullName) || "S"}</span>
              )}
            </div>
            <p className="muted profile-photo-caption">
              This photo will be shown for {selectedAccount.fullName} anywhere the staff profile badge appears.
            </p>
            <label>
              <span>Upload staff photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void loadProfilePhoto(event.target.files?.[0] ?? null)}
                disabled={busyAccountId === selectedAccount.id}
              />
            </label>
            <div className="button-row">
              <button
                type="button"
                className="primary-button"
                disabled={busyAccountId === selectedAccount.id}
                onClick={() => void saveSelectedAccountPhoto()}
              >
                {busyAccountId === selectedAccount.id ? "Saving..." : "Save profile photo"}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busyAccountId === selectedAccount.id}
                onClick={() => {
                  setLocalAccounts((current) =>
                    current.map((account) =>
                      account.id === selectedAccount.id
                        ? {
                            ...account,
                            photoUrl: undefined,
                          }
                        : account,
                    ),
                  );
                  setFeedback(`Removed ${selectedAccount.fullName}'s profile photo locally. Save to publish the change.`);
                }}
              >
                Remove photo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function RegistrarCredentialsPanel({
  credentials,
}: {
  credentials: StudentPortalCredential[];
}) {
  return (
    <article className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Registrar Desk</p>
          <h3>Student login generation</h3>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Username</th>
              <th>Temporary Password</th>
              <th>Status</th>
              <th>Access Pack Details</th>
            </tr>
          </thead>
          <tbody>
            {credentials.map((credential) => (
              <tr key={credential.id}>
                <td>
                  <strong>{credential.studentName}</strong>
                  <p className="muted">{credential.regNumber}</p>
                </td>
                <td>{credential.username}</td>
                <td>{credential.temporaryPassword}</td>
                <td>
                  <span
                    className={`status-pill status-${
                      credential.status === "ready"
                        ? "submitted"
                        : credential.status === "sent"
                          ? "approved"
                          : "corrections_requested"
                    }`}
                  >
                    {credential.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td>
                  <details className="table-disclosure">
                    <summary className="table-disclosure-summary">View login and coupon details</summary>
                    <div className="disclosure-grid">
                      <div className="key-value-grid">
                        <div className="key-value-card">
                          <span>Username</span>
                          <strong>{credential.username}</strong>
                        </div>
                        <div className="key-value-card">
                          <span>Temporary password</span>
                          <strong>{credential.temporaryPassword}</strong>
                        </div>
                        <div className="key-value-card">
                          <span>Coupon code</span>
                          <strong>{credential.couponCode || "Not issued yet"}</strong>
                        </div>
                        <div className="key-value-card">
                          <span>Generated by</span>
                          <strong>{credential.generatedBy}</strong>
                        </div>
                      </div>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function ScopeGuardrailsPanel({
  school,
  accounts,
}: {
  school: SchoolProfile;
  accounts: StaffAccount[];
}) {
  const principalAccount = accounts.find((account) => isSchoolAdminRole(account.role));

  return (
    <article className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Scope Guardrails</p>
          <h3>Access is limited by role assignment</h3>
        </div>
      </div>
      <div className="stack-list">
        <div className="flow-step">
          <strong>Teacher restriction</strong>
          <p>Teachers can only see and edit the subject-class arms assigned to their own account.</p>
        </div>
        <div className="flow-step">
          <strong>Class responsibility support</strong>
          <p>
            A teacher account can also be attached to a class arm for attendance, class comments,
            and broadsheet follow-up without changing the human role itself.
          </p>
        </div>
        <div className="flow-step">
          <strong>Assignment lifecycle</strong>
          <p>
            School admin can assign or unassign subject slots and class responsibility at any time without
            sharing logins.
          </p>
        </div>
        <div className="flow-step">
          <strong>Result lock restriction</strong>
          <p>
            When a class is locked for the term, teachers cannot edit scores again until the class
            is reopened.
          </p>
        </div>
        {principalAccount ? (
          <div className="flow-step">
            <strong>Admin escalation</strong>
            <p>
              Super admin can disable the school-admin account for {school.name}, while the school admin
              can disable teacher accounts inside the school.
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
