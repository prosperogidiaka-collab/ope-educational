import "server-only";

import { cookies } from "next/headers";

import { parseSession, SESSION_COOKIE } from "@/lib/auth";
import { getStoredStaffAccountByEmail } from "@/lib/staff-accounts-store";

export async function getCurrentStaffSession() {
  const store = await cookies();
  return parseSession(store.get(SESSION_COOKIE)?.value);
}

export async function getCurrentStaffAccount() {
  const session = await getCurrentStaffSession();

  if (!session) {
    return null;
  }

  return getStoredStaffAccountByEmail(session.email);
}
