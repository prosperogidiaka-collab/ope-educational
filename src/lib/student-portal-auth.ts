export const STUDENT_PORTAL_SESSION_COOKIE = "ope_student_session";

export interface StudentPortalSession {
  regNumber: string;
  username: string;
  schoolCode: string;
  studentName: string;
}

export function parseStudentPortalSession(raw: string | undefined): StudentPortalSession | null {
  if (!raw) {
    return null;
  }

  try {
    const value = JSON.parse(raw) as Partial<StudentPortalSession>;

    if (
      value &&
      typeof value.regNumber === "string" &&
      typeof value.username === "string" &&
      typeof value.schoolCode === "string" &&
      typeof value.studentName === "string"
    ) {
      return value as StudentPortalSession;
    }
  } catch {
    return null;
  }

  return null;
}
