import "server-only";

import { cookies } from "next/headers";

import {
  parseStudentPortalSession,
  STUDENT_PORTAL_SESSION_COOKIE,
} from "@/lib/student-portal-auth";
import { getStudentPortalCredentialByRegNumber } from "@/lib/student-portal-credentials-store";

export async function getCurrentStudentPortalSession() {
  const store = await cookies();
  return parseStudentPortalSession(store.get(STUDENT_PORTAL_SESSION_COOKIE)?.value);
}

export async function getCurrentStudentPortalCredential() {
  const session = await getCurrentStudentPortalSession();

  if (!session) {
    return null;
  }

  return getStudentPortalCredentialByRegNumber(session.regNumber);
}
