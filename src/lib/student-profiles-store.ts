import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { canAccessSchool } from "@/lib/auth";
import { classOfferings, resultBundles, school } from "@/lib/demo-data";
import type { StaffAccount, StudentProfileRecord } from "@/lib/types";

const STUDENT_PROFILES_STORE_PATH = path.join(process.cwd(), "data", "student-profiles.json");
const PROFILE_SEED_TIMESTAMP = "2026-05-12T08:00:00.000Z";
const BLOOD_GROUPS = ["O+", "A+", "B+", "AB+", "O-"] as const;
const GENOTYPES = ["AA", "AS", "AA", "AC", "AA"] as const;
const RELIGIONS = ["Christianity", "Islam", "Christianity", "Islam", "Christianity"] as const;
const CLUBS = [
  ["Debate Club", "Jet Club"],
  ["Press Club", "Drama Club"],
  ["Science Club", "Literary Club"],
  ["Music Club", "ICT Club"],
  ["Sports Club", "Young Farmers Club"],
] as const;

type StudentProfileScopeViewer = Pick<StaffAccount, "role" | "schoolCode" | "grantedSchoolCodes">;

function parentTitleToName(guardianName: string, fallbackPrefix: string) {
  const cleanedGuardian = guardianName.replace(/\b(mr|mrs|miss|dr)\b/gi, "").trim();
  return cleanedGuardian ? `${fallbackPrefix} ${cleanedGuardian}` : fallbackPrefix;
}

function buildStudentInitials(fullName: string) {
  return fullName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function normalizeStudentProfile(profile: StudentProfileRecord): StudentProfileRecord {
  return {
    ...profile,
    schoolCode: profile.schoolCode || school.schoolCode,
    fatherName: profile.fatherName || parentTitleToName(profile.guardianName, "Mr."),
    fatherPhone: profile.fatherPhone || profile.guardianPhone,
    motherName: profile.motherName || parentTitleToName(profile.guardianName, "Mrs."),
    motherPhone: profile.motherPhone || profile.guardianPhone,
    photoInitials: buildStudentInitials(profile.fullName),
    studentStatus: profile.studentStatus ?? "active",
  };
}

function slugifyFragment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function buildSeedStore(): StudentProfileRecord[] {
  return resultBundles.map((bundle, index): StudentProfileRecord => {
    const student = bundle.student;
    const offering = classOfferings.find((item) => item.className === student.className);
    const guardianSlug = slugifyFragment(student.guardianName.replace(/\b(mr|mrs|miss|dr)\b/gi, ""));
    const addressNumber = 10 + index * 7;

    return normalizeStudentProfile({
      studentId: student.id,
      regNumber: student.regNumber,
      schoolCode: school.schoolCode,
      fullName: student.fullName,
      className: student.className,
      arm: offering?.arm ?? (student.className.split(" ").slice(1).join(" ") || student.className),
      section: offering?.section,
      track: offering?.track,
      house: student.house,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      age: student.age,
      guardianName: student.guardianName,
      guardianPhone: `080${(index + 3).toString().padStart(2, "0")}45${(index + 17).toString().padStart(4, "0")}`,
      guardianEmail: `${guardianSlug || `guardian${index + 1}`}@mail.com`,
      fatherName: `Mr. ${student.fullName.split(" ")[0] ?? "Parent"}`,
      fatherPhone: `080${(index + 31).toString().padStart(2, "0")}78${(index + 41).toString().padStart(4, "0")}`,
      motherName: `Mrs. ${student.fullName.split(" ").slice(-1)[0] ?? "Parent"}`,
      motherPhone: `080${(index + 51).toString().padStart(2, "0")}63${(index + 29).toString().padStart(4, "0")}`,
      homeAddress: `${addressNumber} Learning Estate, Ikeja, Lagos`,
      admissionDate: `${2023 - Math.min(index, 2)}-09-15`,
      boardingStatus: index % 3 === 0 ? "boarding" : "day",
      bloodGroup: BLOOD_GROUPS[index % BLOOD_GROUPS.length],
      genotype: GENOTYPES[index % GENOTYPES.length],
      religion: RELIGIONS[index % RELIGIONS.length],
      stateOfOrigin: ["Lagos", "Anambra", "Kano", "Imo", "Kogi"][index % 5] ?? "Lagos",
      localGovernment: ["Ikeja", "Njikoka", "Nassarawa", "Owerri West", "Lokoja"][index % 5] ?? "Ikeja",
      medicalNotes: index % 2 === 0 ? "No medical alert on file." : "Keep an eye on seasonal allergy medication.",
      clubs: [...CLUBS[index % CLUBS.length]],
      photoInitials: student.photoInitials,
      passportUrl: student.passportUrl,
      feeStatus: student.feeStatus,
      studentStatus: "active",
      updatedAt: PROFILE_SEED_TIMESTAMP,
    });
  });
}

async function ensureStudentProfilesStoreFile() {
  await mkdir(path.dirname(STUDENT_PROFILES_STORE_PATH), { recursive: true });

  try {
    await readFile(STUDENT_PROFILES_STORE_PATH, "utf8");
  } catch {
    await writeFile(STUDENT_PROFILES_STORE_PATH, JSON.stringify(buildSeedStore(), null, 2), "utf8");
  }
}

export async function readStudentProfiles(): Promise<StudentProfileRecord[]> {
  await ensureStudentProfilesStoreFile();

  try {
    const fileContents = await readFile(STUDENT_PROFILES_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as StudentProfileRecord[];
    const normalized = parsed.map(normalizeStudentProfile);

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeStudentProfiles(normalized);
    }

    return normalized;
  } catch {
    return buildSeedStore();
  }
}

export async function writeStudentProfiles(profiles: StudentProfileRecord[]) {
  await ensureStudentProfilesStoreFile();
  await writeFile(
    STUDENT_PROFILES_STORE_PATH,
    JSON.stringify(profiles.map(normalizeStudentProfile), null, 2),
    "utf8",
  );
}

export async function readVisibleStudentProfiles(viewer?: StudentProfileScopeViewer | null) {
  const profiles = await readStudentProfiles();

  if (!viewer) {
    return profiles;
  }

  return profiles.filter((profile) => canAccessSchool(viewer, profile.schoolCode));
}

export async function getStudentProfile(regNumber: string) {
  const profiles = await readStudentProfiles();
  return profiles.find((profile) => profile.regNumber === regNumber) ?? null;
}

export async function saveStudentProfile(nextProfile: StudentProfileRecord) {
  const profiles = await readStudentProfiles();
  const nextProfiles = profiles.map((profile) =>
    profile.regNumber === nextProfile.regNumber ? normalizeStudentProfile(nextProfile) : profile,
  );

  await writeStudentProfiles(nextProfiles);
  return normalizeStudentProfile(nextProfile);
}
