import { AppShell } from "@/components/app-shell";
import { TeacherLeadershipReportsPanel } from "@/components/teacher-leadership-reports-panel";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { loadTeacherWorkspace } from "@/lib/teacher-workspace";

export const dynamic = "force-dynamic";

export default async function TeacherLeadershipPage() {
  const account = await getCurrentStaffAccount();

  if (!account) {
    return null;
  }

  const workspace = await loadTeacherWorkspace(account);

  return (
    <AppShell
      activeHref="/dashboard/teacher/leadership"
      eyebrow="Leadership Notes"
      title={`${account.fullName} account reports`}
      description="Notes posted by the registrar, principal, or school admin are separated here so they no longer compete with score entry or student support work."
    >
      <TeacherLeadershipReportsPanel reports={workspace.teacherPortalReports} />
    </AppShell>
  );
}
