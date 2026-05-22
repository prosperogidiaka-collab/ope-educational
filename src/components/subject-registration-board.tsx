"use client";

import { useDeferredValue, useMemo, useState } from "react";

import { classOfferingLabel } from "@/lib/class-structure";
import { resultStatusLabel } from "@/lib/calculations";
import type { ClassOffering, SubjectTeacherAssignment, SubjectRegistrationType } from "@/lib/types";

interface SubjectRegistrationBoardProps {
  offerings: ClassOffering[];
  assignments: SubjectTeacherAssignment[];
  canManage: boolean;
}

function sortAssignments(assignments: SubjectTeacherAssignment[]) {
  return [...assignments].sort((left, right) => {
    const classCompare = left.className.localeCompare(right.className);

    if (classCompare !== 0) {
      return classCompare;
    }

    return left.subjectName.localeCompare(right.subjectName);
  });
}

function assignmentSearchText(assignment: SubjectTeacherAssignment) {
  return [
    assignment.className,
    assignment.arm,
    assignment.subjectName,
    assignment.subjectCode,
    assignment.track ?? "",
    assignment.subjectType ?? "core",
    assignment.teacherName ?? "",
    assignment.active === false ? "retired" : "active",
  ]
    .join(" ")
    .toLowerCase();
}

