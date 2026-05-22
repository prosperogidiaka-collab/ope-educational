"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";

import { inferBaseClassName } from "@/lib/class-structure";
import { formatDate, formatDateOnly, ordinal, resultStatusLabel } from "@/lib/calculations";
import { buildInlineAttachmentPayload } from "@/lib/file-attachments";
import { buildShortResultPath } from "@/lib/short-links";
import type {
  ClassOffering,
  SchoolProfile,
  StudentAbsenceRequest,
  StudentAttendanceAggregate,
  StudentAttendancePolicy,
  StudentAttendanceRegister,
  StudentPortalCredential,
  StudentProfileRecord,
  StudentReportCategory,
  StudentReportEntry,
  StudentSummary,
} from "@/lib/types";

type StudentAffairsView = "overview" | "student_info" | "student_accounts" | "reports" | "attendance";
type AttendanceViewMode = "overview" | "class" | "student";
type AttendanceTimeScope = "day" | "week" | "month" | "term" | "session";

interface StudentAffairsBoardProps {
  school: SchoolProfile;
  view: StudentAffairsView;
  classOfferings: ClassOffering[];
  profiles: StudentProfileRecord[];
  credentials: StudentPortalCredential[];
  reports: StudentReportEntry[];
  absenceRequests: StudentAbsenceRequest[];
  attendancePolicy: StudentAttendancePolicy;
  attendanceSummaries: StudentAttendanceAggregate[];
  attendanceRegisters: StudentAttendanceRegister[];
  liveSummaries: StudentSummary[];
  canManageRecords: boolean;
  canManageAttendancePolicy: boolean;
  canManageAbsenceRequests: boolean;
}

const REPORT_CATEGORY_OPTIONS: StudentReportCategory[] = [
  "general",
  "praise",
  "guidance",
  "discipline",
  "health",
  "result_comment",
];
const ATTENDANCE_TIME_SCOPE_OPTIONS: AttendanceTimeScope[] = ["day", "week", "month", "term", "session"];

function credentialStatusClass(status: StudentPortalCredential["status"]) {
  if (status === "sent") {
    return "status-approved";
  }

  if (status === "reset_required") {
    return "status-corrections_requested";
  }

  return "status-submitted";
}

function accountStateClass(accountState: StudentPortalCredential["accountState"]) {
  return accountState === "active" ? "status-approved" : "status-locked";
}

function lifecycleStatusClass(status: StudentProfileRecord["studentStatus"]) {
  return status === "active" ? "status-approved" : "status-under_review";
}

function absenceStatusClass(status: StudentAbsenceRequest["status"]) {
  if (status === "approved") {
    return "status-approved";
  }

  if (status === "rejected") {
    return "status-corrections_requested";
  }

  return "status-under_review";
}

function categoryLabel(category: StudentReportCategory) {
  return resultStatusLabel(category);
}

function searchValue(input: string) {
  return input.trim().toLowerCase();
}

function profileSearchText(profile: StudentProfileRecord) {
  return [
    profile.fullName,
    profile.regNumber,
    profile.className,
    profile.arm,
    profile.guardianName,
    profile.guardianPhone,
    profile.fatherName,
    profile.fatherPhone,
    profile.motherName,
    profile.motherPhone,
    profile.studentStatus,
  ]
    .join(" ")
    .toLowerCase();
}

