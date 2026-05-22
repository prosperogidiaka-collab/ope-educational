import { AppShell } from "@/components/app-shell";
import { TeacherAssignmentDesk } from "@/components/teacher-assignment-desk";
import { getCurrentStaffAccount } from "@/lib/auth-server";
import { loadTeacherWorkspace } from "@/lib/teacher-workspace";

export const dynamic = "force-dynamic";

interface TeacherAssignmentsPageProps {
  searchParams?: Promise<{
    assignment?: string | string[];
  }>;
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function TeacherAssignmentsPage({ searchParams }: TeacherAssignmentsPageProps) {
  const account = await getCurrentStaffAccount();

  if (!account) {
    return null;
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const assignmentQuery = firstParam(resolvedSearchParams?.assignment);
  const workspace = await loadTeacherWorkspace(account, assignmentQuery);

  return (
    <AppShell
      activeHref="/dashboard/teacher/assignments"
      eyebrow="Teacher Assignments"
      title={`${account.fullName} score-entry desk`}
      description="This page is now only for subject assignments and score entry. Student reports, attendance, and leadership notes have been separated into their own menus."
    >
      <TeacherAssignmentDesk
        account={account}
        academicConfig={workspace.academicConfig}
        assignments={workspace.assignments}
        resultLocks={workspace.resultLocks}
        selectedAssignment={workspace.selectedAssignment}
        selectedSubject={workspace.selectedSubject}
        selectedStudents={workspace.selectedStudents}
        selectedLock={workspace.selectedLock}
        correctionWindowOpen={workspace.correctionWindowOpen}
        schoolTerm={workspace.schoolTerm}
      />
    </AppShell>
  );
}
