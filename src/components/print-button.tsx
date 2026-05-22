"use client";

export function PrintButton() {
  function handlePrint() {
    // The report card is rendered server-side and is already in the DOM (#print-area),
    // so we just hand off to the browser's print dialog. A double rAF lets layout
    // settle (web fonts, images) before the print snapshot is taken.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  return (
    <button type="button" className="primary-button print-button no-print" onClick={handlePrint}>
      Print / Save as PDF
    </button>
  );
}
