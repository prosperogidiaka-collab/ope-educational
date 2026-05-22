"use client";

import { useState } from "react";

import { resultStatusLabel } from "@/lib/calculations";
import type { ClassOffering, PromotionCandidate, SessionRolloverRecord } from "@/lib/types";

interface SessionRolloverBoardProps {
  currentSession: string;
  nextSession: string;
  offerings: ClassOffering[];
  nextSessionOfferings: ClassOffering[];
  queue: PromotionCandidate[];
  records: SessionRolloverRecord[];
  canManage: boolean;
}

export function SessionRolloverBoard({
  currentSession,
  nextSession,
  offerings,
  nextSessionOfferings,
  queue,
  records,
  canManage,
}: SessionRolloverBoardProps) {
  const [localOfferings, setLocalOfferings] = useState(offerings);
  const [localNextSessionOfferings, setLocalNextSessionOfferings] = useState(nextSessionOfferings);
  const [localQueue, setLocalQueue] = useState(queue);
  const [localRecords, setLocalRecords] = useState(records);
  const [feedback, setFeedback] = useState(
    "Prepare next-session class structure here, then use the promotion queue to decide who moves or stays on hold.",
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function updateQueueCandidate(regNumber: string, field: keyof PromotionCandidate, value: string) {
    setLocalQueue((current) =>
      current.map((candidate) =>
        candidate.regNumber === regNumber
          ? {
              ...candidate,
              [field]: value,
            }
          : candidate,
      ),
    );
  }

  async function runRolloverAction(className: string, actionType: "duplicate_structure" | "archive_arm") {
    setBusyKey(`${actionType}:${className}`);

    try {
      const response = await fetch("/api/session-rollover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceClassName: className, actionType }),
      });
      const payload = (await response.json()) as {
        error?: string;
        record?: SessionRolloverRecord;
        offering?: ClassOffering | null;
      };

      if (!response.ok || !payload.record) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      if (actionType === "duplicate_structure" && payload.offering) {
        setLocalNextSessionOfferings((current) =>
          [...current, payload.offering!].sort((left, right) => left.className.localeCompare(right.className)),
        );
      }

      if (actionType === "archive_arm" && payload.offering) {
        setLocalOfferings((current) =>
          current.map((offering) =>
            offering.className === className ? payload.offering! : offering,
          ),
        );
      }

      setLocalRecords((current) => [payload.record!, ...current]);
      setFeedback(payload.record.note);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not complete that rollover action right now.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveQueueCandidate(candidate: PromotionCandidate) {
    setBusyKey(`queue:${candidate.regNumber}`);

    try {
      const response = await fetch(`/api/promotion-queue/${encodeURIComponent(candidate.regNumber)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(candidate),
      });
      const payload = (await response.json()) as { error?: string; candidate?: PromotionCandidate };

      if (!response.ok || !payload.candidate) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalQueue((current) =>
        current.map((item) => (item.regNumber === payload.candidate?.regNumber ? payload.candidate : item)),
      );
      setFeedback(`${payload.candidate.studentName} is now marked ${resultStatusLabel(payload.candidate.status).toLowerCase()} for rollover.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not update the promotion queue right now.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="stack-list">
      <section className="surface-card">
        <div className="callout-banner">
          <strong>{feedback}</strong>
          <p className="muted">
            Current session: {currentSession}. Target next session: {nextSession}. Structure actions and student promotion decisions are stored live.
          </p>
        </div>
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Current Session Structure</p>
              <h3>Duplicate or archive class arms</h3>
            </div>
          </div>
          <div className="stack-list">
            {localOfferings.map((offering) => (
              <div key={`${offering.session}-${offering.className}`} className="selection-card">
                <strong>{offering.className}</strong>
                <p>{offering.arm} arm - {offering.section} - {offering.track}</p>
                <p className="muted">
                  {offering.classTeacher} / {offering.hod} - {resultStatusLabel(offering.status ?? "active")}
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!canManage || busyKey === `duplicate_structure:${offering.className}`}
                    onClick={() => void runRolloverAction(offering.className, "duplicate_structure")}
                  >
                    {busyKey === `duplicate_structure:${offering.className}` ? "Duplicating..." : "Duplicate to next session"}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!canManage || offering.status === "retired" || busyKey === `archive_arm:${offering.className}`}
                    onClick={() => void runRolloverAction(offering.className, "archive_arm")}
                  >
                    {busyKey === `archive_arm:${offering.className}` ? "Archiving..." : "Archive arm"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Prepared Next Session</p>
              <h3>Arms already copied into {nextSession}</h3>
            </div>
          </div>
          <div className="stack-list">
            {localNextSessionOfferings.length > 0 ? (
              localNextSessionOfferings.map((offering) => (
                <div key={`${offering.session}-${offering.className}`} className="leader-card feature">
                  <strong>{offering.className}</strong>
                  <p className="muted">{offering.arm} arm - {offering.section} - {offering.track}</p>
                  <p>{offering.classTeacher} / {offering.hod}</p>
                </div>
              ))
            ) : (
              <div className="flow-step">
                <strong>No arm has been copied into {nextSession} yet.</strong>
                <p>Use “Duplicate to next session” on the left to prepare the next structure live.</p>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Promotion Queue</p>
            <h3>Decide who is ready and who stays on hold</h3>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Current Class</th>
                <th>Next Class</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {localQueue.map((candidate) => (
                <tr key={candidate.regNumber}>
                  <td>
                    <strong>{candidate.studentName}</strong>
                    <p className="muted">{candidate.regNumber}</p>
                  </td>
                  <td>{candidate.currentClass}</td>
                  <td>
                    <input
                      value={candidate.nextClass}
                      onChange={(event) => updateQueueCandidate(candidate.regNumber, "nextClass", event.target.value)}
                      disabled={!canManage}
                    />
                  </td>
                  <td>
                    <select
                      value={candidate.status}
                      onChange={(event) => updateQueueCandidate(candidate.regNumber, "status", event.target.value)}
                      disabled={!canManage}
                    >
                      <option value="ready">Ready</option>
                      <option value="hold">Hold</option>
                    </select>
                  </td>
                  <td>
                    <textarea
                      rows={2}
                      value={candidate.reason}
                      onChange={(event) => updateQueueCandidate(candidate.regNumber, "reason", event.target.value)}
                      disabled={!canManage}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={!canManage || busyKey === `queue:${candidate.regNumber}`}
                      onClick={() => void saveQueueCandidate(candidate)}
                    >
                      {busyKey === `queue:${candidate.regNumber}` ? "Saving..." : "Save queue row"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Rollover History</p>
            <h3>Recorded structure actions</h3>
          </div>
        </div>
        <div className="timeline">
          {localRecords.length > 0 ? (
            localRecords.map((record) => (
              <article key={record.id} className="timeline-item">
                <strong>{resultStatusLabel(record.actionType)}</strong>
                <p>{record.note}</p>
                <span>
                  {record.sourceClassName}
                  {record.targetClassName ? ` -> ${record.targetClassName}` : ""} - {record.actedBy}
                </span>
              </article>
            ))
          ) : (
            <div className="flow-step">
              <strong>No rollover action has been recorded yet.</strong>
              <p>The structure history will appear here as soon as you duplicate or archive an arm.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
