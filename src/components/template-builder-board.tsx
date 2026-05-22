"use client";

import { useState, type ChangeEvent, type DragEvent } from "react";

import { ReportSheetView, academicColumnLabels } from "@/components/report-sheet-view";
import type { ResultSheetDraft } from "@/lib/report-sheet";
import { cloneTemplateSchema } from "@/lib/template-workspace";
import type {
  AcademicConfig,
  ResultTemplateSchema,
  ResultTemplateWorkspace,
  TemplateAcademicColumn,
  TemplateZoneId,
} from "@/lib/types";

interface TemplateBuilderBoardProps {
  initialWorkspace: ResultTemplateWorkspace;
  sampleDraft: ResultSheetDraft;
  academicConfig?: AcademicConfig;
}

const academicColumns: TemplateAcademicColumn[] = [
  "test1",
  "test2",
  "exam",
  "total",
  "grade",
  "subjectPosition",
  "classAverage",
  "classHighest",
  "classLowest",
  "teacherRemark",
];

const zoneLabels: Record<TemplateZoneId, string> = {
  header: "Header",
  student_bio: "Student Bio-Data",
  academic_table: "Academic Table",
  qualitative: "Qualitative Section",
  remarks: "Remarks and Notes",
  signatures: "Signature Block",
  verification: "Verification QR",
};

