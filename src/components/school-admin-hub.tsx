import Link from "next/link";

import { MetricCard } from "@/components/metric-card";
import { SchoolBrandingPanel } from "@/components/school-branding-panel";
import { formatDateOnly, resultStatusLabel } from "@/lib/calculations";
import type { NotificationItem, SchoolProfile } from "@/lib/types";

export type SchoolAdminView =
  | "overview"
  | "academicControls"
  | "registration"
  | "studentAffairs"
  | "publication"
  | "transitions";

interface FeatureLink {
  href: string;
  label: string;
  caption: string;
  eyebrow: string;
}

interface UnlockRequestItem {
  studentName: string;
  regNumber: string;
  reason: string;
  status: "pending" | "approved" | "declined";
}

interface AttentionStudentItem {
  studentName: string;
  regNumber: string;
  className: string;
  average: string;
  incompleteSubjects: number;
  anomalyCount: number;
}

interface SchoolAdminMetrics {
  activeStudents: number;
  activeAccounts: number;
  assignedCount: number;
  totalAssignments: number;
  lockedCount: number;
  correctionCount: number;
  activeAssessmentSlots: number;
  unlockRequests: number;
  publishedCount: number;
  flaggedCount: number;
  schoolAdminLeads: number;
  classTeacherLeads: number;
  registrarSupport: number;
}

interface SchoolAdminHubProps {
  view: SchoolAdminView;
  accountName: string;
  school: SchoolProfile;
  notifications: NotificationItem[];
  metrics: SchoolAdminMetrics;
  unlockRequests: UnlockRequestItem[];
  attentionStudents: AttentionStudentItem[];
}

const VIEW_HELP_COPY: Record<SchoolAdminView, string> = {
  overview:
    "The school-admin workspace now opens as a set of separate desks so you do not have to manage every operation from one crowded screen.",
  academicControls:
    "Academic setup, locks, and score corrections now have a dedicated area instead of being mixed with registration and student records.",
  registration:
    "Teacher assignment, staff setup, timetable work, and class structure shortcuts now live together in their own desk.",
  studentAffairs:
    "Student records, attendance, portal access, and school-log duties now sit on their own page so nothing overlaps.",
  publication:
    "Review, broadsheet, report editing, and release checks are now grouped into a publication desk instead of being scattered.",
  transitions:
    "Rollover, archive, complaints, and export work now sit in one transition and data desk so term-close tasks stay clear.",
};

const OVERVIEW_LINKS: FeatureLink[] = [
  {
    href: "/dashboard/school-admin/academic-controls",
    label: "Academic Controls",
    caption: "Open session activation, assessment setup, ranking policy, locks, and score-governance work.",
    eyebrow: "School setup",
  },
  {
    href: "/dashboard/school-admin/registration",
    label: "Registration Desk",
    caption: "Open teacher assignments, staffing, timetable, class arms, and subject-registration work.",
    eyebrow: "People and structure",
  },
  {
    href: "/dashboard/school-admin/student-affairs",
    label: "Student Affairs",
    caption: "Open biodata, student accounts, attendance, portal access, and school-log workspaces.",
    eyebrow: "Student support",
  },
  {
    href: "/dashboard/school-admin/publication",
    label: "Publication Desk",
    caption: "Open review, broadsheet, report editing, templates, and release governance without mixing duties.",
    eyebrow: "Results release",
  },
  {
    href: "/dashboard/school-admin/transitions",
    label: "Transition and Data",
    caption: "Open rollover, archive, complaint resolution, approval routing, and audit export shortcuts.",
    eyebrow: "Session close",
  },
];

