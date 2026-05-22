"use client";

import { useMemo, useState } from "react";

import { resolveGrade } from "@/lib/calculations";
import type { GradeBand } from "@/lib/types";

interface GradeScalePanelProps {
  bands: GradeBand[];
}

export function GradeScalePanel({ bands }: GradeScalePanelProps) {
  const [gradeBands, setGradeBands] = useState(bands);
  const [previewScore, setPreviewScore] = useState(68);
  const previewBand = useMemo(() => resolveGrade(previewScore, gradeBands), [gradeBands, previewScore]);

  function updateBand(index: number, field: "min" | "max", value: string) {
    setGradeBands((current) =>
      current.map((band, bandIndex) =>
        bandIndex === index ? { ...band, [field]: Number(value) || 0 } : band,
      ),
    );
  }

  function updateRemark(index: number, remark: string) {
    setGradeBands((current) =>
      current.map((band, bandIndex) => (bandIndex === index ? { ...band, remark } : band)),
    );
  }

  return (
    <div className="grid-layout two-wide">
      <section className="surface-card span-two">
        <div className="section-head">
          <div>
            <p className="eyebrow">Grading Policy</p>
            <h3>Adjust grade boundaries</h3>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Grade</th>
                <th>Minimum</th>
                <th>Maximum</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {gradeBands.map((band, index) => (
                <tr key={band.id}>
                  <td>
                    <span className="grade-badge" style={{ borderColor: band.color, color: band.color }}>
                      {band.label}
                    </span>
                  </td>
                  <td>
                    <input
                      type="number"
                      value={band.min}
                      onChange={(event) => updateBand(index, "min", event.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={band.max}
                      onChange={(event) => updateBand(index, "max", event.target.value)}
                    />
                  </td>
                  <td>
                    <input value={band.remark} onChange={(event) => updateRemark(index, event.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card">
        <p className="eyebrow">Preview</p>
        <h3>What does {previewScore}% become?</h3>
        <div className="preview-grade">
          <span className="grade-badge large" style={{ borderColor: previewBand.color, color: previewBand.color }}>
            {previewBand.label}
          </span>
          <div>
            <strong>{previewBand.remark}</strong>
            <p className="muted">
              Scores between {previewBand.min} and {previewBand.max} currently map to this grade.
            </p>
          </div>
        </div>
        <label>
          <span>Preview score</span>
          <input
            type="range"
            min={0}
            max={100}
            value={previewScore}
            onChange={(event) => setPreviewScore(Number(event.target.value))}
          />
        </label>
      </section>

      <section className="surface-card">
        <p className="eyebrow">Governance</p>
        <h3>Why this matters</h3>
        <p className="muted">
          Grade scaling lives at the principal level so teachers can score freely while school-wide grading policy remains centralized and auditable.
        </p>
      </section>
    </div>
  );
}
