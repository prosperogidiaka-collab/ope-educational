import { NextResponse } from "next/server";

import { canAccessSchool } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { canManageStudentRecords } from "@/lib/student-affairs-permissions";
import { getStudentProfile, saveStudentProfile } from "@/lib/student-profiles-store";
import {
  getStudentPortalCredentialByRegNumber,
  saveStudentPortalCredential,
} from "@/lib/student-portal-credentials-store";
import type { StudentPortalCredential, StudentProfileRecord } from "@/lib/types";

interface RouteContext {
  params: Promise<{
    regNumber: string;
  }>;
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" ? value.trim() : fallback;
}

export async function PUT(request: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const regNumber = decodeURIComponent(resolvedParams.regNumber);
  const [session, account, profile] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    getStudentProfile(regNumber),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
  }

  if (!canAccessSchool(account, profile.schoolCode)) {
    return NextResponse.json({ error: "This student profile is outside your school scope." }, { status: 403 });
  }

  if (!canManageStudentRecords(account)) {
    return NextResponse.json(
      { error: "Only the school admin, super admin, or registrar can edit student biodata." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as Partial<StudentProfileRecord>;
  const incomingClubs = (body as { clubs?: unknown }).clubs;
  const nextProfile: StudentProfileRecord = {
    ...profile,
    fullName: readString(body.fullName, profile.fullName),
    className: readString(body.className, profile.className),
    arm: readString(body.arm, profile.arm),
    section: body.section ?? profile.section,
    track: readString(body.track, profile.track ?? ""),
    house: readString(body.house, profile.house),
    gender: readString(body.gender, profile.gender),
    dateOfBirth: readString(body.dateOfBirth, profile.dateOfBirth ?? ""),
    age: typeof body.age === "number" ? body.age : profile.age,
    guardianName: readString(body.guardianName, profile.guardianName),
    guardianPhone: readString(body.guardianPhone, profile.guardianPhone),
    guardianEmail: readString(body.guardianEmail, profile.guardianEmail),
    fatherName: readString(body.fatherName, profile.fatherName),
    fatherPhone: readString(body.fatherPhone, profile.fatherPhone),
    motherName: readString(body.motherName, profile.motherName),
    motherPhone: readString(body.motherPhone, profile.motherPhone),
    homeAddress: readString(body.homeAddress, profile.homeAddress),
    admissionDate: readString(body.admissionDate, profile.admissionDate),
    boardingStatus: body.boardingStatus === "boarding" ? "boarding" : body.boardingStatus === "day" ? "day" : profile.boardingStatus,
    bloodGroup: readString(body.bloodGroup, profile.bloodGroup),
    genotype: readString(body.genotype, profile.genotype),
    religion: readString(body.religion, profile.religion),
    stateOfOrigin: readString(body.stateOfOrigin, profile.stateOfOrigin),
    localGovernment: readString(body.localGovernment, profile.localGovernment),
    medicalNotes: readString(body.medicalNotes, profile.medicalNotes),
    passportUrl:
      typeof body.passportUrl === "string"
        ? body.passportUrl.trim() || undefined
        : profile.passportUrl,
    clubs: Array.isArray(incomingClubs)
      ? incomingClubs
          .map((club) => (typeof club === "string" ? club.trim() : ""))
          .filter(Boolean)
      : typeof incomingClubs === "string"
        ? incomingClubs
            .split(",")
            .map((club: string) => club.trim())
            .filter(Boolean)
        : profile.clubs,
    feeStatus: body.feeStatus === "outstanding" ? "outstanding" : body.feeStatus === "cleared" ? "cleared" : profile.feeStatus,
    studentStatus:
      body.studentStatus === "left" ||
      body.studentStatus === "withdrawn" ||
      body.studentStatus === "graduated" ||
      body.studentStatus === "suspended" ||
      body.studentStatus === "active"
        ? body.studentStatus
        : profile.studentStatus,
    updatedAt: new Date().toISOString(),
  };

  await saveStudentProfile(nextProfile);
  let nextCredential: StudentPortalCredential | null = null;

  if (nextProfile.studentStatus !== "active") {
    const credential = await getStudentPortalCredentialByRegNumber(nextProfile.regNumber);

    if (credential && credential.accountState !== "disabled") {
      nextCredential = await saveStudentPortalCredential({
        ...credential,
        accountState: "disabled",
        disabledReason: `Portal access disabled because the student record is marked as ${nextProfile.studentStatus}.`,
      });
    } else {
      nextCredential = credential;
    }
  }

  return NextResponse.json({ profile: nextProfile, credential: nextCredential });
}