function credentialSearchText(credential: StudentPortalCredential) {
  return [
    credential.studentName,
    credential.regNumber,
    credential.username,
    credential.couponCode,
    credential.status,
    credential.accountState,
    credential.disabledReason ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function reportSearchText(report: StudentReportEntry) {
  return [
    report.studentName,
    report.regNumber,
    report.className,
    report.title,
    report.body,
    report.category,
    report.authorName,
    report.subjectName ?? "",
    report.attachmentLabel ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function normalizeWhatsappNumber(phone: string) {
  const digits = phone.replace(/\D+/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("234")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `234${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `234${digits}`;
  }

  return digits;
}

function sameDay(left: Date, right: Date) {
  return left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate();
}

function withinSelectedTimeScope(
  register: StudentAttendanceRegister,
  scope: AttendanceTimeScope,
  referenceDate: string,
  attendancePolicy: StudentAttendancePolicy,
) {
  if (scope === "term") {
    return register.session === attendancePolicy.session && register.term === attendancePolicy.term;
  }

  if (scope === "session") {
    return register.session === attendancePolicy.session;
  }

  const registerDate = new Date(`${register.date}T12:00:00.000Z`);
  const selectedDate = new Date(`${referenceDate}T12:00:00.000Z`);

  if (scope === "day") {
    return sameDay(registerDate, selectedDate);
  }

  if (scope === "month") {
    return registerDate.getUTCFullYear() === selectedDate.getUTCFullYear() &&
      registerDate.getUTCMonth() === selectedDate.getUTCMonth();
  }

  const weekStart = new Date(selectedDate);
  const offset = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - offset);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return registerDate >= weekStart && registerDate <= weekEnd;
}

function buildScopedAttendanceSummaries(
  registers: StudentAttendanceRegister[],
  profiles: StudentProfileRecord[],
) {
  const profileByRegNumber = new Map(profiles.map((profile) => [profile.regNumber, profile]));
  const summaryMap = new Map<string, StudentAttendanceAggregate>();

  registers.forEach((register) => {
    register.entries.forEach((entry) => {
      const profile = profileByRegNumber.get(entry.regNumber);

      if (!profile) {
        return;
      }

      const current = summaryMap.get(entry.regNumber) ?? {
        regNumber: entry.regNumber,
        studentName: profile.fullName,
        className: profile.className,
        arm: profile.arm,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        possible: 0,
        percentage: 0,
      };

      current.possible += 1;
      current.lastMarkedAt = register.updatedAt;

      if (entry.status === "present") {
        current.present += 1;
      } else if (entry.status === "absent") {
        current.absent += 1;
      } else if (entry.status === "late") {
        current.late += 1;
      } else if (entry.status === "excused") {
        current.excused += 1;
      }

      current.percentage = current.possible
        ? Math.round((current.present / current.possible) * 100)
        : 0;
      summaryMap.set(entry.regNumber, current);
    });
  });

  return Array.from(summaryMap.values()).sort((left, right) =>
    (left.studentName ?? "").localeCompare(right.studentName ?? ""),
  );
}

function WhatsAppButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="whatsapp-button">
      <span className="whatsapp-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path
            fill="currentColor"
            d="M12.04 2C6.58 2 2.16 6.4 2.16 11.83c0 1.74.46 3.44 1.33 4.94L2 22l5.42-1.42a9.93 9.93 0 0 0 4.62 1.17h.01c5.45 0 9.87-4.4 9.87-9.83S17.49 2 12.04 2Zm0 18.08h-.01a8.27 8.27 0 0 1-4.21-1.15l-.3-.18-3.21.84.86-3.12-.2-.32a8.13 8.13 0 0 1-1.26-4.32c0-4.51 3.69-8.18 8.24-8.18 2.2 0 4.26.85 5.82 2.4a8.08 8.08 0 0 1 2.41 5.78c0 4.51-3.7 8.19-8.14 8.19Zm4.48-6.15c-.24-.12-1.42-.7-1.64-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1-.37-1.91-1.18-.7-.62-1.18-1.39-1.32-1.63-.14-.24-.02-.37.1-.48.1-.1.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.29-.74-1.76-.2-.48-.4-.41-.54-.42l-.46-.01c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 1.98 0 1.16.86 2.28.98 2.44.12.16 1.68 2.66 4.16 3.63 2.48.97 2.48.64 2.92.6.44-.04 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"
          />
        </svg>
      </span>
      <span>{label}</span>
    </a>
  );
}

export function StudentAffairsBoard({
  school,
  view,
  classOfferings,
  profiles,
  credentials,
  reports,
  absenceRequests,
  attendancePolicy,
  attendanceSummaries: _attendanceSummaries,
  attendanceRegisters,
  liveSummaries,
  canManageRecords,
  canManageAttendancePolicy,
  canManageAbsenceRequests,
}: StudentAffairsBoardProps) {
  const [localProfiles, setLocalProfiles] = useState(profiles);
  const [localCredentials, setLocalCredentials] = useState(credentials);
  const [localReports, setLocalReports] = useState(reports);
  const [localAttendancePolicy, setLocalAttendancePolicy] = useState(attendancePolicy);
  const [localAbsenceRequests, setLocalAbsenceRequests] = useState(absenceRequests);
  const [feedback, setFeedback] = useState(
    "Student affairs now ties biodata, portal accounts, teacher reports, attendance, and absence approvals to the same live student record.",
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [selectedRegNumber, setSelectedRegNumber] = useState(profiles[0]?.regNumber ?? "");
  const [studentSearch, setStudentSearch] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [absenceSearch, setAbsenceSearch] = useState("");
  const [attendanceViewMode, setAttendanceViewMode] = useState<AttendanceViewMode>("overview");
  const [selectedAttendanceClassName, setSelectedAttendanceClassName] = useState(
    classOfferings[0]?.baseClassName ?? inferBaseClassName(profiles[0]?.className ?? "", profiles[0]?.arm),
  );
  const [selectedAttendanceArm, setSelectedAttendanceArm] = useState(classOfferings[0]?.arm ?? profiles[0]?.arm ?? "");
  const [selectedAttendanceStudentRegNumber, setSelectedAttendanceStudentRegNumber] = useState(
    profiles[0]?.regNumber ?? "",
  );
  const [selectedAttendanceTimeScope, setSelectedAttendanceTimeScope] = useState<AttendanceTimeScope>("term");
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState(
    attendanceRegisters[0]?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [currentOrigin, setCurrentOrigin] = useState("");
  const [reportDraft, setReportDraft] = useState({
    title: "",
    body: "",
    category: "general" as StudentReportCategory,
    subjectName: "",
    showOnPortal: true,
    showOnResultSheet: false,
    praise: false,
    attachmentLabel: "",
    attachmentUrl: "",
    attachmentMimeType: "",
    attachmentSizeBytes: 0,
  });

  const deferredStudentSearch = useDeferredValue(searchValue(studentSearch));
  const deferredAccountSearch = useDeferredValue(searchValue(accountSearch));
  const deferredReportSearch = useDeferredValue(searchValue(reportSearch));
  const deferredAttendanceSearch = useDeferredValue(searchValue(attendanceSearch));
  const deferredAbsenceSearch = useDeferredValue(searchValue(absenceSearch));
  const structureSource =
    classOfferings.length > 0
      ? classOfferings.map((offering) => ({
          baseClassName: offering.baseClassName || inferBaseClassName(offering.className, offering.arm),
          className: offering.className,
          arm: offering.arm,
        }))
      : localProfiles.map((profile) => ({
          baseClassName: inferBaseClassName(profile.className, profile.arm),
          className: profile.className,
          arm: profile.arm,
        }));
  const classOptions = Array.from(new Set(structureSource.map((item) => item.baseClassName))).sort();
  const selectedAttendanceArmOptions = Array.from(
    new Set(
      structureSource
        .filter((item) => item.baseClassName === selectedAttendanceClassName)
        .map((item) => item.arm),
    ),
  ).sort();
  const selectedAttendanceClassNames = new Set(
    structureSource
      .filter((item) => item.baseClassName === selectedAttendanceClassName)
      .filter((item) => !selectedAttendanceArm || item.arm === selectedAttendanceArm)
      .map((item) => item.className),
  );
  const selectedProfile =
    localProfiles.find((profile) => profile.regNumber === selectedRegNumber) ??
    localProfiles.find((profile) => profile.regNumber === selectedAttendanceStudentRegNumber) ??
    localProfiles[0] ??
    null;
  const selectedSummary =
    liveSummaries.find((summary) => summary.bundle.student.regNumber === selectedProfile?.regNumber) ?? null;
  const selectedReports = localReports
    .filter((report) => report.regNumber === selectedProfile?.regNumber)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  const visibleStudentProfiles = localProfiles.filter((profile) =>
    deferredStudentSearch ? profileSearchText(profile).includes(deferredStudentSearch) : true,
  );
  const visibleReportProfiles = localProfiles.filter((profile) =>
    deferredReportSearch ? profileSearchText(profile).includes(deferredReportSearch) : true,
  );
  const visibleAttendanceProfiles = localProfiles.filter((profile) =>
    deferredAttendanceSearch ? profileSearchText(profile).includes(deferredAttendanceSearch) : true,
  );
  const visibleCredentials = localCredentials.filter((credential) => {
    const profile = localProfiles.find((item) => item.regNumber === credential.regNumber);
    const combinedText = `${credentialSearchText(credential)} ${profile ? profileSearchText(profile) : ""}`;

    return deferredAccountSearch ? combinedText.includes(deferredAccountSearch) : true;
  });
  const visibleReports = localReports.filter((report) =>
    deferredReportSearch ? reportSearchText(report).includes(deferredReportSearch) : true,
  );
  const visibleAbsenceRequests = localAbsenceRequests.filter((request) => {
    const profile = localProfiles.find((item) => item.regNumber === request.regNumber);
    const text = [
      request.studentName,
      request.regNumber,
      request.className,
      request.reason,
      request.status,
      request.requestedFrom,
      request.requestedTo,
      request.decidedBy ?? "",
      profile ? profileSearchText(profile) : "",
    ]
      .join(" ")
      .toLowerCase();

    return deferredAbsenceSearch ? text.includes(deferredAbsenceSearch) : true;
  });
  const filteredAttendanceRegisters = attendanceRegisters.filter((register) => {
    if (!withinSelectedTimeScope(register, selectedAttendanceTimeScope, selectedAttendanceDate, localAttendancePolicy)) {
      return false;
    }

    if (attendanceViewMode === "class") {
      return (
        selectedAttendanceClassNames.has(register.className) &&
        (!selectedAttendanceArm || register.arm === selectedAttendanceArm)
      );
    }

    if (attendanceViewMode === "student") {
      return register.entries.some((entry) => entry.regNumber === selectedAttendanceStudentRegNumber);
    }

    return true;
  });
  const scopedAttendanceSummaries = buildScopedAttendanceSummaries(filteredAttendanceRegisters, localProfiles);
  const visibleAttendanceSummaries = scopedAttendanceSummaries.filter((summary) => {
    const profile = localProfiles.find((item) => item.regNumber === summary.regNumber);
    const text = [
      summary.studentName ?? "",
      summary.regNumber,
      summary.className ?? "",
      summary.arm ?? "",
      profile ? profileSearchText(profile) : "",
    ]
      .join(" ")
      .toLowerCase();

    return deferredAttendanceSearch ? text.includes(deferredAttendanceSearch) : true;
  });
  const selectedAttendanceStudentSummary =
    scopedAttendanceSummaries.find((summary) => summary.regNumber === selectedAttendanceStudentRegNumber) ?? null;
  const selectedAttendanceStudentRegisters = filteredAttendanceRegisters
    .filter((register) => register.entries.some((entry) => entry.regNumber === selectedAttendanceStudentRegNumber))
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
  const selectedProfileAttendanceHistory = selectedAttendanceStudentRegisters.map((register) => ({
    date: register.date,
    status:
      register.entries.find((entry) => entry.regNumber === selectedAttendanceStudentRegNumber)?.status ?? "present",
    className: register.className,
    arm: register.arm,
    recordedByName: register.recordedByName,
  }));
  const latestRegisters = filteredAttendanceRegisters.slice(0, 8);
  const portalVisibleReports = localReports.filter((report) => report.showOnPortal).length;
  const resultVisibleReports = localReports.filter((report) => report.showOnResultSheet).length;
  const activeAccounts = localCredentials.filter((credential) => credential.accountState === "active").length;
  const pendingAbsenceRequests = localAbsenceRequests.filter((request) => request.status === "pending").length;
  useEffect(() => {
    setCurrentOrigin(window.location.origin);
  }, []);

  function updateSelectedProfile(
    field: keyof StudentProfileRecord,
    value: string | number | string[] | undefined,
  ) {
    setLocalProfiles((current) =>
      current.map((profile) =>
        profile.regNumber === selectedProfile?.regNumber
          ? {
              ...profile,
              [field]: value,
            }
          : profile,
      ),
    );
  }

  function updateCredential(
    regNumber: string,
    field: keyof StudentPortalCredential,
    value: string | undefined,
  ) {
    setLocalCredentials((current) =>
      current.map((credential) =>
        credential.regNumber === regNumber
          ? {
              ...credential,
              [field]: value,
            }
          : credential,
      ),
    );
  }

  async function handleReportAttachmentChange(file: File | null) {
    if (!file) {
      setReportDraft((current) => ({
        ...current,
        attachmentLabel: "",
        attachmentUrl: "",
        attachmentMimeType: "",
        attachmentSizeBytes: 0,
      }));
      return;
    }

    try {
      const payload = await buildInlineAttachmentPayload(file);
      setReportDraft((current) => ({
        ...current,
        attachmentLabel: payload.label,
        attachmentUrl: payload.url,
        attachmentMimeType: payload.mimeType,
        attachmentSizeBytes: payload.sizeBytes,
      }));
      setFeedback(`Attached ${payload.label}. It will be saved with the student report.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not attach that file right now.");
    }
  }

  async function handleStudentPhotoChange(file: File | null) {
    if (!selectedProfile) {
      return;
    }

    if (!file) {
      updateSelectedProfile("passportUrl", "");
      setFeedback(`Cleared ${selectedProfile.fullName}'s photo locally. Save the profile to publish the change.`);
      return;
    }

    try {
      const payload = await buildInlineAttachmentPayload(file);
      updateSelectedProfile("passportUrl", payload.url);
      setFeedback(`Loaded a new student photo for ${selectedProfile.fullName}. Save the profile to make it live.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not load that student photo right now.");
    }
  }

  function whatsappHref(parentName: string, phone: string, profile: StudentProfileRecord) {
    const normalizedPhone = normalizeWhatsappNumber(phone);

    if (!normalizedPhone) {
      return "#";
    }

    const credential = localCredentials.find((item) => item.regNumber === profile.regNumber);
    const summary = liveSummaries.find((item) => item.bundle.student.regNumber === profile.regNumber);
    const latestPortalReport = localReports
      .filter((report) => report.regNumber === profile.regNumber)
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0];
    const attendanceSummary = scopedAttendanceSummaries.find((item) => item.regNumber === profile.regNumber) ??
      buildScopedAttendanceSummaries(attendanceRegisters, localProfiles).find((item) => item.regNumber === profile.regNumber);
    const portalUrl = `${currentOrigin}/portal`;
    const directResultUrl =
      credential?.couponCode
        ? `${currentOrigin}${buildShortResultPath(credential.couponCode)}`
        : "";
    const lines = [
      `Hello ${parentName},`,
      "",
      `This is the Students Affairs Desk of ${school.name}.`,
      "",
      `STUDENT`,
      `${profile.fullName}`,
      `${profile.regNumber}`,
      `${profile.className} - ${profile.arm}`,
      "",
      `PORTAL ACCESS`,
      credential ? `Username: ${credential.username}` : "Username: Not yet issued",
      credential ? `Password: ${credential.temporaryPassword}` : "Password: Contact the school",
      `Portal: ${portalUrl}`,
      "",
      `ATTENDANCE`,
      attendanceSummary
        ? `Present ${attendanceSummary.present}, Absent ${attendanceSummary.absent}, Late ${attendanceSummary.late}, Excused ${attendanceSummary.excused}, Attendance ${attendanceSummary.percentage}%`
        : "Attendance summary is not yet available.",
      "",
      `RESULT STATUS`,
      summary
        ? `Current standing: ${summary.weightedAverage}% (${summary.overallGrade.label})`
        : "Current term result is not yet released.",
      directResultUrl ? `Direct result link: ${directResultUrl}` : "Direct result link will appear after release.",
      "",
      `LATEST SCHOOL NOTE`,
      latestPortalReport ? `${latestPortalReport.title}: ${latestPortalReport.body}` : "No new school note has been logged yet.",
      "",
      `Please review the portal details, attendance, and school note above. Reply on WhatsApp or contact the school if any clarification is needed.`,
      "",
      `Regards,`,
      `${school.shortName} Students Affairs`,
    ].filter(Boolean);

    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(lines.join("\n"))}`;
  }

  async function saveSelectedProfile() {
    if (!selectedProfile) {
      return;
    }

    setBusyKey(`profile:${selectedProfile.regNumber}`);

    try {
      const response = await fetch(
        `/api/student-affairs/profiles/${encodeURIComponent(selectedProfile.regNumber)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(selectedProfile),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        profile?: StudentProfileRecord;
        credential?: StudentPortalCredential | null;
      };

      if (!response.ok || !payload.profile) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalProfiles((current) =>
        current.map((profile) => (profile.regNumber === payload.profile?.regNumber ? payload.profile : profile)),
      );
      if (payload.credential) {
        setLocalCredentials((current) =>
          current.map((credential) =>
            credential.regNumber === payload.credential?.regNumber ? payload.credential : credential,
          ),
        );
      }
      setFeedback(
        `Saved biodata for ${payload.profile.fullName}. Student information and parent contacts are now updated across the portal.`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save the student biodata right now.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveCredential(regNumber: string) {
    const credential = localCredentials.find((item) => item.regNumber === regNumber);

    if (!credential) {
      return;
    }

    setBusyKey(`credential:${regNumber}`);

    try {
      const response = await fetch(
        `/api/student-affairs/accounts/${encodeURIComponent(regNumber)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credential),
        },
      );
      const payload = (await response.json()) as { error?: string; credential?: StudentPortalCredential };

      if (!response.ok || !payload.credential) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalCredentials((current) =>
        current.map((item) => (item.regNumber === payload.credential?.regNumber ? payload.credential : item)),
      );
      setFeedback(
        `Updated portal account details for ${payload.credential.studentName}. Account activation and login pack changes are now live.`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not update the student account right now.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveReport() {
    if (!selectedProfile) {
      return;
    }

    setBusyKey(`report:${selectedProfile.regNumber}`);

    try {
      const response = await fetch("/api/student-affairs/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regNumber: selectedProfile.regNumber,
          title: reportDraft.title,
          body: reportDraft.body,
          category: reportDraft.category,
          subjectName: reportDraft.subjectName,
          showOnPortal: reportDraft.showOnPortal,
          showOnResultSheet: reportDraft.showOnResultSheet,
          praise: reportDraft.praise,
          attachmentLabel: reportDraft.attachmentLabel,
          attachmentUrl: reportDraft.attachmentUrl,
          attachmentMimeType: reportDraft.attachmentMimeType,
          attachmentSizeBytes: reportDraft.attachmentSizeBytes,
        }),
      });
      const payload = (await response.json()) as { error?: string; report?: StudentReportEntry };

      if (!response.ok || !payload.report) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalReports((current) => [payload.report!, ...current]);
      setReportDraft({
        title: "",
        body: "",
        category: "general",
        subjectName: "",
        showOnPortal: true,
        showOnResultSheet: false,
        praise: false,
        attachmentLabel: "",
        attachmentUrl: "",
        attachmentMimeType: "",
        attachmentSizeBytes: 0,
      });
      setFeedback(
        `Logged a new ${categoryLabel(payload.report.category).toLowerCase()} note for ${payload.report.studentName}. Attachments and portal visibility were saved together.`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save the student report right now.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveAttendancePolicy(patch: Partial<StudentAttendancePolicy>) {
    setBusyKey("attendance-policy");

    try {
      const response = await fetch("/api/student-attendance/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = (await response.json()) as { error?: string; policy?: StudentAttendancePolicy };

      if (!response.ok || !payload.policy) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalAttendancePolicy(payload.policy);
      setFeedback(
        `Attendance policy updated. Term attendance is now ${payload.policy.attendanceEnabled ? "active" : "paused"} for class-teacher work.`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not update the attendance policy right now.");
    } finally {
      setBusyKey(null);
    }
  }

  async function decideAbsenceRequest(requestId: string, status: StudentAbsenceRequest["status"]) {
    setBusyKey(`absence:${requestId}:${status}`);

    try {
      const response = await fetch(`/api/student-absence-requests/${encodeURIComponent(requestId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          decisionNote:
            status === "approved"
              ? "Approved from the Students Affairs attendance desk."
              : "Rejected from the Students Affairs attendance desk.",
        }),
      });
      const payload = (await response.json()) as { error?: string; request?: StudentAbsenceRequest };

      if (!response.ok || !payload.request) {
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
      }

      setLocalAbsenceRequests((current) =>
        current.map((request) => (request.id === payload.request?.id ? payload.request : request)),
      );
      setFeedback(
        `${payload.request.studentName}'s absence request is now ${resultStatusLabel(payload.request.status).toLowerCase()}.`,
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not update the absence request right now.");
    } finally {
      setBusyKey(null);
    }
  }

  const overviewView = (
    <>
      <section className="metric-grid compact">
        <article className="metric-card">
          <span>Student profiles</span>
          <strong>{localProfiles.length}</strong>
          <p className="muted">Biodata and lifecycle records under students affairs</p>
        </article>
        <article className="metric-card">
          <span>Active portal accounts</span>
          <strong>{activeAccounts}</strong>
          <p className="muted">Student accounts still active for sign-in</p>
        </article>
        <article className="metric-card">
          <span>Portal-visible reports</span>
          <strong>{portalVisibleReports}</strong>
          <p className="muted">Teacher notes and praise visible to student accounts</p>
        </article>
        <article className="metric-card">
          <span>Pending absence requests</span>
          <strong>{pendingAbsenceRequests}</strong>
          <p className="muted">Student leave requests waiting for decision</p>
        </article>
      </section>

      <section className="callout-banner">
        <strong>{feedback}</strong>
        <p className="muted">
          Reports marked for the portal appear in the student dashboard, result-sheet notes update the live class-teacher comment, and parent WhatsApp sharing now reads from the same student record.
        </p>
      </section>

      <section className="grid-layout two-wide">
        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Students Affairs Menus</p>
              <h3>Open the working submenus</h3>
            </div>
          </div>
          <div className="stack-list">
            <Link href="/dashboard/student-affairs/student-info" className="selection-card">
              <strong>Student Info</strong>
              <p>Edit biodata, parent contact details, lifecycle status, and student profile records.</p>
            </Link>
            <Link href="/dashboard/student-affairs/student-accounts" className="selection-card">
              <strong>Student Accounts</strong>
              <p>Manage usernames, temporary passwords, coupon linkage, and portal activation state.</p>
            </Link>
            <Link href="/dashboard/student-affairs/reports" className="selection-card">
              <strong>Reports</strong>
              <p>Read teacher notes, upload attachments, and decide what appears on the portal or result sheet.</p>
            </Link>
            <Link href="/dashboard/student-affairs/attendance" className="selection-card">
              <strong>Attendance and Leave</strong>
              <p>Track attendance by class or student across time ranges and decide absence requests.</p>
            </Link>
          </div>
        </article>

        <article className="surface-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Recent Student Reports</p>
              <h3>Latest notes across the school</h3>
            </div>
          </div>
          <div className="timeline">
            {localReports.slice(0, 6).map((report) => (
              <article key={report.id} className="timeline-item">
                <strong>{report.studentName} - {report.title}</strong>
                <p>{report.body}</p>
                <span>
                  {report.authorName} - {categoryLabel(report.category)} - {formatDate(report.updatedAt)}
                </span>
              </article>
            ))}
          </div>
        </article>
      </section>
    </>
  );

  const studentInfoView = selectedProfile ? (
    <section className="grid-layout two-wide">
      <article className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Student Register</p>
            <h3>Select a student record</h3>
          </div>
        </div>
        <label className="inline-search-field">
          <span>Search students</span>
          <input
            value={studentSearch}
            onChange={(event) => setStudentSearch(event.target.value)}
            placeholder="Search by name, reg number, class, or parent contact"
          />
        </label>
        <div className="stack-list">
          {visibleStudentProfiles.map((profile) => (
            <button
              key={profile.regNumber}
              type="button"
              className={selectedProfile.regNumber === profile.regNumber ? "selection-card selected" : "selection-card"}
              onClick={() => {
                setSelectedRegNumber(profile.regNumber);
                setSelectedAttendanceStudentRegNumber(profile.regNumber);
              }}
            >
              <strong>{profile.fullName}</strong>
              <p>{profile.className} - {profile.regNumber}</p>
              <p className="muted">
                {profile.guardianName} | {resultStatusLabel(profile.studentStatus)}
              </p>
            </button>
          ))}
        </div>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Student Info</p>
            <h3>{selectedProfile.fullName}</h3>
          </div>
          <div className="button-row">
            <span className={`status-pill ${lifecycleStatusClass(selectedProfile.studentStatus)}`}>
              {resultStatusLabel(selectedProfile.studentStatus)}
            </span>
            {selectedSummary ? (
              <span className="status-pill status-approved">
                {ordinal(selectedSummary.position)} - {selectedSummary.weightedAverage}%
              </span>
            ) : null}
          </div>
        </div>
        <div className="form-grid">
          <div className="form-span-2 profile-media-panel">
            <div className={selectedProfile.passportUrl ? "profile-photo-preview image" : "profile-photo-preview"}>
              {selectedProfile.passportUrl ? (
                <img src={selectedProfile.passportUrl} alt={`${selectedProfile.fullName} profile`} className="profile-photo-image" />
              ) : (
                <span>{selectedProfile.photoInitials || "S"}</span>
              )}
            </div>
            <p className="muted profile-photo-caption">
              This student photo will appear on the profile view, student portal, and any result sheet that shows a passport image.
            </p>
            <label>
              <span>Upload student photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void handleStudentPhotoChange(event.target.files?.[0] ?? null)}
                disabled={!canManageRecords}
              />
            </label>
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                disabled={!canManageRecords}
                onClick={() => {
                  updateSelectedProfile("passportUrl", "");
                  setFeedback(`Removed ${selectedProfile.fullName}'s photo locally. Save the profile to publish the change.`);
                }}
              >
                Remove photo
              </button>
            </div>
          </div>
          <label>
            <span>Full Name</span>
            <input
              value={selectedProfile.fullName}
              onChange={(event) => updateSelectedProfile("fullName", event.target.value)}
              disabled={!canManageRecords}
            />
          </label>
          <label>
            <span>Class</span>
            <input
              value={selectedProfile.className}
              onChange={(event) => updateSelectedProfile("className", event.target.value)}
              disabled={!canManageRecords}
            />
          </label>
          <label>
            <span>Arm</span>
            <input
              value={selectedProfile.arm}
              onChange={(event) => updateSelectedProfile("arm", event.target.value)}
              disabled={!canManageRecords}
            />
          </label>
          <label>
            <span>Student Status</span>
            <select
              value={selectedProfile.studentStatus}
              onChange={(event) => updateSelectedProfile("studentStatus", event.target.value)}
              disabled={!canManageRecords}
            >
              <option value="active">Active</option>
              <option value="left">Left</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="graduated">Graduated</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
          <label>
            <span>Guardian Name</span>
            <input
              value={selectedProfile.guardianName}
              onChange={(event) => updateSelectedProfile("guardianName", event.target.value)}
              disabled={!canManageRecords}
            />
          </label>
          <label>
            <span>Guardian Phone</span>
            <input
              value={selectedProfile.guardianPhone}
              onChange={(event) => updateSelectedProfile("guardianPhone", event.target.value)}
              disabled={!canManageRecords}
            />
          </label>
          <label>
            <span>Father Name</span>
            <input
              value={selectedProfile.fatherName}
              onChange={(event) => updateSelectedProfile("fatherName", event.target.value)}
              disabled={!canManageRecords}
            />
          </label>
          <label>
            <span>Father Phone</span>
            <input
              value={selectedProfile.fatherPhone}
              onChange={(event) => updateSelectedProfile("fatherPhone", event.target.value)}
              disabled={!canManageRecords}
            />
          </label>
          <label>
            <span>Mother Name</span>
            <input
              value={selectedProfile.motherName}
              onChange={(event) => updateSelectedProfile("motherName", event.target.value)}
              disabled={!canManageRecords}
            />
          </label>
          <label>
            <span>Mother Phone</span>
            <input
              value={selectedProfile.motherPhone}
              onChange={(event) => updateSelectedProfile("motherPhone", event.target.value)}
              disabled={!canManageRecords}
            />
          </label>
          <label>
            <span>Guardian Email</span>
            <input
              value={selectedProfile.guardianEmail}
              onChange={(event) => updateSelectedProfile("guardianEmail", event.target.value)}
              disabled={!canManageRecords}
            />
          </label>
          <label>
            <span>Admission Date</span>
            <input
              type="date"
              value={selectedProfile.admissionDate}
              onChange={(event) => updateSelectedProfile("admissionDate", event.target.value)}
              disabled={!canManageRecords}
            />
          </label>
          <label>
            <span>Boarding Status</span>
            <select
              value={selectedProfile.boardingStatus}
              onChange={(event) => updateSelectedProfile("boardingStatus", event.target.value)}
              disabled={!canManageRecords}
            >
              <option value="day">Day</option>
              <option value="boarding">Boarding</option>
            </select>
          </label>
          <label>
            <span>Blood Group</span>
            <input
              value={selectedProfile.bloodGroup}
              onChange={(event) => updateSelectedProfile("bloodGroup", event.target.value)}
              disabled={!canManageRecords}
            />
          </label>
          <label>
            <span>Genotype</span>
            <input
              value={selectedProfile.genotype}
              onChange={(event) => updateSelectedProfile("genotype", event.target.value)}
              disabled={!canManageRecords}
            />
          </label>
          <label className="form-span-2">
            <span>Home Address</span>
            <input
              value={selectedProfile.homeAddress}
              onChange={(event) => updateSelectedProfile("homeAddress", event.target.value)}
              disabled={!canManageRecords}
            />
          </label>
          <label className="form-span-2">
            <span>Clubs</span>
            <input
              value={selectedProfile.clubs.join(", ")}
              onChange={(event) =>
                updateSelectedProfile(
                  "clubs",
                  event.target.value.split(",").map((club) => club.trim()).filter(Boolean),
                )
              }
              disabled={!canManageRecords}
            />
          </label>
          <label className="form-span-2">
            <span>Medical Notes</span>
            <textarea
              rows={4}
              value={selectedProfile.medicalNotes}
              onChange={(event) => updateSelectedProfile("medicalNotes", event.target.value)}
              disabled={!canManageRecords}
            />
          </label>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="primary-button"
            onClick={() => void saveSelectedProfile()}
            disabled={!canManageRecords || busyKey === `profile:${selectedProfile.regNumber}`}
          >
            {busyKey === `profile:${selectedProfile.regNumber}` ? "Saving..." : "Save student info"}
          </button>
          <Link href={`/results/${encodeURIComponent(selectedProfile.regNumber)}?preview=1`} className="secondary-button">
            Preview result sheet
          </Link>
          {selectedProfile.fatherPhone ? (
            <WhatsAppButton
              href={whatsappHref(selectedProfile.fatherName, selectedProfile.fatherPhone, selectedProfile)}
              label="WhatsApp father"
            />
          ) : null}
          {selectedProfile.motherPhone ? (
            <WhatsAppButton
              href={whatsappHref(selectedProfile.motherName, selectedProfile.motherPhone, selectedProfile)}
              label="WhatsApp mother"
            />
          ) : null}
        </div>
      </article>
    </section>
  ) : null;

  const studentAccountsView = (
    <section className="surface-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Student Accounts</p>
          <h3>Portal login and result access linkage</h3>
        </div>
      </div>
      <div className="callout-banner">
        <strong>{feedback}</strong>
        <p className="muted">
          These credentials open the student dashboard, while the portal activation switch controls whether the account can still sign in.
        </p>
      </div>
      <label className="inline-search-field">
        <span>Search student accounts</span>
        <input
          value={accountSearch}
          onChange={(event) => setAccountSearch(event.target.value)}
          placeholder="Search by student, username, coupon, class, or parent"
        />
      </label>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Username</th>
              <th>Temporary Password</th>
              <th>Issue Status</th>
              <th>Portal Access</th>
              <th>Student Status</th>
              <th>Coupon</th>
              <th>Last Sign In</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleCredentials.map((credential) => {
              const profile = localProfiles.find((item) => item.regNumber === credential.regNumber);

              return (
                <tr key={credential.id}>
                  <td>
                    <strong>{credential.studentName}</strong>
                    <p className="muted">{credential.regNumber}</p>
                  </td>
                  <td>
                    <input
                      value={credential.username}
                      onChange={(event) => updateCredential(credential.regNumber, "username", event.target.value)}
                      disabled={!canManageRecords}
                    />
                  </td>
                  <td>
                    <input
                      value={credential.temporaryPassword}
                      onChange={(event) =>
                        updateCredential(credential.regNumber, "temporaryPassword", event.target.value)
                      }
                      disabled={!canManageRecords}
                    />
                  </td>
                  <td>
                    <select
                      value={credential.status}
                      onChange={(event) => updateCredential(credential.regNumber, "status", event.target.value)}
                      disabled={!canManageRecords}
                    >
                      <option value="ready">Ready</option>
                      <option value="sent">Sent</option>
                      <option value="reset_required">Reset required</option>
                    </select>
                    <div className="status-cell">
                      <span className={`status-pill ${credentialStatusClass(credential.status)}`}>
                        {resultStatusLabel(credential.status)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <select
                      value={credential.accountState}
                      onChange={(event) => updateCredential(credential.regNumber, "accountState", event.target.value)}
                      disabled={!canManageRecords}
                    >
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                    </select>
                    <div className="status-cell">
                      <span className={`status-pill ${accountStateClass(credential.accountState)}`}>
                        {resultStatusLabel(credential.accountState)}
                      </span>
                    </div>
                    <input
                      value={credential.disabledReason ?? ""}
                      onChange={(event) => updateCredential(credential.regNumber, "disabledReason", event.target.value)}
                      disabled={!canManageRecords}
                      placeholder="Reason if disabled"
                    />
                  </td>
                  <td>
                    <span className={`status-pill ${profile ? lifecycleStatusClass(profile.studentStatus) : "status-under_review"}`}>
                      {profile ? resultStatusLabel(profile.studentStatus) : "Unknown"}
                    </span>
                  </td>
                  <td>
                    <input
                      value={credential.couponCode}
                      onChange={(event) => updateCredential(credential.regNumber, "couponCode", event.target.value)}
                      disabled={!canManageRecords}
                    />
                  </td>
                  <td>{credential.lastLoginAt ? formatDate(credential.lastLoginAt) : "Not yet used"}</td>
                  <td>
                    <div className="stack-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void saveCredential(credential.regNumber)}
                        disabled={!canManageRecords || busyKey === `credential:${credential.regNumber}`}
                      >
                        {busyKey === `credential:${credential.regNumber}` ? "Saving..." : "Save account"}
                      </button>
                      {profile?.fatherPhone ? (
                        <WhatsAppButton
                          href={whatsappHref(profile.fatherName, profile.fatherPhone, profile)}
                          label="Father"
                        />
                      ) : null}
                      {profile?.motherPhone ? (
                        <WhatsAppButton
                          href={whatsappHref(profile.motherName, profile.motherPhone, profile)}
                          label="Mother"
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );

  const reportsView = selectedProfile ? (
    <section className="grid-layout two-wide">
      <article className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Student Reports</p>
            <h3>Select a student and read the record</h3>
          </div>
          <span className="status-pill status-approved">{resultVisibleReports} result-sheet notes</span>
        </div>
        <label className="inline-search-field">
          <span>Search students and reports</span>
          <input
            value={reportSearch}
            onChange={(event) => setReportSearch(event.target.value)}
            placeholder="Search by student, class, report title, author, or attachment"
          />
        </label>
        <div className="stack-list">
          {visibleReportProfiles.map((profile) => (
            <button
              key={profile.regNumber}
              type="button"
              className={selectedProfile.regNumber === profile.regNumber ? "selection-card selected" : "selection-card"}
              onClick={() => setSelectedRegNumber(profile.regNumber)}
            >
              <strong>{profile.fullName}</strong>
              <p>{profile.className} - {profile.regNumber}</p>
              <p className="muted">
                {visibleReports.filter((report) => report.regNumber === profile.regNumber).length} matching report item(s)
              </p>
            </button>
          ))}
        </div>
      </article>

      <article className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Add Report</p>
            <h3>{selectedProfile.fullName}</h3>
          </div>
        </div>
        <div className="form-grid">
          <label>
            <span>Title</span>
            <input
              value={reportDraft.title}
              onChange={(event) => setReportDraft((current) => ({ ...current, title: event.target.value }))}
              disabled={!canManageRecords}
            />
          </label>
          <label>
            <span>Category</span>
            <select
              value={reportDraft.category}
              onChange={(event) =>
                setReportDraft((current) => ({
                  ...current,
                  category: event.target.value as StudentReportCategory,
                }))
              }
              disabled={!canManageRecords}
            >
              {REPORT_CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Subject Reference</span>
            <input
              value={reportDraft.subjectName}
              onChange={(event) => setReportDraft((current) => ({ ...current, subjectName: event.target.value }))}
              disabled={!canManageRecords}
              placeholder="Optional subject or desk"
            />
          </label>
          <label className="form-span-2">
            <span>Report Body</span>
            <textarea
              rows={5}
              value={reportDraft.body}
              onChange={(event) => setReportDraft((current) => ({ ...current, body: event.target.value }))}
              disabled={!canManageRecords}
            />
          </label>
          <label className="form-span-2">
            <span>Attachment</span>
            <input
              type="file"
              disabled={!canManageRecords}
              onChange={(event) => void handleReportAttachmentChange(event.target.files?.[0] ?? null)}
            />
          </label>
          {reportDraft.attachmentLabel ? (
            <div className="attachment-chip">
              <strong>{reportDraft.attachmentLabel}</strong>
              <span className="muted">
                {Math.max(1, Math.round(reportDraft.attachmentSizeBytes / 1024))} KB attached
              </span>
            </div>
          ) : null}
        </div>
        <div className="button-row">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={reportDraft.showOnPortal}
              onChange={(event) => setReportDraft((current) => ({ ...current, showOnPortal: event.target.checked }))}
              disabled={!canManageRecords}
            />
            <span>Show on student portal</span>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={reportDraft.showOnResultSheet}
              onChange={(event) =>
                setReportDraft((current) => ({ ...current, showOnResultSheet: event.target.checked }))
              }
              disabled={!canManageRecords}
            />
            <span>Use as result-sheet note</span>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={reportDraft.praise}
              onChange={(event) => setReportDraft((current) => ({ ...current, praise: event.target.checked }))}
              disabled={!canManageRecords}
            />
            <span>Mark as praise</span>
          </label>
          <button
            type="button"
            className="primary-button"
            onClick={() => void saveReport()}
            disabled={!canManageRecords || busyKey === `report:${selectedProfile.regNumber}`}
          >
            {busyKey === `report:${selectedProfile.regNumber}` ? "Saving..." : "Log report"}
          </button>
        </div>

        <div className="timeline">
          {selectedReports.length > 0 ? (
            selectedReports
              .filter((report) => deferredReportSearch ? reportSearchText(report).includes(deferredReportSearch) : true)
              .map((report) => (
                <article key={report.id} className="timeline-item">
                  <strong>{report.title}</strong>
                  <p>{report.body}</p>
                  <span>
                    {report.authorName} - {categoryLabel(report.category)} - {formatDate(report.updatedAt)}
                  </span>
                  <p className="muted">
                    Portal: {report.showOnPortal ? "Yes" : "No"} | Result sheet: {report.showOnResultSheet ? "Yes" : "No"}
                  </p>
                  {report.attachmentLabel && report.attachmentUrl ? (
                    <p className="muted">
                      <a href={report.attachmentUrl} download={report.attachmentLabel} className="inline-link">
                        Open attachment: {report.attachmentLabel}
                      </a>
                    </p>
                  ) : null}
                </article>
              ))
          ) : (
            <div className="flow-step">
              <strong>No report has been logged for this student yet.</strong>
              <p>Teacher and welfare notes added from this desk will appear here, including file attachments.</p>
            </div>
          )}
        </div>
      </article>
    </section>
  ) : null;

  const attendanceView = (
    <>
      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Attendance Policy</p>
            <h3>Attendance tracking and absence approvals</h3>
          </div>
        </div>
        <div className="callout-banner">
          <strong>{feedback}</strong>
          <p className="muted">
            Track attendance by class or by student across day, week, month, term, or session ranges, then decide pending absence leave from the same desk.
          </p>
        </div>
        <div className="button-row">
          <button
            type="button"
            className={localAttendancePolicy.attendanceEnabled ? "secondary-button" : "primary-button"}
            disabled={!canManageAttendancePolicy || busyKey === "attendance-policy"}
            onClick={() => void saveAttendancePolicy({ attendanceEnabled: !localAttendancePolicy.attendanceEnabled })}
          >
            {busyKey === "attendance-policy"
              ? "Saving..."
              : localAttendancePolicy.attendanceEnabled
                ? "Pause term attendance"
                : "Activate term attendance"}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!canManageAttendancePolicy || busyKey === "attendance-policy"}
            onClick={() =>
              void saveAttendancePolicy({
                classTeacherCommentEnabled: !localAttendancePolicy.classTeacherCommentEnabled,
              })
            }
          >
            {localAttendancePolicy.classTeacherCommentEnabled
              ? "Pause result-sheet class comments"
              : "Enable result-sheet class comments"}
          </button>
        </div>
      </section>

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Attendance Tracker</p>
            <h3>Search and filter attendance</h3>
          </div>
        </div>
        <div className="button-row">
          <button
            type="button"
            className={attendanceViewMode === "overview" ? "primary-button" : "secondary-button"}
            onClick={() => setAttendanceViewMode("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            className={attendanceViewMode === "class" ? "primary-button" : "secondary-button"}
            onClick={() => setAttendanceViewMode("class")}
          >
            By class
          </button>
          <button
            type="button"
            className={attendanceViewMode === "student" ? "primary-button" : "secondary-button"}
            onClick={() => setAttendanceViewMode("student")}
          >
            By student
          </button>
        </div>
        <div className="form-grid">
          <label>
            <span>Time Scope</span>
            <select
              value={selectedAttendanceTimeScope}
              onChange={(event) => setSelectedAttendanceTimeScope(event.target.value as AttendanceTimeScope)}
            >
              {ATTENDANCE_TIME_SCOPE_OPTIONS.map((scope) => (
                <option key={scope} value={scope}>
                  {resultStatusLabel(scope)}
                </option>
              ))}
            </select>
          </label>
          {selectedAttendanceTimeScope === "day" || selectedAttendanceTimeScope === "week" || selectedAttendanceTimeScope === "month" ? (
            <label>
              <span>Reference Date</span>
              <input
                type="date"
                value={selectedAttendanceDate}
                onChange={(event) => setSelectedAttendanceDate(event.target.value)}
              />
            </label>
          ) : null}
          {attendanceViewMode === "class" ? (
            <>
              <label>
                <span>Class</span>
                <select
                  value={selectedAttendanceClassName}
                  onChange={(event) => {
                    const nextClassName = event.target.value;
                    setSelectedAttendanceClassName(nextClassName);
                    const nextArm =
                      structureSource.find((item) => item.baseClassName === nextClassName)?.arm ?? "";
                    setSelectedAttendanceArm(nextArm);
                  }}
                >
                  {classOptions.map((className) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Arm</span>
                <select
                  value={selectedAttendanceArm}
                  onChange={(event) => setSelectedAttendanceArm(event.target.value)}
                >
                  {selectedAttendanceArmOptions.map((arm) => (
                    <option key={arm} value={arm}>
                      {arm}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <label className={attendanceViewMode === "student" ? "form-span-2" : undefined}>
            <span>Search students</span>
            <input
              value={attendanceSearch}
              onChange={(event) => setAttendanceSearch(event.target.value)}
              placeholder="Search by student, reg number, class, arm, or parent"
            />
          </label>
        </div>

        {attendanceViewMode === "overview" ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Late</th>
                  <th>Excused</th>
                  <th>Days</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {visibleAttendanceSummaries.map((summary) => (
                  <tr key={summary.regNumber}>
                    <td>
                      <strong>{summary.studentName}</strong>
                      <p className="muted">{summary.regNumber}</p>
                    </td>
                    <td>
                      {summary.className}
                      {summary.arm ? ` - ${summary.arm}` : ""}
                    </td>
                    <td>{summary.present}</td>
                    <td>{summary.absent}</td>
                    <td>{summary.late}</td>
                    <td>{summary.excused}</td>
                    <td>{summary.possible}</td>
                    <td>{summary.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {attendanceViewMode === "class" ? (
          <section className="grid-layout two-wide">
            <article className="surface-card inset-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Class Summary</p>
                  <h3>{selectedAttendanceClassName}</h3>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Late</th>
                      <th>Excused</th>
                      <th>Days</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAttendanceSummaries
                      .filter(
                        (summary) =>
                          selectedAttendanceClassNames.has(summary.className ?? "") &&
                          (!selectedAttendanceArm || summary.arm === selectedAttendanceArm),
                      )
                      .map((summary) => (
                        <tr key={summary.regNumber}>
                          <td>
                            <strong>{summary.studentName}</strong>
                            <p className="muted">{summary.regNumber}</p>
                          </td>
                          <td>{summary.present}</td>
                          <td>{summary.absent}</td>
                          <td>{summary.late}</td>
                          <td>{summary.excused}</td>
                          <td>{summary.possible}</td>
                          <td>{summary.percentage}%</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="surface-card inset-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Register History</p>
                  <h3>Filtered by selected time</h3>
                </div>
              </div>
              <div className="timeline">
                {latestRegisters.map((register) => (
                  <article key={register.id} className="timeline-item">
                    <strong>{register.className} - {register.arm}</strong>
                    <p>{formatDateOnly(register.date)} - {register.entries.length} student mark(s) submitted.</p>
                    <span>{register.recordedByName} - {formatDate(register.updatedAt)}</span>
                  </article>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {attendanceViewMode === "student" ? (
          <section className="grid-layout two-wide">
            <article className="surface-card inset-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Students</p>
                  <h3>Search and select a student</h3>
                </div>
              </div>
              <div className="stack-list">
                {visibleAttendanceProfiles.map((profile) => (
                  <button
                    key={profile.regNumber}
                    type="button"
                    className={
                      selectedAttendanceStudentRegNumber === profile.regNumber ? "selection-card selected" : "selection-card"
                    }
                    onClick={() => setSelectedAttendanceStudentRegNumber(profile.regNumber)}
                  >
                    <strong>{profile.fullName}</strong>
                    <p>{profile.className} - {profile.regNumber}</p>
                    <p className="muted">{profile.fatherPhone || profile.motherPhone || profile.guardianPhone}</p>
                  </button>
                ))}
              </div>
            </article>

            <article className="surface-card inset-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Student Attendance</p>
                  <h3>
                    {localProfiles.find((profile) => profile.regNumber === selectedAttendanceStudentRegNumber)?.fullName ?? "Student"}
                  </h3>
                </div>
                {selectedAttendanceStudentSummary ? (
                  <span className="status-pill status-approved">
                    {selectedAttendanceStudentSummary.percentage}% attendance
                  </span>
                ) : null}
              </div>
              {selectedAttendanceStudentSummary ? (
                <>
                  <div className="inline-metrics">
                    <div>
                      <span>Present</span>
                      <strong>{selectedAttendanceStudentSummary.present}</strong>
                    </div>
                    <div>
                      <span>Absent</span>
                      <strong>{selectedAttendanceStudentSummary.absent}</strong>
                    </div>
                    <div>
                      <span>Late</span>
                      <strong>{selectedAttendanceStudentSummary.late}</strong>
                    </div>
                    <div>
                      <span>Excused</span>
                      <strong>{selectedAttendanceStudentSummary.excused}</strong>
                    </div>
                    <div>
                      <span>School Days</span>
                      <strong>{selectedAttendanceStudentSummary.possible}</strong>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Class</th>
                          <th>Status</th>
                          <th>Recorded By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProfileAttendanceHistory.map((entry) => (
                          <tr key={`${entry.date}-${entry.className}`}>
                            <td>{formatDateOnly(entry.date)}</td>
                            <td>{entry.className} - {entry.arm}</td>
                            <td>{resultStatusLabel(entry.status)}</td>
                            <td>{entry.recordedByName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(() => {
                    const attendanceProfile = localProfiles.find(
                      (profile) => profile.regNumber === selectedAttendanceStudentRegNumber,
                    );

                    return attendanceProfile ? (
                      <div className="button-row">
                        {attendanceProfile.fatherPhone ? (
                          <WhatsAppButton
                            href={whatsappHref(attendanceProfile.fatherName, attendanceProfile.fatherPhone, attendanceProfile)}
                            label="Share with father"
                          />
                        ) : null}
                        {attendanceProfile.motherPhone ? (
                          <WhatsAppButton
                            href={whatsappHref(attendanceProfile.motherName, attendanceProfile.motherPhone, attendanceProfile)}
                            label="Share with mother"
                          />
                        ) : null}
                      </div>
                    ) : null;
                  })()}
                </>
              ) : (
                <div className="flow-step">
                  <strong>No filtered attendance record is available for this student.</strong>
                  <p>Adjust the time range or choose another student to inspect attendance history.</p>
                </div>
              )}
            </article>
          </section>
        ) : null}
      </section>

      <section className="surface-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Absence Leave Requests</p>
            <h3>Student leave approval queue</h3>
          </div>
          <span className={`status-pill ${pendingAbsenceRequests > 0 ? "status-under_review" : "status-approved"}`}>
            {pendingAbsenceRequests} pending
          </span>
        </div>
        <label className="inline-search-field">
          <span>Search requests</span>
          <input
            value={absenceSearch}
            onChange={(event) => setAbsenceSearch(event.target.value)}
            placeholder="Search by student, class, reason, or status"
          />
        </label>
        <div className="timeline">
          {visibleAbsenceRequests.map((request) => (
            <article key={request.id} className="timeline-item">
              <strong>{request.studentName}</strong>
              <p>
                {formatDateOnly(request.requestedFrom)} to {formatDateOnly(request.requestedTo)} - {request.reason}
              </p>
              <span>
                {resultStatusLabel(request.status)} - Requested {formatDate(request.requestedAt)}
              </span>
              {request.decisionNote ? <p className="muted">Decision note: {request.decisionNote}</p> : null}
              {request.attachmentLabel && request.attachmentUrl ? (
                <p className="muted">
                  <a href={request.attachmentUrl} download={request.attachmentLabel} className="inline-link">
                    Open attachment: {request.attachmentLabel}
                  </a>
                </p>
              ) : null}
              <div className="button-row">
                <span className={`status-pill ${absenceStatusClass(request.status)}`}>
                  {resultStatusLabel(request.status)}
                </span>
                {canManageAbsenceRequests && request.status === "pending" ? (
                  <>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void decideAbsenceRequest(request.id, "approved")}
                      disabled={busyKey === `absence:${request.id}:approved`}
                    >
                      {busyKey === `absence:${request.id}:approved` ? "Saving..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void decideAbsenceRequest(request.id, "rejected")}
                      disabled={busyKey === `absence:${request.id}:rejected`}
                    >
                      {busyKey === `absence:${request.id}:rejected` ? "Saving..." : "Reject"}
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );

  const viewContent =
    view === "overview"
      ? overviewView
      : view === "student_info"
        ? studentInfoView
        : view === "student_accounts"
          ? studentAccountsView
          : view === "reports"
            ? reportsView
            : attendanceView;

  return <>{viewContent}</>;
}
