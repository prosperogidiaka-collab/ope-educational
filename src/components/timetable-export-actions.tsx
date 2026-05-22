"use client";

import { useState } from "react";

import type { TimetableDay, TimetableEntry, TimetablePeriod } from "@/lib/types";

const TIMETABLE_DAYS: TimetableDay[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_ORDER = new Map(TIMETABLE_DAYS.map((day, index) => [day, index]));

interface TimetableExportActionsProps {
  schoolName: string;
  title: string;
  subtitle: string;
  fileStem: string;
  periods: TimetablePeriod[];
  pdfEntries: TimetableEntry[];
  excelEntries?: TimetableEntry[];
  showExcel?: boolean;
  pdfLabel?: string;
  excelLabel?: string;
}

function sanitizeFileSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "timetable";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sortTimetableEntries(entries: TimetableEntry[], periods: TimetablePeriod[]) {
  const periodOrder = new Map(periods.map((period, index) => [period.id, index]));

  return [...entries].sort((left, right) => {
    const dayCompare = (DAY_ORDER.get(left.day) ?? 99) - (DAY_ORDER.get(right.day) ?? 99);
    if (dayCompare !== 0) {
      return dayCompare;
    }

    const leftPeriod = periodOrder.get(left.periodId) ?? 999;
    const rightPeriod = periodOrder.get(right.periodId) ?? 999;
    if (leftPeriod !== rightPeriod) {
      return leftPeriod - rightPeriod;
    }

    const classCompare = left.className.localeCompare(right.className);
    if (classCompare !== 0) {
      return classCompare;
    }

    const armCompare = left.arm.localeCompare(right.arm);
    if (armCompare !== 0) {
      return armCompare;
    }

    const subjectCompare = left.subjectName.localeCompare(right.subjectName);
    if (subjectCompare !== 0) {
      return subjectCompare;
    }

    return left.teacherName.localeCompare(right.teacherName);
  });
}

function rowsForTemplate(entries: TimetableEntry[], periods: TimetablePeriod[]) {
  const periodById = new Map(periods.map((period) => [period.id, period]));

  return [
    [
      "Day",
      "Period Label",
      "Start Time",
      "End Time",
      "Teacher Name",
      "Subject Name",
      "Class",
      "Arm",
      "Track",
      "Room",
    ],
    ...sortTimetableEntries(entries, periods).map((entry) => {
      const matchedPeriod = periodById.get(entry.periodId);

      return [
        entry.day,
        matchedPeriod?.label ?? entry.periodLabel,
        matchedPeriod?.startTime ?? entry.startTime,
        matchedPeriod?.endTime ?? entry.endTime,
        entry.teacherName,
        entry.subjectName,
        entry.baseClassName || entry.className,
        entry.arm,
        entry.track ?? "",
        entry.room ?? "",
      ];
    }),
  ];
}

function buildPrintableHtml({
  schoolName,
  title,
  subtitle,
  periods,
  entries,
}: {
  schoolName: string;
  title: string;
  subtitle: string;
  periods: TimetablePeriod[];
  entries: TimetableEntry[];
}) {
  const entryMap = new Map<string, TimetableEntry[]>();

  entries.forEach((entry) => {
    const key = `${entry.day}-${entry.periodId}`;
    const current = entryMap.get(key) ?? [];
    current.push(entry);
    entryMap.set(key, current);
  });

  const tableRows = periods
    .map((period) => {
      const cells = TIMETABLE_DAYS.map((day) => {
        const cellEntries = entryMap.get(`${day}-${period.id}`) ?? [];

        if (cellEntries.length === 0) {
          return `<td><span class="free-pill">Free</span></td>`;
        }

        const cards = cellEntries
          .map(
            (entry) => `
              <div class="cell-card">
                <strong>${escapeHtml(entry.subjectName)}</strong>
                <span>${escapeHtml(entry.teacherName)}</span>
                <span>${escapeHtml(entry.baseClassName || entry.className)} - ${escapeHtml(entry.arm)}${entry.track ? ` - ${escapeHtml(entry.track)}` : ""}</span>
                ${entry.room ? `<span>${escapeHtml(entry.room)}</span>` : ""}
              </div>
            `,
          )
          .join("");

        return `<td><div class="cell-stack">${cards}</div></td>`;
      }).join("");

      return `
        <tr>
          <td class="period-col">
            <strong>${escapeHtml(period.label)}</strong>
            <span>${escapeHtml(period.startTime)} - ${escapeHtml(period.endTime)}</span>
          </td>
          ${cells}
        </tr>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          :root {
            color-scheme: light;
            --paper: #ffffff;
            --ink: #1e293b;
            --muted: #64748b;
            --line: #e2e8f0;
            --line-strong: #bfdbfe;
            --sky: #e6f4ff;
            --blue-soft: #dbeafe;
            --cyan-soft: #e0f2fe;
            --accent: #2563eb;
            --accent-deep: #1e40af;
            --accent-fun: #0d9488;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 22px;
            color: var(--ink);
            background:
              radial-gradient(circle at top right, rgba(96, 165, 250, 0.2), transparent 30%),
              radial-gradient(circle at top left, rgba(13, 148, 136, 0.08), transparent 28%),
              linear-gradient(180deg, #e6f4ff 0%, #f8fafc 100%);
            font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
          }

          .sheet {
            max-width: 1180px;
            margin: 0 auto;
            padding: 24px;
            border: 1px solid var(--line);
            border-radius: 24px;
            background: var(--paper);
            box-shadow: 0 18px 48px rgba(37, 99, 235, 0.12);
          }

          .head {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
            margin-bottom: 18px;
            padding-bottom: 14px;
            border-bottom: 1px solid var(--line);
          }

          .eyebrow {
            margin: 0 0 6px;
            color: var(--accent);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
          }

          h1 {
            margin: 0 0 6px;
            font-size: 28px;
            line-height: 1.1;
          }

          p {
            margin: 0;
          }

          .muted {
            color: var(--muted);
          }

          .meta {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            border: 1px solid var(--line);
            border-radius: 999px;
            background: linear-gradient(135deg, rgba(230, 244, 255, 0.98), rgba(219, 234, 254, 0.74));
            color: var(--accent-deep);
            font-size: 12px;
            font-weight: 700;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th,
          td {
            border: 1px solid var(--line);
            vertical-align: top;
            text-align: left;
          }

          th {
            padding: 12px;
            background: linear-gradient(180deg, rgba(230, 244, 255, 0.98), rgba(219, 234, 254, 0.82));
            color: var(--accent-deep);
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          td {
            padding: 12px;
            font-size: 13px;
          }

          .period-col {
            width: 150px;
            background: linear-gradient(180deg, rgba(230, 244, 255, 0.92), rgba(224, 242, 254, 0.6));
          }

          .period-col strong,
          .period-col span {
            display: block;
          }

          .period-col span {
            margin-top: 4px;
            color: var(--muted);
            font-size: 12px;
          }

          .cell-stack {
            display: grid;
            gap: 8px;
          }

          .cell-card {
            display: grid;
            gap: 4px;
            padding: 10px 11px;
            border: 1px solid var(--line-strong);
            border-radius: 14px;
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(230, 244, 255, 0.7));
          }

          .cell-card strong {
            font-size: 13px;
          }

          .cell-card span {
            color: var(--muted);
            font-size: 12px;
            line-height: 1.35;
          }

          .free-pill {
            display: inline-flex;
            align-items: center;
            padding: 5px 10px;
            border-radius: 999px;
            background: rgba(224, 242, 254, 0.92);
            color: var(--accent-fun);
            font-size: 12px;
            font-weight: 700;
          }

          .foot {
            margin-top: 14px;
            color: var(--muted);
            font-size: 12px;
          }

          @media print {
            @page {
              size: A4 landscape;
              margin: 10mm;
            }

            body {
              padding: 0;
              background: #ffffff;
            }

            .sheet {
              border: none;
              border-radius: 0;
              box-shadow: none;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="head">
            <div>
              <p class="eyebrow">${escapeHtml(schoolName)}</p>
              <h1>${escapeHtml(title)}</h1>
              <p class="muted">${escapeHtml(subtitle)}</p>
            </div>
            <div class="meta">Generated ${escapeHtml(new Date().toLocaleString())}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Period</th>
                ${TIMETABLE_DAYS.map((day) => `<th>${escapeHtml(day)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <p class="foot">Use your browser print dialog and choose "Save as PDF" to download this timetable.</p>
        </div>
        <script>
          window.addEventListener("load", () => {
            window.setTimeout(() => {
              window.print();
            }, 200);
          });
        </script>
      </body>
    </html>
  `;
}

export function TimetableExportActions({
  schoolName,
  title,
  subtitle,
  fileStem,
  periods,
  pdfEntries,
  excelEntries,
  showExcel = false,
  pdfLabel = "Print / Save as PDF",
  excelLabel = "Download Excel",
}: TimetableExportActionsProps) {
  const [status, setStatus] = useState("");
  const safeFileStem = sanitizeFileSegment(fileStem);
  const exportRows = excelEntries ?? pdfEntries;

  function exportPdf() {
    try {
      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        throw new Error("Allow pop-ups in your browser to open the timetable PDF view.");
      }

      printWindow.document.open();
      printWindow.document.write(
        buildPrintableHtml({
          schoolName,
          title,
          subtitle,
          periods,
          entries: pdfEntries,
        }),
      );
      printWindow.document.close();
      setStatus("Opened the timetable print view. Choose Save as PDF in the dialog to download it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open the PDF export right now.");
    }
  }

  async function exportExcel() {
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(rowsForTemplate(exportRows, periods));
      XLSX.utils.book_append_sheet(workbook, worksheet, "Timetable");
      XLSX.writeFile(workbook, `${safeFileStem}.xlsx`);
      setStatus("Downloaded the current timetable in the same Excel template format used for re-upload.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not export the Excel timetable right now.");
    }
  }

  return (
    <div className="stack-list compact">
      <div className="button-row">
        <button type="button" className="secondary-button" onClick={exportPdf} disabled={periods.length === 0}>
          {pdfLabel}
        </button>
        {showExcel ? (
          <button type="button" className="secondary-button" onClick={() => void exportExcel()}>
            {excelLabel}
          </button>
        ) : null}
      </div>
      {status ? <p className="muted export-feedback">{status}</p> : null}
    </div>
  );
}
