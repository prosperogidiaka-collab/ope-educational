import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/metric-card";
import { SessionRolloverBoard } from "@/components/session-rollover-board";
import { isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { readAcademicConfig } from "@/lib/academic-config-store";
import { readAllClassOfferings, readClassOfferings } from "@/lib/class-offerings-store";
import { readPromotionQueue } from "@/lib/promotion-queue-store";
import { readSessionRolloverRecords } from "@/lib/session-rollover-store";

export const dynamic = "force-dynamic";

function nextSessionLabel(session: string) {
  const match = session.match(/^(\d{4})\/(\d{4})$/);

  if (!match) {
    return `${session} Next Session`;
  }

  return `${Number(match[1]) + 1}/${Number(match[2]) + 1}`;
}

export default async function SessionRolloverPage() {
  const currentAccount = await getCurrentStaffAccount();
  const config = await readAcademicConfig();
  const nextSession = nextSessionLabel(config.session);
  const [offerings, allOfferings, queue, records] = await Promise.all([
    readClassOfferings(),
    readAllClassOfferings(),
    readPromotionQueue(),
    readSessionRolloverRecords(),
  ]);
  const nextSessionOfferings = allOfferings.filter((offering) => offering.session === nextSession);
  const readyCount = queue.filter((candidate) => candidate.status === "ready").length;
  const holdCount = queue.length - readyCount;
  const archivedCount = offerings.filter((offering) => offering.status === "retired").length;
  const canManage = Boolean(
    currentAccount &&
      (isSchoolAdminRole(currentAccount.role) ||
        currentAccount.role === "registrar" ||
        currentAccount.canRegisterStudents),
  );

  return (
    <AppShell
      activeHref="/dashboard/session-rollover"
      eyebrow="Session Rollover"
      title={`${config.session} to ${nextSession} promotion desk`}
      description="Prepare next-session structure, archive obsolete arms, and keep a live promotion queue without rebuilding the school structure manually."
    >
      <section className="metric-grid compact">
        <MetricCard label="Current session" value={config.session} helper={`${config.term} is still the live workflow`} />
        <MetricCard label="Next session" value={nextSession} helper="Target session for rollover preparation" />
        <MetricCard label="Ready for promotion" value={`${readyCount}`} helper="Students already clear for movement" />
        <MetricCard label="On hold" value={`${holdCount}`} helper="Students still waiting for review or correction" />
        <MetricCard label="Prepared arms" value={`${nextSessionOfferings.length}`} helper="Class arms already copied into the next session" />
        <MetricCard label="Archived current arms" value={`${archivedCount}`} helper="Current-session arms already retired from active use" />
      </section>

      <SessionRolloverBoard
        currentSession={config.session}
        nextSession={nextSession}
        offerings={offerings}
        nextSessionOfferings={nextSessionOfferings}
        queue={queue}
        records={records}
        canManage={canManage}
      />
    </AppShell>
  );
}
