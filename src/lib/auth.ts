import type { StaffAccount, UserRole } from "@/lib/types";

export const SESSION_COOKIE = "ope_session";
export const PLATFORM_SCHOOL_CODE = "PLATFORM";

export interface StaffSession {
  accountId?: string;
  email: string;
  name: string;
  role: UserRole;
  schoolCode?: string;
}

export function isSchoolAdminRole(role: UserRole) {
  return role === "school_admin" || role === "principal";
}

/** Pages each role is allowed to open (by the `activeHref` the page passes to AppShell). */
export const ROLE_ACCESS: Record<UserRole, string[]> = {
  super_admin: ["/dashboard", "/dashboard/super-admin"],
  school_admin: [
    "/dashboard",
    "/dashboard/school-admin",
    "/dashboard/principal",
    "/dashboard/academic",
    "/dashboard/teacher",
    "/dashboard/teacher/assignments",
    "/dashboard/teacher/students",
    "/dashboard/teacher/attendance",
    "/dashboard/teacher/leadership",
    "/dashboard/score-review",
    "/dashboard/review",
    "/dashboard/broadsheet",
    "/dashboard/audit",
    "/dashboard/principal",
    "/dashboard/result-locks",
    "/dashboard/report-editor",
    "/dashboard/score-overrides",
    "/dashboard/templates",
    "/dashboard/session-rollover",
    "/dashboard/approval-matrix",
    "/dashboard/archive-transcripts",
    "/dashboard/result-complaints",
    "/dashboard/audit-export",
    "/dashboard/teacher-assignments",
    "/dashboard/staff-accounts",
    "/dashboard/student-access",
    "/dashboard/timetable",
    "/dashboard/student-affairs",
    "/dashboard/student-affairs/student-info",
    "/dashboard/student-affairs/student-accounts",
    "/dashboard/student-affairs/reports",
    "/dashboard/student-affairs/attendance",
    "/dashboard/school-logs",
    "/dashboard/class-arms",
    "/dashboard/subject-registration",
    "/dashboard/import-export",
  ],
  principal: [
    "/dashboard",
    "/dashboard/school-admin",
    "/dashboard/principal",
    "/dashboard/academic",
    "/dashboard/teacher",
    "/dashboard/teacher/assignments",
    "/dashboard/teacher/students",
    "/dashboard/teacher/attendance",
    "/dashboard/teacher/leadership",
    "/dashboard/score-review",
    "/dashboard/review",
    "/dashboard/broadsheet",
    "/dashboard/audit",
    "/dashboard/result-locks",
    "/dashboard/report-editor",
    "/dashboard/score-overrides",
    "/dashboard/templates",
    "/dashboard/session-rollover",
    "/dashboard/approval-matrix",
    "/dashboard/archive-transcripts",
    "/dashboard/result-complaints",
    "/dashboard/audit-export",
    "/dashboard/teacher-assignments",
    "/dashboard/staff-accounts",
    "/dashboard/student-access",
    "/dashboard/timetable",
    "/dashboard/student-affairs",
    "/dashboard/student-affairs/student-info",
    "/dashboard/student-affairs/student-accounts",
    "/dashboard/student-affairs/reports",
    "/dashboard/student-affairs/attendance",
    "/dashboard/school-logs",
    "/dashboard/class-arms",
    "/dashboard/subject-registration",
    "/dashboard/import-export",
  ],
  hod: [
    "/dashboard",
    "/dashboard/teacher",
    "/dashboard/teacher/assignments",
    "/dashboard/teacher/students",
    "/dashboard/teacher/leadership",
    "/dashboard/score-review",
    "/dashboard/review",
    "/dashboard/broadsheet",
    "/dashboard/audit",
    "/dashboard/timetable",
  ],
  class_teacher: [
    "/dashboard/teacher",
    "/dashboard/teacher/assignments",
    "/dashboard/teacher/students",
    "/dashboard/teacher/attendance",
    "/dashboard/teacher/leadership",
    "/dashboard/broadsheet",
    "/dashboard/timetable",
  ],
  teacher: [
    "/dashboard/teacher",
    "/dashboard/teacher/assignments",
    "/dashboard/teacher/students",
    "/dashboard/teacher/leadership",
    "/dashboard/timetable",
  ],
  bursar: ["/dashboard", "/dashboard/score-review", "/dashboard/review", "/dashboard/broadsheet"],
  manager: ["/dashboard", "/dashboard/score-review", "/dashboard/review", "/dashboard/broadsheet", "/dashboard/audit"],
  registrar: [
    "/dashboard/archive-transcripts",
    "/dashboard/student-access",
    "/dashboard/timetable",
    "/dashboard/student-affairs",
    "/dashboard/student-affairs/student-info",
    "/dashboard/student-affairs/student-accounts",
    "/dashboard/student-affairs/reports",
    "/dashboard/student-affairs/attendance",
    "/dashboard/school-logs",
    "/dashboard/class-arms",
    "/dashboard/subject-registration",
  ],
  parent: [],
};