export function SubjectRegistrationBoard({
  offerings,
  assignments,
  canManage,
}: SubjectRegistrationBoardProps) {
  const [localAssignments, setLocalAssignments] = useState(sortAssignments(assignments));
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(assignments[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState(
    "Register the subjects that belong to each class arm here. Teacher assignment remains a separate step, but the arm now carries the live subject basket.",
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState({
    className: offerings[0]?.className ?? "",
    subjectCode: "",
    subjectName: "",
    subjectType: "core" as SubjectRegistrationType,
    track: "",
  });

  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const visibleAssignments = useMemo(
    () =>
      localAssignments.filter((assignment) =>
        deferredSearch ? assignmentSearchText(assignment).includes(deferredSearch) : true,
      ),
    [deferredSearch, localAssignments],
  );
  const selectedAssignment =
    localAssignments.find((assignment) => assignment.id === selectedAssignmentId) ??
    visibleAssignments[0] ??
    null;

  function updateSelectedAssignment(field: keyof SubjectTeacherAssignment, value: string | boolean) {
    if (!selectedAssignment) {
      return;
    }

    setLocalAssignments((current) =>
      current.map((assignment) =>
        assignment.id === selectedAssignment.id
          ? {
              ...assignment,
              [field]: value,
            }
          : assignment,
      ),
    );
  }

  async function createAssignment() {
    setBusyKey("create");

    try {
      const response = await fetch("/api/subject-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createDraft),
      });
      const payload = (await response.json()) as { error?: string; assignment?: SubjectTeacherAssignment };

      if (!response.ok || !payload.assignment) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalAssignments((current) => sortAssignments([...current, payload.assignment!]));
      setSelectedAssignmentId(payload.assignment.id);
      setCreateDraft((current) => ({
        ...current,
        subjectCode: "",
        subjectName: "",
        subjectType: "core",
        track: "",
      }));
      setFeedback(`${payload.assignment.subjectName} is now registered for ${payload.assignment.className}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not create that subject row right now.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveSelectedAssignment() {
    if (!selectedAssignment) {
      return;
    }

    setBusyKey(`save:${selectedAssignment.id}`);

    try {
      const response = await fetch(`/api/subject-registration/${encodeURIComponent(selectedAssignment.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedAssignment),
      });
      const payload = (await response.json()) as { error?: string; assignment?: SubjectTeacherAssignment };

      if (!response.ok || !payload.assignment) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalAssignments((current) =>
        sortAssignments(current.map((assignment) => (assignment.id === payload.assignment?.id ? payload.assignment! : assignment))),
      );
      setFeedback(`${payload.assignment.subjectName} has been updated for ${payload.assignment.className}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save that subject row right now.");
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
            Timetable publishing can refresh teacher ownership automatically, but this desk controls the actual subject basket attached to each arm.
          </p>
        </div>
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Create Subject Row</p>
              <h3>Add a subject to a class arm</h3>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Class arm</span>
              <select
                value={createDraft.className}
                onChange={(event) => setCreateDraft((current) => ({ ...current, className: event.target.value }))}
                disabled={!canManage}
              >
                {offerings.map((offering) => (
                  <option key={offering.className} value={offering.className}>
                    {classOfferingLabel(offering)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Subject code</span>
              <input
                value={createDraft.subjectCode}
                onChange={(event) => setCreateDraft((current) => ({ ...current, subjectCode: event.target.value }))}
                disabled={!canManage}
              />
            </label>
            <label className="form-span-2">
              <span>Subject name</span>
              <input
                value={createDraft.subjectName}
                onChange={(event) => setCreateDraft((current) => ({ ...current, subjectName: event.target.value }))}
                disabled={!canManage}
              />
            </label>
            <label>
              <span>Type</span>
              <select
                value={createDraft.subjectType}
                onChange={(event) =>
                  setCreateDraft((current) => ({
                    ...current,
                    subjectType: event.target.value as SubjectRegistrationType,
                  }))
                }
                disabled={!canManage}
              >
                <option value="core">Core</option>
                <option value="elective">Elective</option>
              </select>
            </label>
            <label>
              <span>Track</span>
              <input
                value={createDraft.track}
                onChange={(event) => setCreateDraft((current) => ({ ...current, track: event.target.value }))}
                placeholder="Optional track restriction"
                disabled={!canManage}
              />
            </label>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              disabled={!canManage || busyKey === "create"}
              onClick={() => void createAssignment()}
            >
              {busyKey === "create" ? "Creating..." : "Add subject row"}
            </button>
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Subject Rows</p>
              <h3>Search and select an existing row</h3>
            </div>
          </div>
          <label className="inline-search-field">
            <span>Search subject rows</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by class, subject, type, track, or teacher"
            />
          </label>
          <div className="stack-list">
            {visibleAssignments.map((assignment) => (
              <button
                key={assignment.id}
                type="button"
                className={selectedAssignment?.id === assignment.id ? "selection-card selected" : "selection-card"}
                onClick={() => setSelectedAssignmentId(assignment.id)}
              >
                <strong>{assignment.subjectName}</strong>
                <p>{assignment.className}</p>
                <p className="muted">
                  {assignment.subjectCode} - {resultStatusLabel(assignment.subjectType ?? "core")}
                  {assignment.track ? ` - ${assignment.track}` : ""}
                </p>
              </button>
            ))}
          </div>
        </article>
      </section>

      {selectedAssignment ? (
        <section className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Selected Subject Row</p>
              <h3>Edit registration details</h3>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Subject code</span>
              <input
                value={selectedAssignment.subjectCode}
                onChange={(event) => updateSelectedAssignment("subjectCode", event.target.value)}
                disabled={!canManage}
              />
            </label>
            <label>
              <span>Subject name</span>
              <input
                value={selectedAssignment.subjectName}
                onChange={(event) => updateSelectedAssignment("subjectName", event.target.value)}
                disabled={!canManage}
              />
            </label>
            <label>
              <span>Type</span>
              <select
                value={selectedAssignment.subjectType ?? "core"}
                onChange={(event) => updateSelectedAssignment("subjectType", event.target.value)}
                disabled={!canManage}
              >
                <option value="core">Core</option>
                <option value="elective">Elective</option>
              </select>
            </label>
            <label>
              <span>Track</span>
              <input
                value={selectedAssignment.track ?? ""}
                onChange={(event) => updateSelectedAssignment("track", event.target.value)}
                placeholder="Optional track restriction"
                disabled={!canManage}
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={selectedAssignment.active === false ? "inactive" : "active"}
                onChange={(event) => updateSelectedAssignment("active", event.target.value === "active")}
                disabled={!canManage}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label>
              <span>Assigned teacher</span>
              <input value={selectedAssignment.teacherName ?? "Unassigned"} readOnly />
            </label>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              disabled={!canManage || busyKey === `save:${selectedAssignment.id}`}
              onClick={() => void saveSelectedAssignment()}
            >
              {busyKey === `save:${selectedAssignment.id}` ? "Saving..." : "Save subject row"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
