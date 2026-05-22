import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { ReportCard } from "@/components/report-card";
import { parseSession, SESSION_COOKIE } from "@/lib/auth";
import { isExpired } from "@/lib/calculations";
import { gradeScale } from "@/lib/demo-data";
import { getLiveResults } from "@/lib/live-results";
import { readPlatformSettings } from "@/lib/platform-settings-store";
import { getReportSheetOverride } from "@/lib/report-sheet-store";
import { getStudentProfile } from "@/lib/student-profiles-store";
import {
  parseStudentPortalSession,
  STUDENT_PORTAL_SESSION_COOKIE,
} from "@/lib/student-portal-auth";
import { getStudentPortalCredentialByRegNumber } from "@/lib/student-portal-credentials-store";
import { readTemplateWorkspace } from "@/lib/template-workspace-store";

export const dynamic = "force-dynamic";

interface ResultPageProps {
  params: Promise<{
    regNumber: string;
  }>;
  searchParams?: Promise<{
    coupon?: string | string[];
    preview?: string | string[];
  }>;
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function ResultPage({ params, searchParams }: ResultPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const regNumber = decodeURIComponent(resolvedParams.regNumber);
  const [liveResults, platformSettings, studentProfile, studentCredential] = await Promise.all([
    getLiveResults(),
    readPlatformSettings(),
    getStudentProfile(regNumber),
    getStudentPortalCredentialByRegNumber(regNumber),
  ]);
  const { academicConfig, school, summaries } = liveResults;
  const summary = summaries.find((item) => item.bundle.student.regNumber === regNumber);

  if (!summary) {
    notFound();
  }

  const requestedPreview = firstParam(resolvedSearchParams?.preview) === "1";
  const cookieStore = await cookies();
  const staffSession = parseSession(cookieStore.get(SESSION_COOKIE)?.value);
  const studentPortalSession = parseStudentPortalSession(
    cookieStore.get(STUDENT_PORTAL_SESSION_COOKIE)?.value,
  );
  // Preview (no-coupon view of an unreleased result) is only for signed-in staff.
  const isPreview = requestedPreview && Boolean(staffSession);
  const portalBlocked = platformSettings.maintenanceMode || !platformSettings.allowPortalAccess;
  const coupon = firstParam(resolvedSearchParams?.coupon);
  const matchesCoupon = coupon.toUpperCase() === summary.bundle.coupon.code.toUpperCase();
  const studentSessionMatches = studentPortalSession?.regNumber === regNumber;
  const studentSessionAllowed =
    studentSessionMatches &&
    studentProfile?.studentStatus === "active" &&
    studentCredential?.accountState === "active";
  const available =
    !portalBlocked &&
    (matchesCoupon || studentSessionAllowed) &&
    summary.bundle.coupon.active &&
    summary.bundle.publishedAt &&
    !summary.bundle.clearances.some((item) => item.status === "blocked") &&
    ["locked", "published"].includes(summary.bundle.status) &&
    !isExpired(summary.bundle.coupon.expiresAt) &&
    summary.bundle.coupon.usedViews < summary.bundle.coupon.maxViews;

  if (!available && !isPreview) {
    return (
      <main className="access-page">
        <section className="surface-card access-card">
          <p className="eyebrow">Protected Result</p>
          <h1>Access denied</h1>
          <p className="muted">
            {portalBlocked
              ? platformSettings.ownerBroadcast || "Portal access is currently unavailable."
              : "This result requires the correct coupon code and must already be school-admin-approved, cleared, and released for the portal."}
          </p>
          <Link href="/portal" className="primary-button">
            Return to portal
          </Link>
        </section>
      </main>
    );
  }

  const overrideDraft = await getReportSheetOverride(summary.bundle.student.regNumber);
  const templateWorkspace = await readTemplateWorkspace();

  return (
    <main className="report-page">
      {isPreview && !available ? (
        <div className="callout-banner warning no-print preview-banner">
          <strong>Preview only — this result is not yet released.</strong>
          <p className="muted">
            This is exactly how {summary.bundle.student.fullName}&apos;s report will appear once it is published and opened with the result token.
            <Link href="/dashboard/score-review" className="inline-link">Back to Score Review</Link>
          </p>
        </div>
      ) : null}
      <ReportCard
        school={school}
        summary={summary}
        overrideDraft={overrideDraft}
        templateSchema={templateWorkspace.liveSchema}
        classSize={summaries.length}
        gradeBands={gradeScale}
        academicConfig={academicConfig}
      />
    </main>
  );
}
