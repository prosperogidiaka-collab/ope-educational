import { NextResponse } from "next/server";

import { isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { combineClassArm, inferBaseClassName } from "@/lib/class-structure";
import {
  type StoredStaffAccount,
  readStoredStaffAccounts,
  writeStoredStaffAccounts,
} from "@/lib/staff-accounts-store";
import {
  readSubjectTeacherAssignments,
  writeSubjectTeacherAssignments,
} from "@/lib/subject-teacher-assignments-store";
import { readSchoolTimetable, saveSchoolTimetable } from "@/lib/school-timetable-store";
import type {
  SchoolTimetable,
  SubjectTeacherAssignment,
  TimetableEntry,
  TimetablePeriod,
} from "@/lib/types";

function canEditTimetable(account: NonNullable<Awaited<ReturnType<typeof getCurrentStaffAccount>>>) {
  return isSchoolAdminRole(account.role) || account.role === "registrar" || Boolean(account.canRegisterStudents);
}

function isValidEntry(entry: Partial<TimetableEntry>) {
  return Boolean(
    entry.day &&
      entry.periodId &&
      entry.periodLabel &&
      entry.startTime &&
      entry.endTime &&
      entry.teacherName?.trim() &&
      entry.subjectName?.trim() &&
      (entry.baseClassName?.trim() || entry.className?.trim()) &&
      entry.arm?.trim(),
  );
}

function normalizeText(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildAssignmentId(entry: TimetableEntry) {
  return `tt_${entry.subjectName}_${entry.className}_${entry.arm}_${entry.track || "general"}`
    .replace(/[^a-z0-9]+/gi, "_")
    .toLowerCase();
}

function buildSubjectCode(subjectName: string) {
  const parts = subjectName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "SUBJ";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 4).toUpperCase();
  }

  return parts.map((part) => part[0]).join("").slice(0, 5).toUpperCase();
}

function refreshAccountTeachingScopes(
  account: StoredStaffAccount,
  assignments: SubjectTeacherAssignment[],
) {
  const teachingAssignments = assignments.filter(
    (assignment) => assignment.active !== false && assignment.teacherAccountId === account.id,
  );
  const teachingArms = uniqueStrings(teachingAssignments.map((assignment) => assignment.className));
  const teachingSubjects = uniqueStrings(teachingAssignments.map((assignment) => assignment.subjectName));

  if (account.role === "teacher" || account.role === "class_teacher") {
    return {
      ...account,
      assignedArms: uniqueStrings([...account.classTeacherArms, ...teachingArms]),
      assignedSubjects: teachingSubjects,
    };
  }

  return {
    ...account,
    assignedArms: uniqueStrings([...account.assignedArms, ...teachingArms]),
    assignedSubjects: teachingSubjects,
  };
}

function syncAssignmentsFromTimetable(
  entries: TimetableEntry[],
  currentAssignments: SubjectTeacherAssignment[],
  storedAccounts: StoredStaffAccount[],
  actorName: string,
  schoolCode: string,
  timestamp: string,
) {
  const teacherByName = new Map(
    storedAccounts.map((account) => [account.fullName.toLowerCase(), account]),
  );
  const assignmentMap = new Map(currentAssignments.map((assignment) => [assignment.id, assignment]));
  const coveredKeys = new Set<string>();
  const timetableOwnershipRows = new Map<string, TimetableEntry>();

  entries.forEach((entry) => {
    const key = [
      normalizeText(entry.className),
      normalizeText(entry.arm),
      normalizeText(entry.subjectName),
      normalizeText(entry.track),
    ].join("::");

    if (!timetableOwnershipRows.has(key)) {
      timetableOwnershipRows.set(key, entry);
    }
  });

  timetableOwnershipRows.forEach((entry, key) => {
    const matchedTeacher = teacherByName.get(entry.teacherName.toLowerCase());
    const existing = currentAssignments.find((assignment) =>
      normalizeText(assignment.className) === normalizeText(entry.className) &&
      normalizeText(assignment.arm) === normalizeText(entry.arm) &&
      normalizeText(assignment.subjectName) === normalizeText(entry.subjectName) &&
      normalizeText(assignment.track) === normalizeText(entry.track),
    );

    if (existing) {
      coveredKeys.add(existing.id);
      assignmentMap.set(existing.id, {
        ...existing,
        className: entry.className,
        arm: entry.arm,
        track: entry.track,
        active: true,
        teacherAccountId: existing.manualOverride ? existing.teacherAccountId : matchedTeacher?.id,
        teacherName: existing.manualOverride ? existing.teacherName : (matchedTeacher?.fullName ?? entry.teacherName),
        assignmentSource: existing.manualOverride ? existing.assignmentSource ?? "manual" : "timetable",
        manualOverride: existing.manualOverride ?? false,
        assignedBy: actorName,
        assignedAt: existing.assignedAt ?? timestamp,
        updatedAt: timestamp,
      });
      return;
    }

    const assignmentId = buildAssignmentId(entry);
    coveredKeys.add(assignmentId);
    assignmentMap.set(assignmentId, {
      id: assignmentId,
      schoolCode,
      subjectId: assignmentId,
      subjectCode: buildSubjectCode(entry.subjectName),
      subjectName: entry.subjectName,
      className: entry.className,
      arm: entry.arm,
      section: undefined,
      track: entry.track,
      subjectType: "core",
      active: true,
      assignmentSource: "timetable",
      manualOverride: false,
      teacherAccountId: matchedTeacher?.id,
      teacherName: matchedTeacher?.fullName ?? entry.teacherName,
      assignedBy: actorName,
      assignedAt: timestamp,
      updatedAt: timestamp,
    });
  });

  currentAssignments.forEach((assignment) => {
    if (
      assignment.assignmentSource === "timetable" &&
      assignment.manualOverride !== true &&
      !coveredKeys.has(assignment.id)
    ) {
      assignmentMap.set(assignment.id, {
        ...assignment,
        active: false,
        updatedAt: timestamp,
      });
    }
  });

  return Array.from(assignmentMap.values()).sort((left, right) => left.className.localeCompare(right.className));
}

