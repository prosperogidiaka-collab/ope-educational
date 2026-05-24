"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, roleHomeFor, type StaffSession } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { saveStoredStaffAccount } from "@/lib/staff-accounts-store";

export interface ChangePasswordState {
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

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const [session, account] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
  ]);

  if (!session || !account) {
    redirect("/login");
  }

  if (account.status !== "active") {
    redirect("/auth/reset-session?next=/login");
  }

  if (!account.mustChangePassword && !session.passwordResetRequired) {
    redirect(roleHomeFor(account.role));
  }

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Enter the temporary password, a new password, and the confirmation." };
  }

  if (account.password !== currentPassword) {
    return { error: "The temporary password is incorrect." };
  }

  if (newPassword.length < 8) {
    return { error: "Use at least 8 characters for the new password." };
  }

  if (newPassword === currentPassword) {
    return { error: "Choose a new password that is different from the temporary password." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "The new password and confirmation do not match." };
  }

  const updatedAccount = await saveStoredStaffAccount({
    ...account,
    password: newPassword,
    mustChangePassword: false,
    lastAction: `Changed temporary password on ${new Date().toISOString()}.`,
  });
  await writeStaffSession({
    accountId: updatedAccount.id,
    email: updatedAccount.email,
    name: updatedAccount.fullName,
    role: updatedAccount.role,
    schoolCode: updatedAccount.schoolCode,
    passwordResetRequired: false,
  });

  redirect(roleHomeFor(updatedAccount.role));
}