const ACADEMIC_LINKS: FeatureLink[] = [
  {
    href: "/dashboard/academic#term-activation",
    label: "Activate Session and Term",
    caption: "Switch the live session, term, and exam type for the whole school.",
    eyebrow: "Current term",
  },
  {
    href: "/dashboard/academic#assessment-setup",
    label: "Assessment Setup",
    caption: "Define visible score components and their marks without opening other desks.",
    eyebrow: "Assessment",
  },
  {
    href: "/dashboard/academic#ranking-policy",
    label: "Ranking and Grade Policy",
    caption: "Review ranking behavior, grading scales, and incomplete-sheet rules.",
    eyebrow: "Calculation rules",
  },
  {
    href: "/dashboard/academic",
    label: "Academic Setup Board",
    caption: "Open the full academic configuration page when you need the detailed controls.",
    eyebrow: "Full workspace",
  },
  {
    href: "/dashboard/result-locks",
    label: "Open or Lock Scores",
    caption: "Freeze or reopen class-level score entry without mixing it into other workflows.",
    eyebrow: "Governance",
  },
  {
    href: "/dashboard/score-overrides",
    label: "Edit Entered Scores",
    caption: "Correct raw entries when a controlled school-admin override is required.",
    eyebrow: "Corrections",
  },
];

const REGISTRATION_LINKS: FeatureLink[] = [
  {
    href: "/dashboard/teacher-assignments",
    label: "Subject and Class Assignment",
    caption: "Assign teachers to subject-class slots and keep delivery ownership clear.",
    eyebrow: "Teacher workload",
  },
  {
    href: "/dashboard/staff-accounts",
    label: "Staff Accounts",
    caption: "Manage active accounts, role scope, and teacher-enable rules in one place.",
    eyebrow: "Access",
  },
  {
    href: "/dashboard/timetable",
    label: "Timetable",
    caption: "Upload, publish, and monitor the live timetable without leaving this desk.",
    eyebrow: "Scheduling",
  },
  {
    href: "/dashboard/class-arms",
    label: "Class Arms",
    caption: "Define class sections, tracks, HOD ownership, and class-teacher coverage cleanly.",
    eyebrow: "Structure",
  },
  {
    href: "/dashboard/subject-registration",
    label: "Subject Registration",
    caption: "Set core and elective subjects per arm so teachers and reports stay aligned.",
    eyebrow: "Curriculum",
  },
];

const STUDENT_AFFAIRS_LINKS: FeatureLink[] = [
  {
    href: "/dashboard/student-affairs/student-info",
    label: "Student Info",
    caption: "Manage biodata, guardian details, class placement, and school profile records.",
    eyebrow: "Records",
  },
  {
    href: "/dashboard/student-affairs/student-accounts",
    label: "Student Accounts",
    caption: "Reset portal credentials and manage student access state separately from other tasks.",
    eyebrow: "Portal login",
  },
  {
    href: "/dashboard/student-affairs/reports",
    label: "Student Reports",
    caption: "Review comment trails, praises, and result-sheet report content in a dedicated workspace.",
    eyebrow: "Narrative notes",
  },
  {
    href: "/dashboard/student-affairs/attendance",
    label: "Attendance",
    caption: "Open the attendance workflow and class-teacher tracking without crowding this page.",
    eyebrow: "Presence",
  },
  {
    href: "/dashboard/student-access",
    label: "Portal Access and Coupons",
    caption: "Manage result tokens and student/parent access packs from one focused page.",
    eyebrow: "Access control",
  },
  {
    href: "/dashboard/school-logs",
    label: "School Logs",
    caption: "Review visitor logs, school observations, and leadership follow-up records.",
    eyebrow: "Governance",
  },
];

const PUBLICATION_LINKS: FeatureLink[] = [
  {
    href: "/dashboard/score-review",
    label: "Score Review",
    caption: "Inspect submitted sheets, anomalies, and class release readiness.",
    eyebrow: "Review",
  },
  {
    href: "/dashboard/result-locks",
    label: "Result Locks",
    caption: "Open or freeze class results when release timing has to be controlled.",
    eyebrow: "Release control",
  },
  {
    href: "/dashboard/score-overrides",
    label: "Score Overrides",
    caption: "Handle school-admin level corrections without mixing them into review pages.",
    eyebrow: "Corrections",
  },
  {
    href: "/dashboard/broadsheet",
    label: "Broadsheet",
    caption: "Open the class summary sheet in its own page when you need the final overview.",
    eyebrow: "Class summary",
  },
  {
    href: "/dashboard/report-editor",
    label: "Report Editor",
    caption: "Edit printed student sheets separately from review and release controls.",
    eyebrow: "Printed sheet",
  },
  {
    href: "/dashboard/templates",
    label: "Template Builder",
    caption: "Control branding, layout zones, and print behavior from a focused workspace.",
    eyebrow: "Presentation",
  },
];

