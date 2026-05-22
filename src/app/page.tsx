import { redirect } from "next/navigation";

import { roleHomeFor } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [session, account] = await Promise.all([getCurrentStaffSession(), getCurrentStaffAccount()]);

  if (session && account?.status === "active") {
    redirect(roleHomeFor(account.role));
  }

  if (session) {
    redirect("/auth/reset-session?next=/login");
  }

  redirect("/login");
}
