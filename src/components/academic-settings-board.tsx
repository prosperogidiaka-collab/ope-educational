"use client";

import Link from "next/link";
import { useState } from "react";

import {
  buildAssessmentBreakdown,
  createAssessmentComponent,
  SECTION_OPTIONS,
  TERM_OPTIONS,
  totalConfiguredWeight,
} from "@/lib/academic-config";
import { formatDateOnly, resultStatusLabel } from "@/lib/calculations";
import type {
  AcademicConfig,
  ClassOffering,
  GradeBand,
  PromotionCandidate,
  SchoolProfile,
  ScoreComponentRule,
} from "@/lib/types";

interface AcademicSettingsBoardProps {
  school: SchoolProfile;
  config: AcademicConfig;
  seniorBands: GradeBand[];
  juniorBands: GradeBand[];
  classOfferings: ClassOffering[];
  promotionQueue: PromotionCandidate[];
  canManage: boolean;
}

const SECTION_LABELS: Record<AcademicConfig["section"], string> = {
  junior: "Junior Section",
  senior: "Senior Section",
};

const ROUNDING_OPTIONS = [
  "Round to whole numbers",
  "Round to 1 decimal place",
  "Round to 2 decimal places",
];

function datetimeInputValue(value: string) {
  if (!value) {
    return "";
  }

  return value.slice(0, 16);
}

