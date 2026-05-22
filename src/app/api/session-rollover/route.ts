import { NextResponse } from "next/server";

import { isSchoolAdminRole } from "@/lib/auth";
import { readAcademicConfig } from "@/lib/academic-config-store";
import { combineClassArm, inferBaseClassName } from "@/lib/class-structure";
import {
  readAllClassOfferings,
  saveClassOffering,
} from "@/lib/class-offerings-store";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { saveSessionRolloverRecord } from "@/lib/session-rollover-store";
import {
  readSubjectTeacherAssignments,
  writeSubjectTeacherAssignments,
} from "@/lib/subject-teacher-assignments-store";
import type { ClassOffering, SessionRolloverActionType, SessionRolloverRecord } from "@/lib/types";

function canManageSessionRollover(account: NonNullable<Awaited<ReturnType<typeof getCurrentStaffAccount>>>) {
  return isSchoolAdminRole(account.role) || account.role === "registrar" || Boolean(account.canRegisterStudents);
}

function nextSessionLabel(session: string) {
  const match = session.match(/^(\d{4})\/(\d{4})$/);

  if (!match) {
    return `${session} Next Session`;
  }

  return `${Number(match[1]) + 1}/${Number(match[2]) + 1}`;
}

function promoteClassName(className: string) {
  const match = className.match(/^([A-Za-z]+)(\d+)(.*)$/);

  if (!match) {
    return className;
  }

  return `${match[1]}${Number(match[2]) + 1}${match[3]}`;
}

function cloneOfferingForNextSession(offering: ClassOffering, nextSession: string, actorName: string) {
  const nextBaseClassName = promoteClassName(
    offering.baseClassName || inferBaseClassName(offering.className, offering.arm),
  );
  const nextClassName = combineClassArm(nextBaseClassName, offering.arm);

  return {
    ...offering,
    id: `${nextSession}-${nextClassName}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase(),
    session: nextSession,
    baseClassName: nextBaseClassName,
    className: nextClassName,
    status: "active" as const,
    publicationProgress: 0,
    updatedAt: new Date().toISOString(),
    updatedBy: actorName,
  };
}

export async function POST(request: Request) {
  const [session, account, config, allOfferings] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readAcademicConfig(),
    readAllClassOfferings(),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageSessionRollover(account)) {
    return NextResponse.json(
      { error: "Only the school admin, principal, or assigned registrar can run session rollover actions." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    actionType?: SessionRolloverActionType;
    sourceClassName?: string;
    note?: string;
  };
  const actionType = body.actionType;
  const sourceClassName = body.sourceClassName?.trim() ?? "";
  const sourceOffering = allOfferings.find(
    (offering) => offering.className === sourceClassName && offering.session === config.session,
  );

  if (!actionType || !sourceClassName || !sourceOffering) {
    return NextResponse.json({ error: "Choose a valid class arm for rollover." }, { status: 400 });
  }

  const nextSession = nextSessionLabel(config.session);
  const timestamp = new Date().toISOString();
  let nextOffering: ClassOffering | null = null;

  if (actionType === "duplicate_structure") {
    nextOffering = cloneOfferingForNextSession(sourceOffering, nextSession, account.fullName);
    const exists = allOfferings.some(
      (offering) => offering.className === nextOffering?.className && offering.session === nextSession,
    );

    if (exists) {
      return NextResponse.json(
        { error: `A ${nextOffering.className} arm already exists in ${nextSession}.` },
        { status: 400 },
      );
    }

    await saveClassOffering(nextOffering);
  }

  if (actionType === "archive_arm") {
    const assignments = await readSubjectTeacherAssignments();
    const nextAssignments = assignments.map((assignment) =>
      assignment.className === sourceOffering.className
        ? { ...assignment, active: false, updatedAt: timestamp }
        : assignment,
    );

    await writeSubjectTeacherAssignments(nextAssignments);
    nextOffering = {
      ...sourceOffering,
      status: "retired",
      updatedAt: timestamp,
      updatedBy: account.fullName,
    };
    await saveClassOffering(nextOffering, sourceOffering.className, sourceOffering.session);
  }

  const record: SessionRolloverRecord = {
    id: `${actionType}-${sourceOffering.className}-${timestamp}`.replace(/[^a-z0-9]+/gi, "_").toLowerCase(),
    schoolCode: sourceOffering.schoolCode || account.schoolCode,
    currentSession: config.session,
    nextSession,
    sourceClassName: sourceOffering.className,
    sourceArm: sourceOffering.arm,
    targetClassName: actionType === "duplicate_structure" ? nextOffering?.className : undefined,
    targetArm: actionType === "duplicate_structure" ? nextOffering?.arm : undefined,
    actionType,
    status: "completed",
    note:
      body.note?.trim() ||
      (actionType === "duplicate_structure"
        ? `Prepared ${nextOffering?.className} for ${nextSession}.`
        : actionType === "archive_arm"
          ? `Archived ${sourceOffering.className} from the live session.`
          : `Promotion queue reviewed for ${sourceOffering.className}.`),
    actedBy: account.fullName,
    actedAt: timestamp,
  };

  await saveSessionRolloverRecord(record);
  return NextResponse.json({ record, offering: nextOffering });
}