export function TemplateBuilderBoard({
  initialWorkspace,
  sampleDraft,
  academicConfig,
}: TemplateBuilderBoardProps) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [message, setMessage] = useState(
    initialWorkspace.status === "locked"
      ? initialWorkspace.lockedReason ?? "Live template is locked for the current term."
      : "Adjust the draft template and publish it when you are ready.",
  );
  const [draggingZone, setDraggingZone] = useState<TemplateZoneId | null>(null);
  const draftSchema = workspace.draftSchema;

  function updateDraftSchema(mutator: (schema: ResultTemplateSchema) => ResultTemplateSchema) {
    setWorkspace((current) => ({
      ...current,
      draftSchema: mutator(current.draftSchema),
    }));
    setMessage("Draft template changed. Save draft to keep this configuration.");
  }

  async function persistWorkspace(nextWorkspace: ResultTemplateWorkspace, successMessage: string) {
    await fetch("/api/template-workspace", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(nextWorkspace),
    });
    setWorkspace(nextWorkspace);
    setMessage(successMessage);
  }

  async function saveDraft() {
    const nextWorkspace = {
      ...workspace,
      updatedAt: new Date().toISOString(),
    };

    await persistWorkspace(nextWorkspace, "Draft template saved. Preview remains available for the school admin.");
  }

  async function makeLive() {
    if (workspace.status === "locked") {
      setMessage(workspace.lockedReason ?? "The live template is locked because this term already has published results.");
      return;
    }

    const nextWorkspace = {
      ...workspace,
      liveSchema: cloneTemplateSchema(workspace.draftSchema),
      status: "live" as const,
      updatedAt: new Date().toISOString(),
    };

    await persistWorkspace(nextWorkspace, "Live template updated. New result sheets will use this schema.");
  }

  function applyStarterTemplate(templateId: string) {
    const starter = workspace.starterTemplates.find((item) => item.id === templateId);

    if (!starter) {
      return;
    }

    updateDraftSchema(() => cloneTemplateSchema(starter));
    setMessage(`${starter.name} loaded into draft mode. You can now drag, toggle, and upload assets.`);
  }

  function toggleAcademicColumn(column: TemplateAcademicColumn) {
    updateDraftSchema((schema) => {
      const hasColumn = schema.academicTable.columns.includes(column);
      const nextColumns = hasColumn
        ? schema.academicTable.columns.filter((item) => item !== column)
        : [...schema.academicTable.columns, column];

      return {
        ...schema,
        academicTable: {
          ...schema.academicTable,
          columns: nextColumns,
        },
      };
    });
  }

  function toggleZone(zone: TemplateZoneId) {
    if (zone === "verification") {
      setMessage("Verification QR is always present for anti-fraud protection.");
      return;
    }

    updateDraftSchema((schema) => {
      const exists = schema.zones.includes(zone);
      const nextZones = exists ? schema.zones.filter((item) => item !== zone) : [...schema.zones, zone];

      return {
        ...schema,
        zones: nextZones,
      };
    });
  }

  function handleZoneDrop(targetZone: TemplateZoneId) {
    if (!draggingZone || draggingZone === targetZone) {
      return;
    }

    updateDraftSchema((schema) => {
      const nextZones = [...schema.zones];
      const sourceIndex = nextZones.indexOf(draggingZone);
      const targetIndex = nextZones.indexOf(targetZone);

      if (sourceIndex < 0 || targetIndex < 0) {
        return schema;
      }

      const [moved] = nextZones.splice(sourceIndex, 1);
      nextZones.splice(targetIndex, 0, moved);

      return {
        ...schema,
        zones: nextZones,
      };
    });
    setDraggingZone(null);
    setMessage("Layout zone order updated in draft mode.");
  }

  async function uploadAsset(
    event: ChangeEvent<HTMLInputElement>,
    target:
      | "header.logoUrl"
      | "header.governmentStampUrl"
      | "watermark.imageUrl"
      | "signatures.classTeacherSignatureUrl"
      | "signatures.principalSignatureUrl",
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const fileDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    updateDraftSchema((schema) => {
      if (target === "header.logoUrl") {
        return {
          ...schema,
          header: {
            ...schema.header,
            logoUrl: fileDataUrl,
          },
        };
      }

      if (target === "header.governmentStampUrl") {
        return {
          ...schema,
          header: {
            ...schema.header,
            governmentStampUrl: fileDataUrl,
          },
        };
      }

      if (target === "watermark.imageUrl") {
        return {
          ...schema,
          watermark: {
            ...schema.watermark,
            imageUrl: fileDataUrl,
          },
        };
      }

      if (target === "signatures.classTeacherSignatureUrl") {
        return {
          ...schema,
          signatures: {
            ...schema.signatures,
            classTeacherSignatureUrl: fileDataUrl,
          },
        };
      }

      return {
        ...schema,
        signatures: {
          ...schema.signatures,
          principalSignatureUrl: fileDataUrl,
        },
      };
    });

    event.target.value = "";
  }

  return (
    <div className="template-builder-layout">
      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Template Studio</p>
            <h3>WYSIWYG result builder</h3>
          </div>
          <div className="button-row">
            <span className={`status-pill status-${workspace.status === "locked" ? "locked" : "approved"}`}>
              {workspace.status === "locked" ? "Live Template Locked" : "Live Template Editable"}
            </span>
            <button type="button" className="secondary-button" onClick={() => void saveDraft()}>
              Save as Draft
            </button>
            <button type="button" className="primary-button" onClick={() => void makeLive()}>
              Make Live
            </button>
          </div>
        </div>

        <div className="callout-banner">
          <strong>{message}</strong>
          <p className="muted">
            The right panel always shows a real report preview. Verification stays present even when other blocks move.
          </p>
        </div>

        <div className="stack-list">
          <article className="editor-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Starter Templates</p>
                <h3>Executive, Traditional, and Minimalist</h3>
              </div>
            </div>
            <div className="stack-list compact">
              {workspace.starterTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={draftSchema.id === template.id ? "selection-card active" : "selection-card"}
                  onClick={() => applyStarterTemplate(template.id)}
                >
                  <strong>{template.name}</strong>
                  <p>{template.summary}</p>
                </button>
              ))}
            </div>
          </article>

          <article className="editor-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Layout Zones</p>
                <h3>Drag blocks and toggle visibility</h3>
              </div>
            </div>
            <div className="stack-list compact">
              {(Object.keys(zoneLabels) as TemplateZoneId[]).map((zone) => {
                const enabled = draftSchema.zones.includes(zone);

                return (
                  <div
                    key={zone}
                    className={enabled ? "template-zone-card active" : "template-zone-card"}
                    draggable={enabled}
                    onDragStart={() => setDraggingZone(zone)}
                    onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
                    onDrop={() => handleZoneDrop(zone)}
                  >
                    <div>
                      <strong>{zoneLabels[zone]}</strong>
                      <p className="muted">{zone === "verification" ? "Always active for verification." : "Drag to reorder in the live layout."}</p>
                    </div>
                    <button type="button" className="secondary-button compact-button" onClick={() => toggleZone(zone)}>
                      {enabled ? "On" : "Off"}
                    </button>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="editor-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Visual Styling</p>
                <h3>Brand identity controls</h3>
              </div>
            </div>
            <div className="form-grid compact-grid">
              <label>
                Primary color
                <input
                  type="color"
                  value={draftSchema.primaryColor}
                  onChange={(event) =>
                    updateDraftSchema((schema) => ({
                      ...schema,
                      primaryColor: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Typography
                <select
                  value={draftSchema.fontFamily}
                  onChange={(event) =>
                    updateDraftSchema((schema) => ({
                      ...schema,
                      fontFamily: event.target.value as ResultTemplateSchema["fontFamily"],
                    }))
                  }
                >
                  <option value="Inter">Inter</option>
                  <option value="Montserrat">Montserrat</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Playfair Display">Playfair Display</option>
                </select>
              </label>
              <label>
                Border style
                <select
                  value={draftSchema.borderStyle}
                  onChange={(event) =>
                    updateDraftSchema((schema) => ({
                      ...schema,
                      borderStyle: event.target.value as ResultTemplateSchema["borderStyle"],
                    }))
                  }
                >
                  <option value="executive">Executive</option>
                  <option value="traditional">Traditional</option>
                  <option value="minimalist">Minimalist</option>
                </select>
              </label>
              <label>
                Logo position
                <select
                  value={draftSchema.header.logoPosition}
                  onChange={(event) =>
                    updateDraftSchema((schema) => ({
                      ...schema,
                      header: {
                        ...schema.header,
                        logoPosition: event.target.value as ResultTemplateSchema["header"]["logoPosition"],
                      },
                    }))
                  }
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
          </article>

          <article className="editor-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Header and Assets</p>
                <h3>Uploaded logo, stamp, signatures, and watermark</h3>
              </div>
            </div>
            <div className="form-grid compact-grid">
              <label>
                <span>Upload school logo</span>
                <input type="file" accept="image/*" onChange={(event) => void uploadAsset(event, "header.logoUrl")} />
              </label>
              <label>
                <span>Upload government stamp</span>
                <input type="file" accept="image/*" onChange={(event) => void uploadAsset(event, "header.governmentStampUrl")} />
              </label>
              <label>
                <span>Upload watermark logo</span>
                <input type="file" accept="image/*" onChange={(event) => void uploadAsset(event, "watermark.imageUrl")} />
              </label>
              <label>
                <span>Upload class teacher signature</span>
                <input type="file" accept="image/png,image/*" onChange={(event) => void uploadAsset(event, "signatures.classTeacherSignatureUrl")} />
              </label>
              <label>
                <span>Upload principal signature</span>
                <input type="file" accept="image/png,image/*" onChange={(event) => void uploadAsset(event, "signatures.principalSignatureUrl")} />
              </label>
            </div>
            <div className="form-grid compact-grid">
              <label>
                <span>
                  <input
                    type="checkbox"
                    checked={draftSchema.header.showSchoolName}
                    onChange={(event) =>
                      updateDraftSchema((schema) => ({
                        ...schema,
                        header: { ...schema.header, showSchoolName: event.target.checked },
                      }))
                    }
                  />
                  Show school name
                </span>
              </label>
              <label>
                <span>
                  <input
                    type="checkbox"
                    checked={draftSchema.header.showAddress}
                    onChange={(event) =>
                      updateDraftSchema((schema) => ({
                        ...schema,
                        header: { ...schema.header, showAddress: event.target.checked },
                      }))
                    }
                  />
                  Show address
                </span>
              </label>
              <label>
                <span>
                  <input
                    type="checkbox"
                    checked={draftSchema.header.showSchoolCode}
                    onChange={(event) =>
                      updateDraftSchema((schema) => ({
                        ...schema,
                        header: { ...schema.header, showSchoolCode: event.target.checked },
                      }))
                    }
                  />
                  Show school code
                </span>
              </label>
              <label>
                <span>
                  <input
                    type="checkbox"
                    checked={draftSchema.header.showGovernmentStamp}
                    onChange={(event) =>
                      updateDraftSchema((schema) => ({
                        ...schema,
                        header: { ...schema.header, showGovernmentStamp: event.target.checked },
                      }))
                    }
                  />
                  Show government stamp
                </span>
              </label>
            </div>
          </article>

          <article className="editor-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Academic Table</p>
                <h3>Choose visible score columns</h3>
              </div>
            </div>
            <div className="form-grid compact-grid">
              {academicColumns.map((column) => (
                <label key={column}>
                  <span>
                    <input
                      type="checkbox"
                      checked={draftSchema.academicTable.columns.includes(column)}
                      onChange={() => toggleAcademicColumn(column)}
                    />
                    {academicColumnLabels[column]}
                  </span>
                </label>
              ))}
            </div>
          </article>

          <article className="editor-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Qualitative and Smart Logic</p>
                <h3>Toggle behaviour, skills, legends, and terms</h3>
              </div>
            </div>
            <div className="form-grid compact-grid">
              <label>
                <span>
                  <input
                    type="checkbox"
                    checked={draftSchema.qualitative.showAffective}
                    onChange={(event) =>
                      updateDraftSchema((schema) => ({
                        ...schema,
                        qualitative: { ...schema.qualitative, showAffective: event.target.checked },
                      }))
                    }
                  />
                  Show affective domain
                </span>
              </label>
              <label>
                <span>
                  <input
                    type="checkbox"
                    checked={draftSchema.qualitative.showPsychomotor}
                    onChange={(event) =>
                      updateDraftSchema((schema) => ({
                        ...schema,
                        qualitative: { ...schema.qualitative, showPsychomotor: event.target.checked },
                      }))
                    }
                  />
                  Show psychomotor
                </span>
              </label>
              <label>
                <span>
                  <input
                    type="checkbox"
                    checked={draftSchema.controls.showGradingLegend}
                    onChange={(event) =>
                      updateDraftSchema((schema) => ({
                        ...schema,
                        controls: { ...schema.controls, showGradingLegend: event.target.checked },
                      }))
                    }
                  />
                  Show grading legend
                </span>
              </label>
              <label>
                <span>
                  <input
                    type="checkbox"
                    checked={draftSchema.controls.showTrendAnalysis}
                    onChange={(event) =>
                      updateDraftSchema((schema) => ({
                        ...schema,
                        controls: { ...schema.controls, showTrendAnalysis: event.target.checked },
                      }))
                    }
                  />
                  Show previous term trend
                </span>
              </label>
            </div>
            <div className="form-grid compact-grid">
              <label>
                Term label
                <input
                  value={draftSchema.terminology.termLabel}
                  onChange={(event) =>
                    updateDraftSchema((schema) => ({
                      ...schema,
                      terminology: { ...schema.terminology, termLabel: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                Teacher remark label
                <input
                  value={draftSchema.terminology.teacherRemarkLabel}
                  onChange={(event) =>
                    updateDraftSchema((schema) => ({
                      ...schema,
                      terminology: { ...schema.terminology, teacherRemarkLabel: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                Class teacher label
                <input
                  value={draftSchema.terminology.classTeacherRemarkLabel}
                  onChange={(event) =>
                    updateDraftSchema((schema) => ({
                      ...schema,
                      terminology: { ...schema.terminology, classTeacherRemarkLabel: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                Principal label
                <input
                  value={draftSchema.terminology.principalRemarkLabel}
                  onChange={(event) =>
                    updateDraftSchema((schema) => ({
                      ...schema,
                      terminology: { ...schema.terminology, principalRemarkLabel: event.target.value },
                    }))
                  }
                />
              </label>
            </div>
          </article>
        </div>
      </section>

      <section className="surface-card template-preview-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Live Preview</p>
            <h3>{draftSchema.name} draft preview</h3>
          </div>
          <span className="status-pill status-approved">Sample data preview</span>
        </div>
        <ReportSheetView
          draft={sampleDraft}
          templateSchema={draftSchema}
          showActions={false}
          academicConfig={academicConfig}
        />
      </section>
    </div>
  );
}
