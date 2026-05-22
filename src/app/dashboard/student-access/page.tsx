import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { CouponManager } from "@/components/coupon-manager";
import { RegistrarCredentialsPanel } from "@/components/governance-panels";
import { MetricCard } from "@/components/metric-card";
import { isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { couponInventory, school } from "@/lib/demo-data";
import { getLiveResults } from "@/lib/live-results";
import { readVisibleStudentPortalCredentials } from "@/lib/student-portal-credentials-store";

export const dynamic = "force-dynamic";

export default async function StudentAccessPage() {
  const [account, { summaries: studentSummaries }] = await Promise.all([
    getCurrentStaffAccount(),
    getLiveResults(),
  ]);
  const studentPortalCredentials = await readVisibleStudentPortalCredentials(account);
  const readyCredentials = studentPortalCredentials.filter((credential) => credential.status === "ready").length;
  const sentCredentials = studentPortalCredentials.filter((credential) => credential.status === "sent").length;
  const resetRequired = studentPortalCredentials.filter((credential) => credential.status === "reset_required").length;
  const activeCoupons = couponInventory.filter((coupon) => coupon.active).length;
  const canManageCoupons = account?.role ? isSchoolAdminRole(account.role) : false;

  return (
    <AppShell
      activeHref="/dashboard/student-access"
      eyebrow="Student Access"
      title={`${school.shortName} portal access desk`}
      description="Keep student login credentials under registrar control, while coupon intervention stays restricted to the school admin."
    >
      <section className="metric-grid compact">
        <MetricCard label="Credentials ready" value={`${readyCredentials}`} helper="Generated and waiting to be shared" />
        <MetricCard label="Credentials sent" value={`${sentCredentials}`} helper="Already issued to parents or students" />
        <MetricCard label="Reset required" value={`${resetRequired}`} helper="Needs a new temporary login" />
        <MetricCard label="Active coupons" value={`${activeCoupons}`} helper="Current term result coupons still usable" />
      </section>

      <section className="grid-layout two-wide">
        <RegistrarCredentialsPanel credentials={studentPortalCredentials} />

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Portal Policy</p>
              <h3>What belongs in student access control</h3>
            </div>
          </div>
          <div className="stack-list">
            <div className="flow-step">
              <strong>Username and password issuance</strong>
              <p>Registrar should generate, resend, reset, and archive student logins from this menu.</p>
            </div>
            <div className="flow-step">
              <strong>Coupon governance</strong>
              <p>School admin should revoke suspicious access, reissue codes, and watch failed attempts here.</p>
            </div>
            <div className="flow-step">
              <strong>Publication dependency</strong>
              <p>Students can sign in at the portal any time their account is active, but results only appear after publication, clearance, and release checks are completed.</p>
            </div>
          </div>
          <div className="button-row">
            <Link href="/portal" className="secondary-button">
              Open student sign-in
            </Link>
          </div>
        </article>
      </section>

      <CouponManager coupons={couponInventory} students={studentSummaries} canManage={canManageCoupons} />
    </AppShell>
  );
}
