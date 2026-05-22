import Link from "next/link";
import { redirect } from "next/navigation";

import { ResultCheckForm } from "@/components/result-check-form";
import { readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { portalNotice } from "@/lib/demo-data";
import { readPlatformSettings } from "@/lib/platform-settings-store";
import { getCurrentStudentPortalSession } from "@/lib/student-portal-auth-server";
import { readStudentPortalCredentials } from "@/lib/student-portal-credentials-store";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const [platformSettings, studentSession, credentials, school] = await Promise.all([
    readPlatformSettings(),
    getCurrentStudentPortalSession(),
    readStudentPortalCredentials(),
    readRuntimeSchoolProfile(),
  ]);
  const portalBlocked = platformSettings.maintenanceMode || !platformSettings.allowPortalAccess;

  if (studentSession) {
    redirect(`/portal/student/${encodeURIComponent(studentSession.regNumber)}`);
  }

  return (
    <main className="public-page">
      <header className="public-header">
        <div className="public-brand">
          <div className="brand-mark image-brand-mark">
            <img src={school.logoUrl} alt={`${school.name} logo`} className="brand-image" />
          </div>
          <div>
            <p className="eyebrow">Student Portal</p>
            <h1>{school.name}</h1>
            <p className="muted">Student account access</p>
          </div>
        </div>
        <Link href="/login" className="secondary-button">
          Staff sign in
        </Link>
      </header>

      <div className="public-body">
        {portalBlocked ? (
          <section className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Portal Access Paused</p>
                <h3>Student portal is currently unavailable</h3>
              </div>
            </div>
            <div className="stack-list">
              <div className="flow-step">
                <strong>
                  {platformSettings.maintenanceMode
                    ? "Maintenance mode is active."
                    : "Portal access has been disabled by the platform super admin."}
                </strong>
                <p>{platformSettings.ownerBroadcast}</p>
              </div>
              <div className="flow-step">
                <strong>Support contact</strong>
                <p>{platformSettings.supportEmail}</p>
              </div>
            </div>
          </section>
        ) : (
          <ResultCheckForm credentials={credentials} />
        )}

        <section className="callout-banner">
          <strong>Portal announcement</strong>
          <p className="muted">
            {portalBlocked ? platformSettings.ownerBroadcast : portalNotice}
          </p>
        </section>

        <section className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Portal Rules</p>
              <h3>Secure access policy</h3>
            </div>
          </div>
          <div className="stack-list">
            <div className="flow-step">
              <strong>Student login</strong>
              <p>The registrar creates student usernames and temporary passwords. No separate school code is required at sign-in.</p>
            </div>
            <div className="flow-step">
              <strong>What students can see</strong>
              <p>Each student account opens biodata, teacher reports, attendance, and the latest released result for that student only.</p>
            </div>
            <div className="flow-step">
              <strong>Result release control</strong>
              <p>Only school-admin-approved, cleared, and locked result sheets appear after sign in.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
