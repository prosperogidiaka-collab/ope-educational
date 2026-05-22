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
        label: "Overview",
        items: [
          {
            href: "/dashboard/super-admin",
            label: "Operations Home",
            caption: "Open the platform summary and shortcuts",
          },
        ],
      },
      {
        label: "Tenants",
        items: [
          {
            href: "/dashboard/super-admin/schools",
            label: "School Portfolio",
            caption: "Edit schools, plans, renewals, and follow-up notes",
          },
          {
            href: "/dashboard/super-admin/onboarding",
            label: "Create School",
            caption: "Provision a new tenant and school-admin login",
          },
          {
            href: "/dashboard/super-admin/admin-accounts",
            label: "School Admins",
            caption: "Manage account status and cross-school scope",
          },
        ],
      },
      {
        label: "Platform Controls",
        items: [
          {
            href: "/dashboard/super-admin/platform-settings",
            label: "Platform Settings",
            caption: "Control maintenance, onboarding, and portal access",
          },
          {
            href: "/dashboard/super-admin/activity",
            label: "Owner Activity",
            caption: "Review support, billing, and publication signals",
          },
        ],
      },
    ];
  }

  const schoolAdminSections: NavigationSection[] = [
    {
      label: "Overview",
      items: [
        {
          href: "/dashboard/school-admin",
          label: "Operations Home",
          caption: "Open the separated school-admin summary and shortcuts",
        },
      ],
    },
    {
      label: "School Administration",
      items: [
        {
          href: "/dashboard/school-admin/academic-controls",
          label: "Academic Controls",
          caption: "Open term setup, locking, and score-governance shortcuts",
        },
        {
          href: "/dashboard/school-admin/registration",
          label: "Registration Desk",
          caption: "Open staffing, class setup, and subject registration shortcuts",
        },
        {
          href: "/dashboard/school-admin/student-affairs",
          label: "Student Affairs",
          caption: "Open student records, attendance, portal access, and logs",
        },
        {
          href: "/dashboard/school-admin/publication",
          label: "Publication Desk",
          caption: "Open review, broadsheet, report editing, and release shortcuts",
        },
        {
          href: "/dashboard/school-admin/transitions",
          label: "Transition and Data",
          caption: "Open rollover, archive, complaints, and export shortcuts",
        },
      ],
    },
  ];

  const registrarSections: NavigationSection[] = [
    {
      label: "Student Records",
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
      ],
    },
    {
      label: "Registration Support",
      items: [
        {
          href: "/dashboard/student-access",
          label: "Portal Access and Coupons",
          caption: "Manage login packs together with result token control",
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
          href: "/dashboard/import-export",
          label: "Bulk Import and Export Desk",
          caption: "Upload or download school structure in bulk",
        },
        {
          href: "/dashboard/school-logs",
          label: "School Logs",
          caption: "Visitor logs, school reports, and teacher observations for leadership review",
        },
      ],
    },
  ];

  if (isSchoolAdminRole(role)) {
    return schoolAdminSections;
  }

  if (role === "registrar") {
    return registrarSections;
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
