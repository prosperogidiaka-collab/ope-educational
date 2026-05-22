"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { readPlatformSettings } from "@/lib/platform-settings-store";
import {
  StudentPortalSession,
  STUDENT_PORTAL_SESSION_COOKIE,
} from "@/lib/student-portal-auth";
import { getStudentProfile } from "@/lib/student-profiles-store";
import {
  getStudentPortalCredentialByUsername,
  saveStudentPortalCredential,
} from "@/lib/student-portal-credentials-store";

export interface StudentPortalLoginState {
  error?: string;
}

export async function studentPortalLoginAction(
  _prev: StudentPortalLoginState,
  formData: FormData,
): Promise<StudentPortalLoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Enter the username and password." };
  }

  const platformSettings = await readPlatformSettings();

  if (platformSettings.maintenanceMode || !platformSettings.allowPortalAccess) {
    return {
      error: platformSettings.ownerBroadcast || "The student portal is currently unavailable.",
    };
  }

  const credential = await getStudentPortalCredentialByUsername(username);

  if (!credential) {
    return { error: "That username was not found." };
  }

  if (credential.accountState !== "active") {
    return { error: credential.disabledReason || "This student account has been deactivated by the school." };
  }

  if (credential.status === "reset_required") {
    return { error: "This student account needs a registrar reset before it can sign in again." };
  }

  if (credential.temporaryPassword !== password) {
    return { error: "The password is incorrect. Contact the registrar if a reset is needed." };
  }

  const profile = await getStudentProfile(credential.regNumber);

  if (!profile) {
    return { error: "The student profile linked to this login could not be found." };
  }

  if (profile.studentStatus !== "active") {
    return {
      error: `This student record is marked as ${profile.studentStatus}. Contact the school if access should be restored.`,
    };
  }

  const updatedCredential = {
    ...credential,
    lastLoginAt: new Date().toISOString(),
  };
  await saveStudentPortalCredential(updatedCredential);

  const session: StudentPortalSession = {
    regNumber: credential.regNumber,
    username: credential.username,
    schoolCode: credential.schoolCode,
    studentName: profile.fullName,
  };
  const store = await cookies();
  store.set(STUDENT_PORTAL_SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect(`/portal/student/${encodeURIComponent(credential.regNumber)}`);
}

export async function studentPortalLogoutAction() {
  const store = await cookies();
  store.delete(STUDENT_PORTAL_SESSION_COOKIE);
  redirect("/portal");
}