export const ROLE_HOME: Record<UserRole, string> = {
  super_admin: "/dashboard/super-admin",
  school_admin: "/dashboard/school-admin",
  principal: "/dashboard/school-admin",
  hod: "/dashboard",
  class_teacher: "/dashboard/teacher",
  teacher: "/dashboard/teacher",
  bursar: "/dashboard",
  manager: "/dashboard",
  registrar: "/dashboard/student-affairs",
  parent: "/portal",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super Admin",
  school_admin: "School Admin",
  principal: "Principal",
  hod: "Head of Department",
  class_teacher: "Teacher",
  teacher: "Teacher",
  bursar: "Bursar",
  manager: "Management",
  registrar: "Registrar",
  parent: "Parent / Guardian",
};

function normalizeRoute(href: string) {
  return href.split("#")[0]?.split("?")[0] ?? href;
}

export function canAccess(role: UserRole, href: string): boolean {
  const route = normalizeRoute(href);
  return (ROLE_ACCESS[role] ?? []).includes(route);
}

export function isPlatformSuperAdmin(account: Pick<StaffAccount, "role" | "schoolCode">) {
  return account.role === "super_admin" || account.schoolCode === PLATFORM_SCHOOL_CODE;
}

export function canAccessSchool(
  account: Pick<StaffAccount, "role" | "schoolCode" | "grantedSchoolCodes">,
  schoolCode: string,
): boolean {
  if (!schoolCode) {
    return false;
  }

  if (isPlatformSuperAdmin(account)) {
    return true;
  }

  const normalizedTarget = schoolCode.trim().toUpperCase();
  const normalizedOwnSchool = account.schoolCode.trim().toUpperCase();

  if (normalizedOwnSchool === normalizedTarget) {
    return true;
  }

  return (account.grantedSchoolCodes ?? []).some(
    (grantedSchoolCode) => grantedSchoolCode.trim().toUpperCase() === normalizedTarget,
  );
}

function hasTeacherGovernanceDuty(account: Pick<StaffAccount, "role" | "canRegisterTeachers" | "canDisableTeachers">) {
  return Boolean(account.canRegisterTeachers) || Boolean(account.canDisableTeachers);
}

function hasRegistrarGovernanceDuty(account: Pick<StaffAccount, "role" | "canRegisterStudents">) {
  return Boolean(account.canRegisterStudents);
}

function hasClassTeacherDuty(account: Pick<StaffAccount, "classTeacherArms">) {
  return account.classTeacherArms.length > 0;
}

export function canAccessAccount(
  account: Pick<StaffAccount, "role" | "canRegisterTeachers" | "canDisableTeachers" | "canRegisterStudents" | "classTeacherArms">,
  href: string,
) {
  const route = normalizeRoute(href);

  if (canAccess(account.role, route)) {
    return true;
  }

  if (
    (hasTeacherGovernanceDuty(account) || account.role === "registrar") &&
    ["/dashboard/teacher-assignments", "/dashboard/staff-accounts"].includes(route)
  ) {
    return true;
  }

  if (
    hasRegistrarGovernanceDuty(account) &&
    [
      "/dashboard/student-access",
      "/dashboard/student-affairs",
      "/dashboard/student-affairs/student-info",
      "/dashboard/student-affairs/student-accounts",
      "/dashboard/student-affairs/reports",
      "/dashboard/student-affairs/attendance",
      "/dashboard/school-logs",
      "/dashboard/class-arms",
      "/dashboard/subject-registration",
      "/dashboard/import-export",
    ].includes(route)
  ) {
    return true;
  }

  if (
    hasClassTeacherDuty(account) &&
    ["/dashboard/broadsheet", "/dashboard/teacher/attendance"].includes(route)
  ) {
    return true;
  }

  return false;
}

export function roleHomeFor(role: UserRole): string {
  return ROLE_HOME[role] ?? "/dashboard";
}

export function parseSession(raw: string | undefined): StaffSession | null {
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw) as Partial<StaffSession>;
    if (value && typeof value.email === "string" && typeof value.name === "string" && value.role) {
      return value as StaffSession;
    }
  } catch {
    return null;
  }
  return null;
}
