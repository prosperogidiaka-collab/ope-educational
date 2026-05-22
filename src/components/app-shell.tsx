import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { canAccessAccount, isSchoolAdminRole, PLATFORM_SCHOOL_CODE, ROLE_LABEL, roleHomeFor } from "@/lib/auth";
import { readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import type { UserRole } from "@/lib/types";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

interface NavigationItem {
  href: string;
  label: string;
  caption?: string;
}

interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

function navigationSectionsFor(role: UserRole): NavigationSection[] {
  if (role === "super_admin") {
    return [
      {
        label: "Platform",
        items: [
          {
            href: "/dashboard/super-admin",
            label: "Super Admin",
            caption: "Follow up schools, subscriptions, and platform operations",
          },
        ],
      },
    ];
  }

  const schoolAdminSections: NavigationSection[] = [
    {
      label: "Control Center",
      items: [
        {
          href: "/dashboard/school-admin",
          label: "School Admin Control Center",
          caption: "Main administration home",
        },
      ],
    },
    {
      label: "Immediate Controls",
      items: [
        {
          href: "/dashboard/academic#term-activation",
          label: "Activate Session and Term",
          caption: "Switch the live session, term, and exam type",
        },
        {
          href: "/dashboard/academic#assessment-setup",
          label: "Assessment Setup",
          caption: "Add visible assessment slots and allocate marks",
        },
        {
          href: "/dashboard/result-locks",
          label: "Open or Lock Scores",
          caption: "Freeze or reopen teacher entry by class",
        },
        {
          href: "/dashboard/score-overrides",
          label: "Edit Entered Scores",
          caption: "Correct raw scores in the school-admin name",
        },
      ],
    },
    {
      label: "Setup and Registration",
      items: [
        {
          href: "/dashboard/teacher-assignments",
          label: "Subject and Class Assignment",
          caption: "Assign subject slots and class responsibility to teacher accounts",
        },
        {
          href: "/dashboard/timetable",
          label: "Timetable",
          caption: "Upload, publish, and monitor school timetable slots",
        },
        {
          href: "/dashboard/staff-accounts",
          label: "Staff Accounts",
          caption: "Review active, disabled, and role-scoped users",
        },
        {
          href: "/dashboard/class-arms",
          label: "Class Arms",
          caption: "Define tracks, sections, class teachers, and HODs",
        },
        {
          href: "/dashboard/subject-registration",
          label: "Subject Registration",
          caption: "Set core and elective subjects per arm",
        },
        {
          href: "/dashboard/academic#ranking-policy",
          label: "Ranking and Grade Policy",
          caption: "Control ranking rules and incomplete-sheet behavior",
        },
        {
          href: "/dashboard/academic",
          label: "Academic Setup Board",
          caption: "Open the full term and assessment control page",
        },
      ],
    },
    {
      label: "Students Affairs",
      items: [
        {
          href: "/dashboard/student-affairs/student-info",
          label: "Student Info",
          caption: "Manage biodata and guardian records",
        },
        {
          href: "/dashboard/student-affairs/student-accounts",
          label: "Student Accounts",
          caption: "Manage student portal usernames, passwords, and access state",
        },
        {
          href: "/dashboard/student-affairs/reports",
          label: "Student Reports",
          caption: "Review teacher notes, praises, and result-sheet comments",
        },
        {
          href: "/dashboard/student-affairs/attendance",
          label: "Attendance",
          caption: "Activate and monitor class-teacher attendance flow",
        },
        {
          href: "/dashboard/student-access",
          label: "Portal Access and Coupons",
          caption: "Manage login packs together with result token control",
        },
        {
          href: "/dashboard/school-logs",
          label: "School Logs",
          caption: "Visitor logs, school reports, and teacher observations for leadership review",
        },
      ],
    },
    {
      label: "Score Control and Publication",
      items: [
        {
          href: "/dashboard/score-review",
          label: "Score Review",
          caption: "Inspect submissions, flags, and release decisions",
        },
        {
          href: "/dashboard/broadsheet",
          label: "Broadsheet",
          caption: "Print the class broadsheet in landscape",
        },
        {
          href: "/dashboard/report-editor",
          label: "Report Editor",
          caption: "Edit printed student sheets on their own page",
        },
        {
          href: "/dashboard/templates",
          label: "Template Builder",
          caption: "Control branding, zones, and print behavior",
        },
      ],
    },
    {
      label: "Additional Operations",
      items: [
        {
          href: "/dashboard/session-rollover",
          label: "Session Rollover and Promotion",
          caption: "Move class structures and students into the next session",
        },
        {
          href: "/dashboard/import-export",
          label: "Bulk Import and Export Desk",
          caption: "Upload or download school structure in bulk",
        },
        {
          href: "/dashboard/approval-matrix",
          label: "Approval Matrix Configuration",
          caption: "Define review, sign-off, and publication routing",
        },
        {
          href: "/dashboard/archive-transcripts",
          label: "Archive and Transcript Desk",
          caption: "Store old terms and prepare official reprints",
        },
        {
          href: "/dashboard/result-complaints",
          label: "Result Complaint Log",
          caption: "Track complaints, unlocks, and final resolutions",
        },
        {
          href: "/dashboard/audit-export",
          label: "Audit Export and Evidence Vault",
          caption: "Bundle edits, notes, and evidence trails",
        },
      ],
    },
  ];

  if (isSchoolAdminRole(role) || role === "registrar") {
    return schoolAdminSections;
  }

  return [
    {
      label: "Workspace",
      items: [
        { href: "/dashboard", label: "Dashboard", caption: "Open your role overview" },
        { href: "/dashboard/teacher", label: "Teacher Workspace", caption: "Open the separated teacher menus from one overview" },
        { href: "/dashboard/teacher/assignments", label: "Score Entry", caption: "Enter or review assigned score sheets" },
        { href: "/dashboard/timetable", label: "My Timetable", caption: "View only the timetable slots that belong to you" },
      ],
    },
    {
      label: "Student Support",
      items: [
        { href: "/dashboard/teacher/students", label: "Student Reports", caption: "Log notes and parent follow-up inside your scope" },
        { href: "/dashboard/teacher/attendance", label: "Attendance Register", caption: "Mark daily attendance for your class-teacher arms" },
        { href: "/dashboard/teacher/leadership", label: "Leadership Notes", caption: "Read notes logged about this teacher account" },
      ],
    },
    {
      label: "Review and Publication",
      items: [
        { href: "/dashboard/score-review", label: "Score Review", caption: "Inspect submitted sheets and flags" },
        { href: "/dashboard/broadsheet", label: "Broadsheet", caption: "View the live class summary sheet" },
        { href: "/dashboard/audit", label: "Audit Desk", caption: "Review evidence and activity traces" },
      ],
    },
    {
      label: "Administration",
      items: [
        {
          href: "/dashboard/school-admin",
          label: "School Admin Control Center",
          caption: "Open the leadership administration home",
        },
      ],
    },
  ];
}

interface AppShellProps {
  activeHref: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export async function AppShell({ activeHref, eyebrow, title, description, children }: AppShellProps) {
  const [session, account, school] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readRuntimeSchoolProfile(),
  ]);

  if (!session) {
    redirect("/login");
  }

  if (!account || account.status !== "active") {
    redirect("/auth/reset-session?next=/login");
  }

  if (!canAccessAccount(account, activeHref)) {
    redirect(roleHomeFor(account.role));
  }

  const visibleNavigationSections = navigationSectionsFor(account.role)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessAccount(account, item.href)),
    }))
    .filter((section) => section.items.length > 0);
  const displayName = account.fullName || session.name;
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const platformView = account.schoolCode === PLATFORM_SCHOOL_CODE;
  const brandEyebrow = platformView ? "Multi-School Oversight" : "Secure School Suite";
  const brandTitle = platformView ? "Platform Operations" : school.shortName || school.name;
  const brandCaption = platformView ? "All schools" : school.schoolCode;

  return (
    <div className="app-shell">
      <DashboardSidebar
        activeHref={activeHref}
        sections={visibleNavigationSections}
        brandEyebrow={brandEyebrow}
        brandTitle={brandTitle}
        brandCaption={brandCaption}
        brandLogoUrl={school.logoUrl}
        brandName={school.name}
        displayName={displayName}
        initials={initials}
        roleLabel={ROLE_LABEL[account.role]}
        userPhotoUrl={account.photoUrl}
      />

      <main className="main-panel">
        <header className="page-header">
          <p className="eyebrow">{eyebrow}</p>
          <div className="page-heading">
            <div>
              <h2>{title}</h2>
              <p className="muted">{description}</p>
            </div>
            <div className="header-chip">{ROLE_LABEL[account.role]}</div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