const TRANSITION_LINKS: FeatureLink[] = [
  {
    href: "/dashboard/session-rollover",
    label: "Session Rollover and Promotion",
    caption: "Move students and class structures into the next session without mixing setup tasks.",
    eyebrow: "Next term",
  },
  {
    href: "/dashboard/import-export",
    label: "Bulk Import and Export Desk",
    caption: "Upload and download school structure, records, and setup files in bulk.",
    eyebrow: "Bulk data",
  },
  {
    href: "/dashboard/approval-matrix",
    label: "Approval Matrix Configuration",
    caption: "Keep review and publication routing explicit before the next release cycle starts.",
    eyebrow: "Workflow",
  },
  {
    href: "/dashboard/archive-transcripts",
    label: "Archive and Transcript Desk",
    caption: "Retain published outputs cleanly and prepare official reprints or transcript bundles.",
    eyebrow: "Archive",
  },
  {
    href: "/dashboard/result-complaints",
    label: "Result Complaint Log",
    caption: "Track complaints, unlock requests, and final resolutions with accountability.",
    eyebrow: "Resolution",
  },
  {
    href: "/dashboard/audit-export",
    label: "Audit Export and Evidence Vault",
    caption: "Bundle edits, notes, and evidence trails for compliance and review.",
    eyebrow: "Evidence",
  },
];

function metricCardsFor(view: SchoolAdminView, metrics: SchoolAdminMetrics, school: SchoolProfile) {
  switch (view) {
    case "academicControls":
      return [
        {
          label: "Assessment slots",
          value: `${metrics.activeAssessmentSlots}`,
          helper: "Visible score components in the live term",
        },
        {
          label: "Locked classes",
          value: `${metrics.lockedCount}`,
          helper: "Class result groups currently frozen",
        },
        {
          label: "Corrections flagged",
          value: `${metrics.correctionCount}`,
          helper: "Sheets returned for controlled adjustment",
        },
        {
          label: "Open unlock requests",
          value: `${metrics.unlockRequests}`,
          helper: "Post-publish correction requests waiting in queue",
        },
      ];
    case "registration":
      return [
        {
          label: "Teacher assignments",
          value: `${metrics.assignedCount} / ${metrics.totalAssignments}`,
          helper: "Subject-class slots already owned by a teacher",
        },
        {
          label: "Unassigned slots",
          value: `${Math.max(metrics.totalAssignments - metrics.assignedCount, 0)}`,
          helper: "Slots still needing a teacher owner",
        },
        {
          label: "Active staff accounts",
          value: `${metrics.activeAccounts}`,
          helper: "Teacher and leadership accounts currently enabled",
        },
        {
          label: "Class teachers",
          value: `${metrics.classTeacherLeads}`,
          helper: "Accounts already carrying a class-teacher duty",
        },
      ];
    case "studentAffairs":
      return [
        {
          label: "Student records",
          value: `${metrics.activeStudents}`,
          helper: "Live student result profiles in the current workspace",
        },
        {
          label: "Registrar support",
          value: `${metrics.registrarSupport}`,
          helper: "Accounts able to handle student registration work",
        },
        {
          label: "Class teachers",
          value: `${metrics.classTeacherLeads}`,
          helper: "Attendance and class-comment coverage owners",
        },
        {
          label: "Parent-facing notices",
          value: `${metrics.publishedCount}`,
          helper: "Published result records already visible to families",
        },
      ];
    case "publication":
      return [
        {
          label: "Published results",
          value: `${metrics.publishedCount}`,
          helper: "Student sheets already cleared or locked for release",
        },
        {
          label: "Release flags",
          value: `${metrics.flaggedCount}`,
          helper: "Students still carrying anomalies or incomplete entries",
        },
        {
          label: "Corrections flagged",
          value: `${metrics.correctionCount}`,
          helper: "Teacher sheets sent back for evidence-backed correction",
        },
        {
          label: "Unlock requests",
          value: `${metrics.unlockRequests}`,
          helper: "Controlled post-publish complaints needing attention",
        },
      ];
    case "transitions":
      return [
        {
          label: "Current cycle",
          value: `${school.session}`,
          helper: `${school.term} ${school.examType}`,
        },
        {
          label: "Published results",
          value: `${metrics.publishedCount}`,
          helper: "Outputs ready to archive or include in transcript bundles",
        },
        {
          label: "School-admin leads",
          value: `${metrics.schoolAdminLeads}`,
          helper: "Leadership accounts carrying administrative clearance",
        },
        {
          label: "Student records",
          value: `${metrics.activeStudents}`,
          helper: "Records affected by rollover, archive, and export workflows",
        },
      ];
    default:
      return [
        {
          label: "Student records",
          value: `${metrics.activeStudents}`,
          helper: "Live student result profiles in the current workspace",
        },
        {
          label: "Active staff accounts",
          value: `${metrics.activeAccounts}`,
          helper: "Teacher and leadership accounts currently enabled",
        },
        {
          label: "Locked classes",
          value: `${metrics.lockedCount}`,
          helper: "Result groups currently frozen for release control",
        },
        {
          label: "Open unlock requests",
          value: `${metrics.unlockRequests}`,
          helper: "Controlled post-publish correction requests",
        },
      ];
  }
}

