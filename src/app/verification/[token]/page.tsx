import Link from "next/link";
import { notFound } from "next/navigation";

import { readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { formatDateOnly, resultStatusLabel } from "@/lib/calculations";
import { verificationRecords } from "@/lib/demo-data";

interface VerificationPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function VerificationPage({ params }: VerificationPageProps) {
  const resolvedParams = await params;
  const token = decodeURIComponent(resolvedParams.token);
  const record = verificationRecords.find((item) => item.verificationId === token);
  const school = await readRuntimeSchoolProfile();

  if (!record) {
    notFound();
  }

  const isAuthentic = Boolean(record.publishedAt && ["locked", "published"].includes(record.status));

  return (
    <main className="access-page">
      <section className="surface-card access-card">
        <p className="eyebrow">Verification Center</p>
        <h1>{school.name}</h1>
        <p className="muted">
          Verification ID: <strong>{record.verificationId}</strong>
        </p>
        <span className={`status-pill status-${isAuthentic ? "approved" : "corrections_requested"}`}>
          {isAuthentic ? "Authentic published result" : "Not valid for release"}
        </span>
        <div className="stack-list compact">
          <div className="comparison-card">
            <span>Student</span>
            <strong>{record.studentName}</strong>
          </div>
          <div className="comparison-card">
            <span>Reg number</span>
            <strong>{record.regNumber}</strong>
          </div>
          <div className="comparison-card">
            <span>Class</span>
            <strong>{record.className}</strong>
          </div>
          <div className="comparison-card">
            <span>Status</span>
            <strong>{resultStatusLabel(record.status)}</strong>
          </div>
          <div className="comparison-card">
            <span>Session / Term</span>
            <strong>
              {record.session} - {record.term}
            </strong>
          </div>
          <div className="comparison-card">
            <span>Published</span>
            <strong>{record.publishedAt ? formatDateOnly(record.publishedAt) : "Not published"}</strong>
          </div>
        </div>
        <Link href="/portal" className="primary-button">
          Return to result portal
        </Link>
      </section>
    </main>
  );
}
