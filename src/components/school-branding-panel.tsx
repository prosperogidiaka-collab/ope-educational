"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buildInlineAttachmentPayload } from "@/lib/file-attachments";
import type { SchoolProfile } from "@/lib/types";

interface SchoolBrandingPanelProps {
  school: SchoolProfile;
  canManage: boolean;
}

export function SchoolBrandingPanel({ school, canManage }: SchoolBrandingPanelProps) {
  const router = useRouter();
  const [localSchool, setLocalSchool] = useState(school);
  const [feedback, setFeedback] = useState(
    "Upload the live school logo here. The saved branding will appear across the dashboard, student portal, and printed result outputs.",
  );
  const [busy, setBusy] = useState(false);

  async function loadLogo(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const payload = await buildInlineAttachmentPayload(file);
      setLocalSchool((current) => ({
        ...current,
        logoUrl: payload.url,
      }));
      setFeedback("Loaded a new school logo preview. Save it to make the change live across the app.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not load that school logo right now.");
    }
  }

  async function saveBranding() {
    setBusy(true);

    try {
      const response = await fetch("/api/school-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: localSchool.logoUrl,
        }),
      });
      const payload = (await response.json()) as { error?: string; school?: SchoolProfile };

      if (!response.ok || !payload.school) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalSchool(payload.school);
      setFeedback(`Saved the live school logo for ${payload.school.name}. The refreshed branding is now active.`);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save the school logo right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">School Branding</p>
          <h3>Upload the live school logo</h3>
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={!canManage || busy}
          onClick={() => void saveBranding()}
        >
          {busy ? "Saving..." : "Save logo"}
        </button>
      </div>

      <div className="callout-banner">
        <strong>{feedback}</strong>
        <p className="muted">
          This logo is used in the dashboard shell, student portal, broadsheet header, and report-sheet output.
        </p>
      </div>

      <div className="profile-media-workbench">
        <div className="profile-media-panel">
          <div className="brand-logo-preview">
            <img src={localSchool.logoUrl} alt={`${localSchool.name} logo`} className="brand-logo-preview-image" />
          </div>
          <p className="muted profile-photo-caption">
            Current logo for {localSchool.name}. Upload a clear square or landscape image for best results.
          </p>
          <label>
            <span>Choose school logo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => void loadLogo(event.target.files?.[0] ?? null)}
              disabled={!canManage || busy}
            />
          </label>
        </div>

        <div className="profile-media-panel">
          <div className="stack-list compact">
            <div className="comparison-card">
              <span>School name</span>
              <strong>{localSchool.name}</strong>
            </div>
            <div className="comparison-card">
              <span>School code</span>
              <strong>{localSchool.schoolCode}</strong>
            </div>
            <div className="comparison-card">
              <span>Portal slug</span>
              <strong>{localSchool.portalSlug}</strong>
            </div>
            <div className="comparison-card">
              <span>Current term</span>
              <strong>
                {localSchool.session} - {localSchool.term}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