export async function PUT(request: Request) {
  const [session, account] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canEditTimetable(account)) {
    return NextResponse.json(
      { error: "Only the school admin, principal, or assigned registrar can upload or publish timetables." },
      { status: 403 },
    );
  }

  const [currentTimetable, currentAssignments, storedAccounts] = await Promise.all([
    readSchoolTimetable(),
    readSubjectTeacherAssignments(),
    readStoredStaffAccounts(),
  ]);

  const scopedAccounts = storedAccounts.filter((staffAccount) => staffAccount.schoolCode === account.schoolCode);
  const body = (await request.json()) as Partial<SchoolTimetable>;
  const periods = (body.periods ?? []).filter(
    (period): period is TimetablePeriod =>
      Boolean(period?.id && period.label?.trim() && period.startTime?.trim() && period.endTime?.trim()),
  );
  const teacherByName = new Map(scopedAccounts.map((staffAccount) => [staffAccount.fullName.toLowerCase(), staffAccount]));
  const entries = (body.entries ?? [])
    .filter(isValidEntry)
    .map((entry, index) => {
      const baseClassName = entry.baseClassName?.trim() || inferBaseClassName(entry.className ?? "", entry.arm);
      const arm = entry.arm!.trim();
      const className = combineClassArm(baseClassName, arm) || entry.className!.trim();
      const matchedTeacher = teacherByName.get(entry.teacherName!.trim().toLowerCase());

      return {
        id:
          entry.id ||
          `${entry.day}-${entry.periodId}-${entry.teacherName}-${entry.subjectName}-${baseClassName}-${arm}-${entry.track || "general"}-${index}`
            .replace(/[^a-z0-9]+/gi, "_")
            .toLowerCase(),
        schoolCode: account.schoolCode,
        day: entry.day!,
        periodId: entry.periodId!,
        periodLabel: entry.periodLabel!.trim(),
        startTime: entry.startTime!.trim(),
        endTime: entry.endTime!.trim(),
        teacherName: entry.teacherName!.trim(),
        teacherAccountId: matchedTeacher?.id,
        subjectName: entry.subjectName!.trim(),
        baseClassName,
        className,
        arm,
        track: entry.track?.trim() || undefined,
        room: entry.room?.trim() || undefined,
      };
    });

  const timestamp = new Date().toISOString();
  const nextAssignments = syncAssignmentsFromTimetable(
    entries,
    currentAssignments.filter((assignment) => assignment.schoolCode === account.schoolCode),
    scopedAccounts,
    account.fullName,
    account.schoolCode,
    timestamp,
  );
  const mergedAssignments = currentAssignments.map((assignment) => {
    if (assignment.schoolCode !== account.schoolCode) {
      return assignment;
    }

    const replacement = nextAssignments.find((item) => item.id === assignment.id);
    return replacement ?? assignment;
  });

  nextAssignments.forEach((assignment) => {
    if (!mergedAssignments.some((item) => item.id === assignment.id)) {
      mergedAssignments.push(assignment);
    }
  });

  const nextAccounts = storedAccounts.map((staffAccount) =>
    staffAccount.schoolCode === account.schoolCode
      ? refreshAccountTeachingScopes(staffAccount, nextAssignments)
      : staffAccount,
  );

  const nextTimetable: SchoolTimetable = {
    ...currentTimetable,
    periods: periods.length > 0 ? periods : currentTimetable.periods,
    entries,
    publishState: body.publishState === "published" ? "published" : "draft",
    publishedAt: body.publishState === "published" ? timestamp : undefined,
    publishedBy: body.publishState === "published" ? account.fullName : undefined,
    updatedAt: timestamp,
    updatedBy: account.fullName,
  };

  const [saved] = await Promise.all([
    saveSchoolTimetable(nextTimetable),
    writeSubjectTeacherAssignments(mergedAssignments),
    writeStoredStaffAccounts(nextAccounts),
  ]);
  return NextResponse.json({ timetable: saved });
}
