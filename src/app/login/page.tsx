import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StaffLoginForm } from "@/components/staff-login-form";
import { readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { roleHomeFor } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { readPlatformSettings } from "@/lib/platform-settings-store";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [session, account, platformSettings, school] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readPlatformSettings(),
    readRuntimeSchoolProfile(),
  ]);

  if (session && account?.status === "active") {
    if (account.mustChangePassword || session.passwordResetRequired) {
      redirect("/change-password");
    }

    redirect(roleHomeFor(account.role));
  }

  if (session) {
    redirect("/auth/reset-session?next=/login");
  }

  return (
    <main className="auth-screen">
      <section className="surface-card auth-card">
        <div className="auth-brand">
          <div className="brand-mark image-brand-mark auth-brand-mark">
            <Image
              src={school.logoUrl}
              alt={`${school.name} logo`}
              className="brand-image"
              width={72}
              height={72}
            />
          </div>
          <div>
            <p className="eyebrow">Staff Sign In</p>
            <h1>{school.name}</h1>
            <p className="muted auth-copy">
              Sign in with your assigned staff account to continue to your school workspace.
            </p>
          </div>
        </div>
        {platformSettings.maintenanceMode || platformSettings.ownerBroadcast ? (
          <div className={`callout-banner ${platformSettings.maintenanceMode ? "warning" : ""}`}>
            <strong>{platformSettings.maintenanceMode ? "Maintenance mode is active" : "Platform notice"}</strong>
            <p className="muted">{platformSettings.ownerBroadcast}</p>
          </div>
        ) : null}
        <div className="auth-actions">
          <Link href="/portal" className="secondary-button">
            Student sign in
          </Link>
        </div>
        <StaffLoginForm />
        <p className="muted auth-portal-note">
          Students and parents do not use staff accounts. They sign in through the
          <Link href="/portal" className="inline-link">
            student portal
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
