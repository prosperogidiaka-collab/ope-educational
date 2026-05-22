import { formatDate, resultStatusLabel } from "@/lib/calculations";
import type { TeacherPortalReportEntry } from "@/lib/types";

export function TeacherLeadershipReportsPanel({
  reports,
}: {
  reports: TeacherPortalReportEntry[];
}) {
  return (
    <section className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Leadership Reports</p>
          <h3>Notes logged about this teacher account</h3>
        </div>
        <span className={`status-pill ${reports.length > 0 ? "status-approved" : "status-under_review"}`}>
          {reports.length} note{reports.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="timeline">
        {reports.length > 0 ? (
          reports.map((entry) => (
            <article key={entry.id} className="timeline-item">
              <strong>{entry.title}</strong>
              <p>{entry.body}</p>
              <span>
                {resultStatusLabel(entry.category)} - {entry.authorName} - {formatDate(entry.updatedAt)}
              </span>
              {entry.attachmentLabel && entry.attachmentUrl ? (
                <p className="muted">
                  <a href={entry.attachmentUrl} download={entry.attachmentLabel} className="inline-link">
                    Open attachment: {entry.attachmentLabel}
                  </a>
                </p>
              ) : null}
            </article>
          ))
        ) : (
          <div className="flow-step">
            <strong>No leadership note has been logged for this account yet.</strong>
            <p>Teacher reports saved by the registrar, principal, or school admin will appear here.</p>
          </div>
        )}
      </div>
    </section>
  );
}
