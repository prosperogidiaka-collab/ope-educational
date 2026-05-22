"use client";

import { useState } from "react";

import { formatDate, formatDateOnly, resultStatusLabel } from "@/lib/calculations";
import { buildInlineAttachmentPayload } from "@/lib/file-attachments";
import type { StudentAbsenceRequest, StudentLifecycleStatus } from "@/lib/types";

interface StudentPortalAbsencePanelProps {
  requests: StudentAbsenceRequest[];
  studentStatus: StudentLifecycleStatus;
}

export function StudentPortalAbsencePanel({
  requests,
  studentStatus,
}: StudentPortalAbsencePanelProps) {
  const [localRequests, setLocalRequests] = useState(requests);
  const [feedback, setFeedback] = useState(
    "Use this form to request an approved absence from school. The school-admin or assigned student-affairs officer can approve or reject it.",
  );
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    requestedFrom: "",
    requestedTo: "",
    reason: "",
    note: "",
    attachmentLabel: "",
    attachmentUrl: "",
    attachmentMimeType: "",
    attachmentSizeBytes: 0,
  });

  async function handleAttachmentChange(file: File | null) {
    if (!file) {
      setDraft((current) => ({
        ...current,
        attachmentLabel: "",
        attachmentUrl: "",
        attachmentMimeType: "",
        attachmentSizeBytes: 0,
      }));
      return;
    }

    try {
      const payload = await buildInlineAttachmentPayload(file);
      setDraft((current) => ({
        ...current,
        attachmentLabel: payload.label,
        attachmentUrl: payload.url,
        attachmentMimeType: payload.mimeType,
        attachmentSizeBytes: payload.sizeBytes,
      }));
      setFeedback(`Attached ${payload.label}. It will travel with the absence request.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not attach that file right now.");
    }
  }

  async function submitRequest() {
    setBusy(true);

    try {
      const response = await fetch("/api/student-absence-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as { error?: string; request?: StudentAbsenceRequest };

      if (!response.ok || !payload.request) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalRequests((current) => [payload.request!, ...current]);
      setDraft({
        requestedFrom: "",
        requestedTo: "",
        reason: "",
        note: "",
        attachmentLabel: "",
        attachmentUrl: "",
        attachmentMimeType: "",
        attachmentSizeBytes: 0,
      });
      setFeedback(
        `Absence request submitted for ${formatDateOnly(payload.request.requestedFrom)} to ${formatDateOnly(payload.request.requestedTo)}. It is now waiting for approval.`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not submit the absence request right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Absence Leave</p>
          <h3>Request absence from school</h3>
        </div>
        <span
          className={`status-pill ${
            studentStatus === "active" ? "status-approved" : "status-under_review"
          }`}
        >
          Student status: {resultStatusLabel(studentStatus)}
        </span>
      </div>

      <div className="callout-banner">
        <strong>{feedback}</strong>
        <p className="muted">
          Approved requests help the school distinguish planned absence from unapproved non-attendance.
        </p>
      </div>

      {studentStatus === "active" ? (
        <div className="form-grid">
          <label>
            <span>From</span>
            <input
              type="date"
              value={draft.requestedFrom}
              onChange={(event) => setDraft((current) => ({ ...current, requestedFrom: event.target.value }))}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={draft.requestedTo}
              onChange={(event) => setDraft((current) => ({ ...current, requestedTo: event.target.value }))}
            />
          </label>
          <label className="form-span-2">
            <span>Reason</span>
            <textarea
              rows={4}
              value={draft.reason}
              onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))}
            />
          </label>
          <label className="form-span-2">
            <span>Extra note</span>
            <textarea
              rows={3}
              value={draft.note}
              onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
              placeholder="Add any extra explanation or expected school follow-up."
            />
          </label>
          <label className="form-span-2">
            <span>Attachment</span>
            <input
              type="file"
              onChange={(event) => void handleAttachmentChange(event.target.files?.[0] ?? null)}
            />
          </label>
          {draft.attachmentLabel ? (
            <div className="attachment-chip">
              <strong>{draft.attachmentLabel}</strong>
              <span className="muted">
                {Math.max(1, Math.round(draft.attachmentSizeBytes / 1024))} KB attached
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flow-step">
          <strong>Absence requests are paused for this student account.</strong>
          <p>
            The account is currently marked as {resultStatusLabel(studentStatus)}, so new leave requests cannot be opened from the portal.
          </p>
        </div>
      )}

      {studentStatus === "active" ? (
        <div className="button-row">
          <button type="button" className="primary-button" onClick={() => void submitRequest()} disabled={busy}>
            {busy ? "Submitting..." : "Submit absence request"}
          </button>
        </div>
      ) : null}

      <div className="timeline">
        {localRequests.length > 0 ? (
          localRequests.map((request) => (
            <article key={request.id} className="timeline-item">
              <strong>
                {formatDateOnly(request.requestedFrom)} to {formatDateOnly(request.requestedTo)}
              </strong>
              <p>{request.reason}</p>
              <span>
                {resultStatusLabel(request.status)} - Requested {formatDate(request.requestedAt)}
              </span>
              {request.decisionNote ? <p className="muted">Decision note: {request.decisionNote}</p> : null}
              {request.attachmentLabel && request.attachmentUrl ? (
                <p className="muted">
                  <a href={request.attachmentUrl} download={request.attachmentLabel} className="inline-link">
                    Open attachment
                  </a>
                </p>
              ) : null}
            </article>
          ))
        ) : (
          <div className="flow-step">
            <strong>No absence request has been submitted yet.</strong>
            <p>Your leave requests will appear here with their approval status.</p>
          </div>
        )}
      </div>
    </section>
  );
}
