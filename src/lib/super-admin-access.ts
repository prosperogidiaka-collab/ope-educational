import { NextResponse } from "next/server";

import { isPlatformSuperAdmin } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";

export async function requirePlatformSuperAdmin() {
  const [session, account] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
  ]);

  if (!session || !account || account.status !== "active") {
    return {
      error: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  if (!isPlatformSuperAdmin(account)) {
    return {
      error: NextResponse.json({ error: "Only the platform super admin can use this endpoint." }, { status: 403 }),
    };
  }

  return { account };
}