function renderFeatureGrid(title: string, description: string, links: FeatureLink[]) {
  return (
    <section className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Separated Workspaces</p>
          <h3>{title}</h3>
        </div>
      </div>
      <p className="muted">{description}</p>
      <div className="feature-nav-grid">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="feature-nav-card">
            <p className="eyebrow">{link.eyebrow}</p>
            <strong>{link.label}</strong>
            <span>{link.caption}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function renderUnlockQueue(unlockRequests: UnlockRequestItem[]) {
  return (
    <div className="stack-list">
      {unlockRequests.length > 0 ? (
        unlockRequests.map((item) => (
          <div key={item.regNumber} className="alert-card">
            <strong>{item.studentName}</strong>
            <p className="muted">{item.regNumber}</p>
            <p>{item.reason}</p>
            <span
              className={`status-pill status-${
                item.status === "approved"
                  ? "approved"
                  : item.status === "declined"
                    ? "corrections_requested"
                    : "under_review"
              }`}
            >
              {resultStatusLabel(item.status)}
            </span>
          </div>
        ))
      ) : (
        <div className="flow-step">
          <strong>No unlock requests are waiting.</strong>
          <p>The controlled correction queue is clear right now.</p>
        </div>
      )}
    </div>
  );
}

function renderAttentionList(attentionStudents: AttentionStudentItem[]) {
  return (
    <div className="stack-list">
      {attentionStudents.length > 0 ? (
        attentionStudents.map((student) => (
          <div key={student.regNumber} className="flow-step">
            <strong>{student.studentName}</strong>
            <p>
              {student.regNumber} - {student.className}
            </p>
            <p className="muted">
              Average {student.average}% | {student.incompleteSubjects} incomplete subjects | {student.anomalyCount} release
              flags
            </p>
          </div>
        ))
      ) : (
        <div className="flow-step">
          <strong>No students are currently flagged.</strong>
          <p>The release queue is clean across the live classes in this workspace.</p>
        </div>
      )}
    </div>
  );
}

function renderNotificationTimeline(notifications: NotificationItem[]) {
  return (
    <div className="timeline">
      {notifications.map((item) => (
        <article key={item.id} className="timeline-item">
          <strong>{item.title}</strong>
          <p>{item.message}</p>
          <span>
            {item.audience} - {formatDateOnly(item.timestamp)}
          </span>
        </article>
      ))}
    </div>
  );
}

export function SchoolAdminHub({
  view,
  accountName,
  school,
  notifications,
  metrics,
  unlockRequests,
  attentionStudents,
}: SchoolAdminHubProps) {
  const cards = metricCardsFor(view, metrics, school);

  return (
    <>
      <section className="surface-card">
        <div className="callout-banner">
          <strong>{accountName}, the school-admin workspace has been separated into cleaner desks.</strong>
          <p className="muted">{VIEW_HELP_COPY[view]}</p>
        </div>
      </section>

      <section className="metric-grid">
        {cards.map((card) => (
          <MetricCard key={card.label} label={card.label} value={card.value} helper={card.helper} />
        ))}
      </section>

      {view === "overview" ? <SchoolBrandingPanel school={school} canManage /> : null}

      {view === "overview"
        ? renderFeatureGrid(
            "Open the exact desk you need",
            "Each school-admin duty now has its own entry point so the menu and the page body no longer feel jammed together.",
            OVERVIEW_LINKS,
          )
        : null}

      {view === "academicControls"
        ? renderFeatureGrid(
            "Academic setup and score governance",
            "Use these separate shortcuts for term setup, grading policy, locks, and controlled score correction.",
            ACADEMIC_LINKS,
          )
        : null}

      {view === "registration"
        ? renderFeatureGrid(
            "Teacher, staffing, and class setup",
            "Registration work now points to separate pages for staffing, structure, timetable, and subject setup.",
            REGISTRATION_LINKS,
          )
        : null}

      {view === "studentAffairs"
        ? renderFeatureGrid(
            "Student records and portal support",
            "Student-facing work now opens from focused shortcuts instead of one crowded administration surface.",
            STUDENT_AFFAIRS_LINKS,
          )
        : null}

      {view === "publication"
        ? renderFeatureGrid(
            "Review, release, and report output",
            "Publication tasks now open from one desk without being mixed into records, setup, or rollover pages.",
            PUBLICATION_LINKS,
          )
        : null}

      {view === "transitions"
        ? renderFeatureGrid(
            "Rollover, archive, and evidence work",
            "Term-close tasks now point to dedicated pages so the transition workflow stays readable and deliberate.",
            TRANSITION_LINKS,
          )
        : null}

      {view === "overview" ? (
        <section className="grid-layout two-wide">
          <article className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Current Scope</p>
                <h3>Live school snapshot</h3>
              </div>
            </div>
            <div className="inline-metrics">
              <div>
                <span>Active workflow</span>
                <strong>
                  {school.session} - {school.term}
                </strong>
              </div>
              <div>
                <span>Assessment slots</span>
                <strong>{metrics.activeAssessmentSlots}</strong>
              </div>
              <div>
                <span>Teacher assignment coverage</span>
                <strong>
                  {metrics.assignedCount} / {metrics.totalAssignments}
                </strong>
              </div>
              <div>
                <span>Published results</span>
                <strong>{metrics.publishedCount}</strong>
              </div>
            </div>
            <div className="stack-list">
              <div className="flow-step">
                <strong>School admin</strong>
                <p>Owns tenant administration, teacher assignments, result locks, score overrides, publication checks, and school-level setup.</p>
              </div>
              <div className="flow-step">
                <strong>Registrar support</strong>
                <p>Owns student access, class-arm setup, subject registration, and student-record workflows when assigned that duty.</p>
              </div>
              <div className="flow-step">
                <strong>Super admin</strong>
                <p>Owns cross-school subscription follow-up and platform-wide controls that do not belong inside one tenant.</p>
              </div>
            </div>
          </article>

          <article className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Recent Alerts</p>
                <h3>Admin and publication feed</h3>
              </div>
            </div>
            {renderNotificationTimeline(notifications)}
          </article>
        </section>
      ) : null}

      {view === "academicControls" ? (
        <section className="grid-layout two-wide">
          <article className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Operational Snapshot</p>
                <h3>Controls affecting the current term</h3>
              </div>
            </div>
            <div className="inline-metrics">
              <div>
                <span>Live workflow</span>
                <strong>
                  {school.session} - {school.term}
                </strong>
              </div>
              <div>
                <span>Exam type</span>
                <strong>{school.examType}</strong>
              </div>
              <div>
                <span>Locked classes</span>
                <strong>{metrics.lockedCount}</strong>
              </div>
              <div>
                <span>Correction flags</span>
                <strong>{metrics.correctionCount}</strong>
              </div>
            </div>
            <div className="stack-list">
              <div className="flow-step">
                <strong>Open academic setup for structural changes.</strong>
                <p>Session activation, assessment slots, and ranking policy still live in the dedicated academic workspace.</p>
              </div>
              <div className="flow-step">
                <strong>Use locks and overrides only when governance requires it.</strong>
                <p>Keeping those actions separate helps prevent accidental editing while scores are under review.</p>
              </div>
            </div>
          </article>

          <article className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Controlled Unlock</p>
                <h3>Post-publish correction queue</h3>
              </div>
            </div>
            {renderUnlockQueue(unlockRequests)}
          </article>
        </section>
      ) : null}

      {view === "registration" ? (
        <section className="grid-layout two-wide">
          <article className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Coverage Snapshot</p>
                <h3>Teacher and structure readiness</h3>
              </div>
            </div>
            <div className="inline-metrics">
              <div>
                <span>School-admin leads</span>
                <strong>{metrics.schoolAdminLeads}</strong>
              </div>
              <div>
                <span>Registrar support</span>
                <strong>{metrics.registrarSupport}</strong>
              </div>
              <div>
                <span>Class teachers</span>
                <strong>{metrics.classTeacherLeads}</strong>
              </div>
              <div>
                <span>Active staff accounts</span>
                <strong>{metrics.activeAccounts}</strong>
              </div>
            </div>
            <div className="stack-list">
              <div className="flow-step">
                <strong>Start with teacher assignments.</strong>
                <p>Give every subject-class slot an owner before you move into review or publication work.</p>
              </div>
              <div className="flow-step">
                <strong>Keep structure and curriculum aligned.</strong>
                <p>Class arms, timetable, and subject registration should match before teachers begin entry.</p>
              </div>
            </div>
          </article>

          <article className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Readiness Watchlist</p>
                <h3>Students affected when setup slips</h3>
              </div>
            </div>
            {renderAttentionList(attentionStudents)}
          </article>
        </section>
      ) : null}

      {view === "studentAffairs" ? (
        <section className="grid-layout two-wide">
          <article className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Student Operations</p>
                <h3>Records and support snapshot</h3>
              </div>
            </div>
            <div className="inline-metrics">
              <div>
                <span>Student records</span>
                <strong>{metrics.activeStudents}</strong>
              </div>
              <div>
                <span>Portal-ready results</span>
                <strong>{metrics.publishedCount}</strong>
              </div>
              <div>
                <span>Registrar support</span>
                <strong>{metrics.registrarSupport}</strong>
              </div>
              <div>
                <span>Class teachers</span>
                <strong>{metrics.classTeacherLeads}</strong>
              </div>
            </div>
            <div className="stack-list">
              <div className="flow-step">
                <strong>Keep records current before publishing.</strong>
                <p>Student names, class placement, guardian details, and portal access should be settled ahead of release.</p>
              </div>
              <div className="flow-step">
                <strong>Handle attendance and reports in their own desks.</strong>
                <p>That keeps narrative records separate from scores and helps class teachers focus on one duty at a time.</p>
              </div>
            </div>
          </article>

          <article className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Attention Students</p>
                <h3>Records needing follow-up</h3>
              </div>
            </div>
            {renderAttentionList(attentionStudents)}
          </article>
        </section>
      ) : null}

      {view === "publication" ? (
        <section className="grid-layout two-wide">
          <article className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Release Watchlist</p>
                <h3>Students still needing review attention</h3>
              </div>
            </div>
            {renderAttentionList(attentionStudents)}
          </article>

          <article className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Complaint Queue</p>
                <h3>Controlled unlock and correction requests</h3>
              </div>
            </div>
            {renderUnlockQueue(unlockRequests)}
          </article>
        </section>
      ) : null}

      {view === "transitions" ? (
        <section className="grid-layout two-wide">
          <article className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Ownership Boundaries</p>
                <h3>Who owns the close-out workflow</h3>
              </div>
            </div>
            <div className="stack-list">
              <div className="flow-step">
                <strong>School admin</strong>
                <p>Clears rollover timing, archive readiness, complaint resolution, and export sign-off inside the tenant.</p>
              </div>
              <div className="flow-step">
                <strong>Registrar support</strong>
                <p>Prepares student records, class structures, and bulk data hygiene so rollover and export can happen cleanly.</p>
              </div>
              <div className="flow-step">
                <strong>Super admin</strong>
                <p>Handles cross-school platform issues that should not be trapped inside a single school workspace.</p>
              </div>
            </div>
          </article>

          <article className="surface-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Recent Signals</p>
                <h3>What may affect rollover or archive work</h3>
              </div>
            </div>
            {renderNotificationTimeline(notifications)}
          </article>
        </section>
      ) : null}
    </>
  );
}
