import Link from "next/link";
import { redirect } from "next/navigation";

import { StaffLoginForm } from "@/components/staff-login-form";
import { readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { ROLE_LABEL, roleHomeFor } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { staffLoginCredentials } from "@/lib/demo-data";
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
    redirect(roleHomeFor(account.role));
  }

  if (session) {
    redirect("/auth/reset-session?next=/login");
  }

  return (
    <main className="auth-screen">
      <div className="auth-grid">
        <section className="surface-card auth-panel">
          <p className="eyebrow">Staff Sign In</p>
          <h1>{school.name}</h1>
          <p className="muted">
            One platform super admin follows up all schools from the back office, while each school works through its
            own school-admin and staff accounts. Sign in to open only the boards your role and school scope allow.
          </p>
          {platformSettings.maintenanceMode || platformSettings.ownerBroadcast ? (
            <div className={`callout-banner ${platformSettings.maintenanceMode ? "warning" : ""}`}>
              <strong>{platformSettings.maintenanceMode ? "Maintenance mode is active" : "Platform notice"}</strong>
              <p className="muted">{platformSettings.ownerBroadcast}</p>
            </div>
          ) : null}
          <div className="button-row" style={{ marginBottom: "1rem" }}>
            <Link href="/portal" className="secondary-button">
              Student sign in
            </Link>
          </div>
          <StaffLoginForm />
          <p className="muted auth-portal-note">
            Students and parents do not use staff accounts - they sign in on the{" "}
            <Link href="/portal" className="inline-link">
              student portal
            </Link>
            .
          </p>
        </section>

        <section className="surface-card auth-creds">
          <div className="section-head">
            <div>
              <p className="eyebrow">Demo Accounts</p>
              <h3>Sign in as any role</h3>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Password</th>
                  <th>What this account can do</th>
                </tr>
              </thead>
              <tbody>
                {staffLoginCredentials.map((account) => (
                  <tr key={account.email}>
                    <td>
                      <span className="status-pill status-locked">{ROLE_LABEL[account.role]}</span>
                    </td>
                    <td>{account.email}</td>
                    <td>{account.password}</td>
                    <td className="muted">{account.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