export function AcademicSettingsBoard({
  school,
  config,
  seniorBands,
  juniorBands,
  classOfferings,
  promotionQueue,
  canManage,
}: AcademicSettingsBoardProps) {
  const [draft, setDraft] = useState(config);
  const [liveSchool, setLiveSchool] = useState(school);
  const [message, setMessage] = useState(
    canManage
      ? "Activate the current session and term here, then define how many assessment components should be used for this workflow."
      : "You can review the active term and assessment rules here. School-admin access is required to make changes.",
  );
  const [busySection, setBusySection] = useState<null | "term" | "assessment" | "ranking">(null);
  const currentBands = draft.section === "junior" ? juniorBands : seniorBands;
  const configuredWeight = totalConfiguredWeight(draft);
  const canSaveAssessment = configuredWeight === 100 && draft.scoreComponents.length > 0;

  function updateDraft(nextDraft: AcademicConfig) {
    setDraft(nextDraft);
    setMessage("Unsaved academic setup changes are in progress.");
  }

  function updateComponent(componentKey: string, updater: (component: ScoreComponentRule) => ScoreComponentRule) {
    updateDraft({
      ...draft,
      scoreComponents: draft.scoreComponents.map((component) =>
        component.key === componentKey ? updater(component) : component,
      ),
    });
  }

  function addComponent() {
    updateDraft({
      ...draft,
      scoreComponents: [...draft.scoreComponents, createAssessmentComponent(draft.scoreComponents)],
    });
  }

  function moveComponent(componentKey: string, direction: -1 | 1) {
    const currentIndex = draft.scoreComponents.findIndex((component) => component.key === componentKey);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= draft.scoreComponents.length) {
      return;
    }

    const nextComponents = [...draft.scoreComponents];
    const [component] = nextComponents.splice(currentIndex, 1);
    nextComponents.splice(targetIndex, 0, component);

    updateDraft({
      ...draft,
      scoreComponents: nextComponents,
    });
  }

  function removeComponent(componentKey: string) {
    if (draft.scoreComponents.length === 1) {
      setMessage("Keep at least one active score component in the term setup.");
      return;
    }

    updateDraft({
      ...draft,
      scoreComponents: draft.scoreComponents.filter((component) => component.key !== componentKey),
    });
  }

  async function persist(section: "term" | "assessment" | "ranking", successMessage: string) {
    if (!canManage) {
      return;
    }

    if (section === "assessment" && !canSaveAssessment) {
      setMessage("Assessment setup must total exactly 100 marks before it can be saved.");
      return;
    }

    setBusySection(section);

    try {
      const response = await fetch("/api/academic-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          config: draft,
          operation: section,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        config?: AcademicConfig;
        school?: SchoolProfile;
      };

      if (!response.ok || !payload.config) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setDraft(payload.config);
      if (payload.school) {
        setLiveSchool(payload.school);
      }
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save academic setup changes right now.");
    } finally {
      setBusySection(null);
    }
  }

  return (
    <div className="stack-list">
      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Academic Setup</p>
            <h3>Active session, term, and assessment policy</h3>
        </div>
        <span className={`status-pill ${canManage ? "status-approved" : "status-under_review"}`}>
            {canManage ? "School-admin control" : "Read only"}
        </span>
      </div>

        <div className="callout-banner">
          <strong>{message}</strong>
          <p className="muted">
            Current workflow: {liveSchool.session} - {liveSchool.term} - {liveSchool.examType}. Assessment split:{" "}
            {buildAssessmentBreakdown(draft)}.
          </p>
        </div>

        <div className="metric-grid compact">
          <article className="metric-card subtle">
            <p className="metric-label">Active session</p>
            <h3>{draft.session}</h3>
            <p className="muted">Controls the current live workflow label</p>
          </article>
          <article className="metric-card subtle">
            <p className="metric-label">Active term</p>
            <h3>{draft.term}</h3>
            <p className="muted">{draft.examType}</p>
          </article>
          <article className="metric-card subtle">
            <p className="metric-label">Assessment slots</p>
            <h3>{draft.scoreComponents.length}</h3>
            <p className="muted">{configuredWeight} total marks configured</p>
          </article>
          <article className="metric-card subtle">
            <p className="metric-label">Current section</p>
            <h3>{SECTION_LABELS[draft.section]}</h3>
            <p className="muted">{draft.gradeScaleName}</p>
          </article>
        </div>
      </section>

      <section id="term-activation" className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Term Activation</p>
            <h3>Switch and activate the live session and term</h3>
          </div>
          <div className="button-row">
            <Link href="/dashboard/result-locks" className="secondary-button">
              Open score locks
            </Link>
            <button
              type="button"
              className="primary-button"
              disabled={!canManage || busySection === "term"}
              onClick={() =>
                void persist(
                  "term",
                  `The active workflow is now ${draft.session} - ${draft.term} (${draft.examType}).`,
                )
              }
            >
              {busySection === "term" ? "Saving..." : "Activate this term"}
            </button>
          </div>
        </div>

        <div className="form-grid compact-grid">
          <label>
            Session
            <input
              value={draft.session}
              onChange={(event) => updateDraft({ ...draft, session: event.target.value })}
              disabled={!canManage}
              placeholder="2026/2027"
            />
          </label>
          <label>
            Term
            <select
              value={draft.term}
              onChange={(event) => updateDraft({ ...draft, term: event.target.value })}
              disabled={!canManage}
            >
              {TERM_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Exam type
            <input
              value={draft.examType}
              onChange={(event) => updateDraft({ ...draft, examType: event.target.value })}
              disabled={!canManage}
              placeholder="Terminal Examination"
            />
          </label>
          <label>
            Section
            <select
              value={draft.section}
              onChange={(event) =>
                updateDraft({
                  ...draft,
                  section: event.target.value as AcademicConfig["section"],
                })
              }
              disabled={!canManage}
            >
              {SECTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {SECTION_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Grade policy label
            <input
              value={draft.gradeScaleName}
              onChange={(event) => updateDraft({ ...draft, gradeScaleName: event.target.value })}
              disabled={!canManage}
            />
          </label>
          <label>
            Publish scope
            <input
              value={draft.publishScope}
              onChange={(event) => updateDraft({ ...draft, publishScope: event.target.value })}
              disabled={!canManage}
            />
          </label>
        </div>
      </section>

      <section id="assessment-setup" className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Assessment Setup</p>
            <h3>Decide how many assessment slots and scores apply this term</h3>
          </div>
          <div className="button-row">
            <span className="status-pill status-under_review">{draft.scoreComponents.length} slots</span>
            <span
              className={`status-pill ${
                configuredWeight === 100 ? "status-approved" : "status-corrections_requested"
              }`}
            >
              {configuredWeight} / 100 marks
            </span>
            <button type="button" className="secondary-button" disabled={!canManage} onClick={addComponent}>
              Add assessment slot
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!canManage || busySection === "assessment" || !canSaveAssessment}
              onClick={() =>
                void persist(
                  "assessment",
                  "Assessment setup saved. Teacher entry, score review, reports, and broadsheets now use this live component structure.",
                )
              }
            >
              {busySection === "assessment" ? "Saving..." : "Save assessment setup"}
            </button>
          </div>
        </div>

        <div className="callout-banner warning">
          <strong>Add as many assessment slots as this term needs, but keep the full structure at 100 marks.</strong>
          <p className="muted">
            Use the visible Add assessment slot button here whenever you need more than Test 1, Test 2, and Exam. Rename each slot, set its marks, freeze it when it closes, and keep the order intentional.
          </p>
        </div>

        <div className="metric-grid compact" style={{ marginBottom: "1rem" }}>
          <article className="metric-card subtle">
            <p className="metric-label">Configured slots</p>
            <h3>{draft.scoreComponents.length}</h3>
            <p className="muted">Every slot will appear in teacher score entry and score review.</p>
          </article>
          <article className="metric-card subtle">
            <p className="metric-label">Assessment flow</p>
            <h3>{draft.scoreComponents.map((component) => component.label).join(" / ")}</h3>
            <p className="muted">The order here is the live order teachers and reviewers see.</p>
          </article>
          <article className="metric-card subtle">
            <p className="metric-label">Save readiness</p>
            <h3>{canSaveAssessment ? "Ready" : "Needs balance"}</h3>
            <p className="muted">
              {canSaveAssessment
                ? "The current assessment structure is balanced and can be activated."
                : "Adjust the slot weights until the structure totals exactly 100 marks."}
            </p>
          </article>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Slot</th>
                <th>Live key</th>
                <th>Label</th>
                <th>Max score</th>
                <th>Weight</th>
                <th>Closes</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {draft.scoreComponents.map((component, index) => (
                <tr key={component.key}>
                  <td>
                    <strong>Slot {index + 1}</strong>
                  </td>
                  <td>
                    <span className="muted">{component.key}</span>
                  </td>
                  <td>
                    <input
                      value={component.label}
                      onChange={(event) =>
                        updateComponent(component.key, (current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                      disabled={!canManage}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={component.maxScore}
                      onChange={(event) =>
                        updateComponent(component.key, (current) => ({
                          ...current,
                          maxScore: Number(event.target.value) || 0,
                        }))
                      }
                      disabled={!canManage}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={component.weight}
                      onChange={(event) =>
                        updateComponent(component.key, (current) => ({
                          ...current,
                          weight: Number(event.target.value) || 0,
                        }))
                      }
                      disabled={!canManage}
                    />
                  </td>
                  <td>
                    <input
                      type="datetime-local"
                      value={datetimeInputValue(component.closesAt)}
                      onChange={(event) =>
                        updateComponent(component.key, (current) => ({
                          ...current,
                          closesAt: event.target.value ? new Date(event.target.value).toISOString() : "",
                        }))
                      }
                      disabled={!canManage}
                    />
                  </td>
                  <td>
                    <label className="inline-select">
                      <span>{component.frozen ? "Frozen" : "Open"}</span>
                      <input
                        type="checkbox"
                        checked={component.frozen}
                        onChange={(event) =>
                          updateComponent(component.key, (current) => ({
                            ...current,
                            frozen: event.target.checked,
                          }))
                        }
                        disabled={!canManage}
                      />
                    </label>
                  </td>
                  <td>
                    <div className="button-row">
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={!canManage || index === 0}
                        onClick={() => moveComponent(component.key, -1)}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={!canManage || index === draft.scoreComponents.length - 1}
                        onClick={() => moveComponent(component.key, 1)}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={!canManage || draft.scoreComponents.length === 1}
                        onClick={() => removeComponent(component.key)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="ranking-policy" className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Ranking and Grade Policy</p>
            <h3>Control how ranking and release decisions behave</h3>
          </div>
          <div className="button-row">
            <Link href="/dashboard/score-overrides" className="secondary-button">
              Edit entered scores
            </Link>
            <button
              type="button"
              className="primary-button"
              disabled={!canManage || busySection === "ranking"}
              onClick={() =>
                void persist(
                  "ranking",
                  "Ranking policy saved. Score review and live result calculations now follow this rule set.",
                )
              }
            >
              {busySection === "ranking" ? "Saving..." : "Save ranking policy"}
            </button>
          </div>
        </div>

        <div className="form-grid compact-grid">
          <label>
            Minimum subjects for ranking
            <input
              type="number"
              min={1}
              value={draft.rankingPolicy.minimumSubjectCount}
              onChange={(event) =>
                updateDraft({
                  ...draft,
                  rankingPolicy: {
                    ...draft.rankingPolicy,
                    minimumSubjectCount: Number(event.target.value) || 1,
                  },
                })
              }
              disabled={!canManage}
            />
          </label>
          <label>
            Rounding mode
            <select
              value={draft.rankingPolicy.roundingMode}
              onChange={(event) =>
                updateDraft({
                  ...draft,
                  rankingPolicy: {
                    ...draft.rankingPolicy,
                    roundingMode: event.target.value,
                  },
                })
              }
              disabled={!canManage}
            >
              {ROUNDING_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tie-breakers
            <input
              value={draft.rankingPolicy.tieBreakers.join(", ")}
              onChange={(event) =>
                updateDraft({
                  ...draft,
                  rankingPolicy: {
                    ...draft.rankingPolicy,
                    tieBreakers: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  },
                })
              }
              disabled={!canManage}
              placeholder="weightedAverage, mathematics, english, attendance"
            />
          </label>
          <label className="selection-card">
            <strong>Exclude incomplete students from class positions</strong>
            <input
              type="checkbox"
              checked={draft.rankingPolicy.excludeIncompleteStudents}
              onChange={(event) =>
                updateDraft({
                  ...draft,
                  rankingPolicy: {
                    ...draft.rankingPolicy,
                    excludeIncompleteStudents: event.target.checked,
                  },
                })
              }
              disabled={!canManage}
            />
          </label>
          <label className="selection-card">
            <strong>Count missing score cells as zero</strong>
            <input
              type="checkbox"
              checked={draft.rankingPolicy.missingScoresCountAsZero}
              onChange={(event) =>
                updateDraft({
                  ...draft,
                  rankingPolicy: {
                    ...draft.rankingPolicy,
                    missingScoresCountAsZero: event.target.checked,
                  },
                })
              }
              disabled={!canManage}
            />
          </label>
        </div>
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Class Offerings</p>
              <h3>Subjects by arm and track</h3>
            </div>
          </div>
          <div className="stack-list">
            {classOfferings.map((offering) => (
              <div key={offering.className} className="leader-card feature">
                <div className="audit-header">
                  <div>
                    <strong>{offering.className}</strong>
                    <p className="muted">
                      {offering.track} track - {offering.section}
                    </p>
                  </div>
                  <span className="score-chip">{offering.publicationProgress}%</span>
                </div>
                <p className="muted">
                  Class teacher: {offering.classTeacher} - HOD: {offering.hod}
                </p>
                <p>
                  Core subjects: {offering.subjectIds.length} - Electives: {offering.electiveSubjectIds.length}
                </p>
                <p className="muted">Pending teachers: {offering.pendingTeachers.join(", ") || "None"}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Promotion Queue</p>
              <h3>Bulk next-session movement preview</h3>
            </div>
          </div>
          <div className="stack-list">
            {promotionQueue.map((candidate) => (
              <div key={candidate.regNumber} className="approval-card">
                <div>
                  <strong>{candidate.studentName}</strong>
                  <p className="muted">
                    {candidate.currentClass} to {candidate.nextClass}
                  </p>
                </div>
                <div>
                  <span
                    className={`status-pill status-${
                      candidate.status === "ready" ? "approved" : "corrections_requested"
                    }`}
                  >
                    {resultStatusLabel(candidate.status === "ready" ? "approved" : "corrections_requested")}
                  </span>
                  <p>{candidate.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Active Grade Scale</p>
              <h3>{SECTION_LABELS[draft.section]} grade bands</h3>
            </div>
          </div>
          <div className="grade-grid">
            {currentBands.map((band) => (
              <article key={band.id} className="grade-card">
                <div className="grade-swatch" style={{ backgroundColor: band.color }} />
                <div>
                  <strong>
                    {band.label}: {band.min}-{band.max}
                  </strong>
                  <p className="muted">{band.remark}</p>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Live Summary</p>
              <h3>What this setup means operationally</h3>
            </div>
          </div>
          <div className="stack-list">
            {draft.scoreComponents.map((component) => (
              <div key={component.key} className="flow-step">
                <strong>{component.label}</strong>
                <p>
                  {component.weight} marks out of 100, max raw score {component.maxScore}, closes{" "}
                  {component.closesAt ? formatDateOnly(component.closesAt) : "when you decide"}, currently{" "}
                  {component.frozen ? "frozen" : "open"}.
                </p>
              </div>
            ))}
            <div className="flow-step">
              <strong>Ranking gate</strong>
              <p>
                Students need at least {draft.rankingPolicy.minimumSubjectCount} complete subject entries before they can be ranked.
              </p>
            </div>
            <div className="flow-step">
              <strong>Incomplete handling</strong>
              <p>
                {draft.rankingPolicy.excludeIncompleteStudents
                  ? "Incomplete result sheets stay out of class position until every required component is filled."
                  : "Incomplete result sheets can still be ranked if the other ranking rules allow it."}
              </p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
