import { isSchoolAdminRole } from "@/lib/auth";
import { listAssignmentsForTeacherAccount } from "@/lib/subject-teacher-assignments-store";
import type { StaffAccount } from "@/lib/types";

export function canManageStudentRecords(account: Pick<StaffAccount, "role" | "canRegisterStudents">) {
  return (
    account.role === "super_admin" ||
    isSchoolAdminRole(account.role) ||
    account.role === "registrar" ||
    Boolean(account.canRegisterStudents)
  );
}

export function canManageAttendancePolicy(account: Pick<StaffAccount, "role">) {
  return account.role === "super_admin" || isSchoolAdminRole(account.role);
}

export function canDecideStudentAbsenceRequests(
  account: Pick<StaffAccount, "role" | "canRegisterStudents">,
) {
  return canManageStudentRecords(account);
}

function hasWholeSchoolStudentSupportScope(account: Pick<StaffAccount, "role">) {
  return (
    account.role === "super_admin" ||
    isSchoolAdminRole(account.role) ||
    account.role === "registrar" ||
    account.role === "hod" ||
    account.role === "manager"
  );
}

export async function canWriteStudentReportForClass(
  account: Pick<StaffAccount, "id" | "role" | "classTeacherArms">,
  className: string,
) {
  if (hasWholeSchoolStudentSupportScope(account)) {
    return true;
  }

  if (account.classTeacherArms.includes(className)) {
    return true;
  }

  const assignments = await listAssignmentsForTeacherAccount(account.id);
  return assignments.some((assignment) => assignment.className === className);
}

export function canPublishStudentResultComment(
  account: Pick<StaffAccount, "role" | "classTeacherArms">,
  className: string,
) {
  return hasWholeSchoolStudentSupportScope(account) || account.classTeacherArms.includes(className);
}

export function canMarkClassAttendance(
  account: Pick<StaffAccount, "role" | "classTeacherArms">,
  className: string,
) {
  return hasWholeSchoolStudentSupportScope(account) || account.classTeacherArms.includes(className);
}
