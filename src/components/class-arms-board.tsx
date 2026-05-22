"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { classOfferingLabel } from "@/lib/class-structure";
import { resultStatusLabel } from "@/lib/calculations";
import type { ClassOffering, GradeSection, SchoolClassRecord, SubjectTeacherAssignment } from "@/lib/types";

interface ClassArmsBoardProps {
  schoolClasses: SchoolClassRecord[];
  offerings: ClassOffering[];
  assignments: SubjectTeacherAssignment[];
  staffNames: string[];
  canManage: boolean;
}

function searchText(offering: ClassOffering) {
  return [
    offering.baseClassName,
    offering.className,
    offering.arm,
    offering.section,
    offering.track,
    offering.classTeacher,
    offering.hod,
    offering.status ?? "active",
  ]
    .join(" ")
    .toLowerCase();
}

function sortOfferings(offerings: ClassOffering[]) {
  return [...offerings].sort((left, right) => left.className.localeCompare(right.className));
}

function sortSchoolClasses(records: SchoolClassRecord[]) {
  return [...records].sort((left, right) => left.className.localeCompare(right.className));
}

export function ClassArmsBoard({
  schoolClasses,
  offerings,
  assignments,
  staffNames,
  canManage,
}: ClassArmsBoardProps) {
  const [localSchoolClasses, setLocalSchoolClasses] = useState(sortSchoolClasses(schoolClasses));
  const [localOfferings, setLocalOfferings] = useState(sortOfferings(offerings));
  const [search, setSearch] = useState("");
  const [selectedClassName, setSelectedClassName] = useState(offerings[0]?.className ?? "");
  const [feedback, setFeedback] = useState(
    "Create the base class first, then attach one or more arms to it. Owners, track, and subject coverage stay wired to the live school registry.",
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [classDraft, setClassDraft] = useState({
    className: "",
    section: "senior" as GradeSection,
  });
  const [createDraft, setCreateDraft] = useState({
    baseClassName: schoolClasses[0]?.className ?? "",
    arm: "",
    section: "senior" as GradeSection,
    track: "General",
    classTeacher: "",
    hod: "",
  });

  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const visibleOfferings = useMemo(
    () =>
      localOfferings.filter((offering) =>
        deferredSearch ? searchText(offering).includes(deferredSearch) : true,
      ),
    [deferredSearch, localOfferings],
  );
  const selectedOffering =
    localOfferings.find((offering) => offering.className === selectedClassName) ??
    visibleOfferings[0] ??
    null;
  const activeClassOptions = localSchoolClasses.filter((record) => record.status === "active");

  function updateSelectedOffering(field: keyof ClassOffering, value: string) {
    if (!selectedOffering) {
      return;
    }

    setLocalOfferings((current) =>
      current.map((offering) =>
        offering.className === selectedOffering.className
          ? {
              ...offering,
              [field]: value,
            }
          : offering,
      ),
    );
  }

  function offeringRows(className: string) {
    return assignments.filter((assignment) => assignment.className === className && assignment.active !== false);
  }

  async function createSchoolClass() {
    setBusyKey("class:create");

    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(classDraft),
      });
      const payload = (await response.json()) as { error?: string; schoolClass?: SchoolClassRecord };

      if (!response.ok || !payload.schoolClass) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalSchoolClasses((current) => sortSchoolClasses([...current, payload.schoolClass!]));
      setCreateDraft((current) => ({
        ...current,
        baseClassName: current.baseClassName || payload.schoolClass!.className,
        section: payload.schoolClass!.section,
      }));
      setClassDraft({
        className: "",
        section: "senior",
      });
      setFeedback(`${payload.schoolClass.className} is now available for arm creation in the live session.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not create that class right now.");
    } finally {
      setBusyKey(null);
    }
  }

  async function createOffering() {
    setBusyKey("arm:create");

    try {
      const response = await fetch("/api/class-arms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createDraft),
      });
      const payload = (await response.json()) as { error?: string; offering?: ClassOffering };

      if (!response.ok || !payload.offering) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalOfferings((current) => sortOfferings([...current, payload.offering!]));
      setSelectedClassName(payload.offering.className);
      setCreateDraft((current) => ({
        ...current,
        arm: "",
        track: "General",
        classTeacher: "",
        hod: "",
      }));
      setFeedback(`${classOfferingLabel(payload.offering)} is now part of the live class-arm registry.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not create that arm right now.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveSelectedOffering() {
    if (!selectedOffering) {
      return;
    }

    setBusyKey(`save:${selectedOffering.className}`);

    try {
      const response = await fetch(`/api/class-arms/${encodeURIComponent(selectedClassName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedOffering),
      });
      const payload = (await response.json()) as { error?: string; offering?: ClassOffering };

      if (!response.ok || !payload.offering) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalOfferings((current) =>
        sortOfferings(
          current.map((offering) =>
            offering.className === selectedClassName ? payload.offering! : offering,
          ),
        ),
      );
      setSelectedClassName(payload.offering.className);
      setFeedback(
        `${classOfferingLabel(payload.offering)} has been updated. The live class-arm registry, student records, and attendance references now use the saved structure.`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save that class arm right now.");
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
            Classes are created separately from arms. Once an arm exists, use Session Rollover for promotion structure and Teacher Assignments for subject ownership.
          </p>
        </div>
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Class Registry</p>
              <h3>Create the base classes first</h3>
            </div>
            <span className={`status-pill ${canManage ? "status-approved" : "status-under_review"}`}>
              {canManage ? "Editable" : "Read only"}
            </span>
          </div>
          <div className="form-grid">
            <label>
              <span>Class</span>
              <input
                value={classDraft.className}
                onChange={(event) => setClassDraft((current) => ({ ...current, className: event.target.value }))}
                placeholder="e.g. SS1"
                disabled={!canManage}
              />
            </label>
            <label>
              <span>Section</span>
              <select
                value={classDraft.section}
                onChange={(event) =>
                  setClassDraft((current) => ({ ...current, section: event.target.value as GradeSection }))
                }
                disabled={!canManage}
              >
                <option value="junior">Junior</option>
                <option value="senior">Senior</option>
              </select>
            </label>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              disabled={!canManage || busyKey === "class:create"}
              onClick={() => void createSchoolClass()}
            >
              {busyKey === "class:create" ? "Creating..." : "Create class"}
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Status</th>
                  <th>Arms</th>
                </tr>
              </thead>
              <tbody>
                {localSchoolClasses.map((record) => {
                  const armCount = localOfferings.filter(
                    (offering) => (offering.baseClassName ?? "").toLowerCase() === record.className.toLowerCase(),
                  ).length;

                  return (
                    <tr key={record.id}>
                      <td>
                        <strong>{record.className}</strong>
                      </td>
                      <td>{resultStatusLabel(record.section)}</td>
                      <td>{resultStatusLabel(record.status)}</td>
                      <td>{armCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Add Arm</p>
              <h3>Attach a new arm to an existing class</h3>
            </div>
          </div>
          <div className="form-grid">
            <label>
              <span>Class</span>
              <select
                value={createDraft.baseClassName}
                onChange={(event) => {
                  const nextBaseClassName = event.target.value;
                  const selectedClass = localSchoolClasses.find((record) => record.className === nextBaseClassName);
                  setCreateDraft((current) => ({
                    ...current,
                    baseClassName: nextBaseClassName,
                    section: selectedClass?.section ?? current.section,
                  }));
                }}
                disabled={!canManage || activeClassOptions.length === 0}
              >
                <option value="">Select class</option>
                {activeClassOptions.map((record) => (
                  <option key={record.id} value={record.className}>
                    {record.className}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Arm</span>
              <input
                value={createDraft.arm}
                onChange={(event) => setCreateDraft((current) => ({ ...current, arm: event.target.value }))}
                placeholder="e.g. Gold"
                disabled={!canManage}
              />
            </label>
            <label>
              <span>Section</span>
              <select
                value={createDraft.section}
                onChange={(event) =>
                  setCreateDraft((current) => ({ ...current, section: event.target.value as GradeSection }))
                }
                disabled={!canManage}
              >
                <option value="junior">Junior</option>
                <option value="senior">Senior</option>
              </select>
            </label>
            <label>
              <span>Track</span>
              <input
                value={createDraft.track}
                onChange={(event) => setCreateDraft((current) => ({ ...current, track: event.target.value }))}
                placeholder="Science, Arts, Commercial, or General"
                disabled={!canManage}
              />
            </label>
            <label>
              <span>Class teacher</span>
              <input
                list="class-arm-staff-list"
                value={createDraft.classTeacher}
                onChange={(event) => setCreateDraft((current) => ({ ...current, classTeacher: event.target.value }))}
                disabled={!canManage}
              />
            </label>
            <label>
              <span>HOD</span>
              <input
                list="class-arm-staff-list"
                value={createDraft.hod}
                onChange={(event) => setCreateDraft((current) => ({ ...current, hod: event.target.value }))}
                disabled={!canManage}
              />
            </label>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              disabled={!canManage || busyKey === "arm:create"}
              onClick={() => void createOffering()}
            >
              {busyKey === "arm:create" ? "Creating..." : "Add arm"}
            </button>
            <Link href="/dashboard/session-rollover" className="secondary-button">
              Open session rollover
            </Link>
          </div>
          <datalist id="class-arm-staff-list">
            {staffNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </article>
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Arm Registry</p>
              <h3>Search and select a live class arm</h3>
            </div>
          </div>
          <label className="inline-search-field">
            <span>Search class arms</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by class, arm, section, owner, or status"
            />
          </label>
          <div className="stack-list">
            {visibleOfferings.map((offering) => {
              const rows = offeringRows(offering.className);
              const assignedCount = rows.filter((assignment) => assignment.teacherAccountId).length;

              return (
                <button
                  key={`${offering.session}-${offering.className}`}
                  type="button"
                  className={selectedOffering?.className === offering.className ? "selection-card selected" : "selection-card"}
                  onClick={() => setSelectedClassName(offering.className)}
                >
                  <strong>{classOfferingLabel(offering)}</strong>
                  <p>
                    {resultStatusLabel(offering.section)} section - {offering.track}
                  </p>
                  <p className="muted">
                    {assignedCount} / {rows.length} subject rows assigned - {resultStatusLabel(offering.status ?? "active")}
                  </p>
                </button>
              );
            })}
          </div>
        </article>

        {selectedOffering ? (
          <article className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Selected Arm</p>
                <h3>Edit arm identity and owners</h3>
              </div>
            </div>
            <div className="form-grid">
              <label>
                <span>Class</span>
                <select
                  value={selectedOffering.baseClassName ?? ""}
                  onChange={(event) => updateSelectedOffering("baseClassName", event.target.value)}
                  disabled={!canManage}
                >
                  {activeClassOptions.map((record) => (
                    <option key={record.id} value={record.className}>
                      {record.className}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Arm</span>
                <input
                  value={selectedOffering.arm}
                  onChange={(event) => updateSelectedOffering("arm", event.target.value)}
                  disabled={!canManage}
                />
              </label>
              <label>
                <span>Section</span>
                <select
                  value={selectedOffering.section}
                  onChange={(event) => updateSelectedOffering("section", event.target.value)}
                  disabled={!canManage}
                >
                  <option value="junior">Junior</option>
                  <option value="senior">Senior</option>
                </select>
              </label>
              <label>
                <span>Track</span>
                <input
                  value={selectedOffering.track}
                  onChange={(event) => updateSelectedOffering("track", event.target.value)}
                  disabled={!canManage}
                />
              </label>
              <label>
                <span>Class teacher</span>
                <input
                  list="class-arm-staff-list"
                  value={selectedOffering.classTeacher}
                  onChange={(event) => updateSelectedOffering("classTeacher", event.target.value)}
                  disabled={!canManage}
                />
              </label>
              <label>
                <span>HOD</span>
                <input
                  list="class-arm-staff-list"
                  value={selectedOffering.hod}
                  onChange={(event) => updateSelectedOffering("hod", event.target.value)}
                  disabled={!canManage}
                />
              </label>
              <label>
                <span>Status</span>
                <select
                  value={selectedOffering.status ?? "active"}
                  onChange={(event) => updateSelectedOffering("status", event.target.value)}
                  disabled={!canManage}
                >
                  <option value="active">Active</option>
                  <option value="retired">Retired</option>
                </select>
              </label>
            </div>
            <div className="button-row">
              <button
                type="button"
                className="primary-button"
                disabled={!canManage || busyKey === `save:${selectedOffering.className}`}
                onClick={() => void saveSelectedOffering()}
              >
                {busyKey === `save:${selectedOffering.className}` ? "Saving..." : "Save class arm"}
              </button>
            </div>

            {(() => {
              const rows = offeringRows(selectedOffering.className);
              const assignedCount = rows.filter((assignment) => assignment.teacherAccountId).length;
              const electiveCount = rows.filter((assignment) => assignment.subjectType === "elective").length;

              return (
                <>
                  <div className="inline-metrics">
                    <div>
                      <span>Subject rows</span>
                      <strong>{rows.length}</strong>
                    </div>
                    <div>
                      <span>Assigned teachers</span>
                      <strong>{assignedCount}</strong>
                    </div>
                    <div>
                      <span>Electives</span>
                      <strong>{electiveCount}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{resultStatusLabel(selectedOffering.status ?? "active")}</strong>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th>Type</th>
                          <th>Teacher</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length > 0 ? (
                          rows.map((assignment) => (
                            <tr key={assignment.id}>
                              <td>
                                <strong>{assignment.subjectName}</strong>
                                <p className="muted">{assignment.subjectCode}</p>
                              </td>
                              <td>{resultStatusLabel(assignment.subjectType ?? "core")}</td>
                              <td>{assignment.teacherName ?? "Unassigned"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3}>No subject rows are attached to this arm yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="button-row">
                    <Link href="/dashboard/teacher-assignments" className="secondary-button">
                      Open teacher assignments
                    </Link>
                    <Link href="/dashboard/subject-registration" className="secondary-button">
                      Open subject registration
                    </Link>
                  </div>
                </>
              );
            })()}
          </article>
        ) : null}
      </section>
    </div>
  );
}
