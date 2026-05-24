import { redirect } from "next/navigation";

import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { roleHomeFor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [session, account] = await Promise.all([getCurrentStaffSession(), getCurrentStaffAccount()]);

  if (session && account?.status === "active") {
    if (account.mustChangePassword || session.passwordResetRequired) {
      redirect("/change-password");
    }

    redirect(roleHomeFor(account.role));
  }

  if (session) {
    redirect("/auth/reset-session?next=/login");
  }

  redirect("/login");
}
