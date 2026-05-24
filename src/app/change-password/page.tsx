import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/change-password-form";
import { readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { roleHomeFor } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const [session, account, school] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readRuntimeSchoolProfile(),
  ]);

  if (!session) {
    redirect("/login");
  }

  if (!account || account.status !== "active") {
    redirect("/auth/reset-session?next=/login");
  }

  if (!account.mustChangePassword && !session.passwordResetRequired) {
    redirect(roleHomeFor(account.role));
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
            <p className="eyebrow">Password Update</p>
            <h1>Change temporary password</h1>
            <p className="muted auth-copy">
              This school-admin account was created with a temporary password. Set a private password before entering the dashboard.
            </p>
          </div>
        </div>
        <div className="auth-note-card">
          <strong>Next step</strong>
          <p className="muted">
            After this update, you will continue directly to your assigned workspace.
          </p>
        </div>
        <ChangePasswordForm
          accountName={account.fullName}
          accountEmail={account.email}
        />
        <p className="muted auth-portal-note">
          Need to stop here?
          <Link href="/auth/reset-session?next=/login" className="inline-link">
            Sign out
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
