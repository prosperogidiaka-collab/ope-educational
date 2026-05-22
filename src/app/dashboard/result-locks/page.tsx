import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { ResultLocksPanel } from "@/components/governance-panels";
import { readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { readResultLocks } from "@/lib/result-locks-store";

export const dynamic = "force-dynamic";

export default async function ResultLocksPage() {
  const [resultLocks, currentAccount, school] = await Promise.all([
    readResultLocks(),
    getCurrentStaffAccount(),
    readRuntimeSchoolProfile(),
  ]);
  const lockedCount = resultLocks.filter((lock) => lock.locked).length;
  const openCount = resultLocks.length - lockedCount;
  const lastAction = [...resultLocks].sort((left, right) => {
    const leftStamp = left.lockedAt ?? left.unlockedAt ?? "";
    const rightStamp = right.lockedAt ?? right.unlockedAt ?? "";
    return new Date(rightStamp).getTime() - new Date(leftStamp).getTime();
  })[0];
  const canManage = currentAccount?.role ? isSchoolAdminRole(currentAccount.role) : false;

  return (
    <AppShell
      activeHref="/dashboard/result-locks"
      eyebrow="Result Locks"
      title={`${school.term} locking desk`}
      description="Control when teachers can still touch raw scores and when broadsheets, reports, and portal results should stay frozen."
    >
      <section className="metric-grid compact">
        <MetricCard label="Class arms" value={`${resultLocks.length}`} helper="Lock rows being tracked for this term" />
        <MetricCard label="Locked" value={`${lockedCount}`} helper="Teacher edits are blocked for these classes" />
        <MetricCard label="Open" value={`${openCount}`} helper="Assigned teachers can still edit score sheets" />
        <MetricCard
          label="Latest action"
          value={lastAction?.className ?? "None"}
          helper={lastAction?.locked ? "Most recent lock control is a freeze" : "Most recent lock control is a reopen"}
        />
      </section>

      <ResultLocksPanel resultLocks={resultLocks} canManage={canManage} />

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Lock Policy</p>
              <h3>What locking affects immediately</h3>
            </div>
          </div>
          <div className="stack-list">
            <div className="flow-step">
              <strong>Teacher desk</strong>
              <p>Assigned teachers can still open the sheet, but editing is blocked until the class is reopened.</p>
            </div>
            <div className="flow-step">
              <strong>Broadsheet and reports</strong>
              <p>Printed and on-screen result views continue to read the saved live scores without waiting for a manual refresh cycle.</p>
            </div>
            <div className="flow-step">
              <strong>School-admin override</strong>
              <p>School admin can still enter controlled correction edits from the score override desk when a class is already locked.</p>
            </div>
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Related Controls</p>
              <h3>Check these before freezing a class</h3>
            </div>
          </div>
          <div className="stack-list">
            <Link href="/dashboard/score-review" className="selection-card">
              <strong>Score review</strong>
              <p>Review submitted sheets, anomalies, and approval notes before locking.</p>
            </Link>
            <Link href="/dashboard/score-overrides" className="selection-card">
              <strong>Score overrides</strong>
              <p>Use school-admin edits for controlled corrections after teacher submission.</p>
            </Link>
            <Link href="/dashboard/broadsheet" className="selection-card">
              <strong>Broadsheet</strong>
              <p>Print the final class summary after review and lock checks are complete.</p>
            </Link>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
