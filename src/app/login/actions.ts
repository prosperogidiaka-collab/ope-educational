"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, roleHomeFor, type StaffSession } from "@/lib/auth";
import { readPlatformSettings } from "@/lib/platform-settings-store";
import { getStoredStaffAccountByEmail } from "@/lib/staff-accounts-store";

export interface LoginState {
  error?: string;
}

async function writeStaffSession(session: StaffSession) {
  const store = await cookies();
  store.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your work email and password." };
  }

  const match = await getStoredStaffAccountByEmail(email);

  if (!match || match.password !== password) {
    return { error: "That email and password do not match any staff account." };
  }

  const platformSettings = await readPlatformSettings();

  if (platformSettings.maintenanceMode && match.role !== "super_admin") {
    return {
      error:
        platformSettings.ownerBroadcast ||
        "Maintenance mode is active. Only the platform super admin can sign in until the app is reopened.",
    };
  }

  if (match.status !== "active") {
    return { error: "This account is currently disabled. Ask the school admin or super admin to reopen it." };
  }

  const session: StaffSession = {
    accountId: match.id,
    email: match.email,
    name: match.fullName,
    role: match.role,
    schoolCode: match.schoolCode,
    passwordResetRequired: Boolean(match.mustChangePassword),
  };
  await writeStaffSession(session);

  if (match.mustChangePassword) {
    redirect("/change-password");
  }

  redirect(roleHomeFor(match.role));
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
