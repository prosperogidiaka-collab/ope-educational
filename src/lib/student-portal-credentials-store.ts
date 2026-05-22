import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { canAccessSchool } from "@/lib/auth";
import { school, studentPortalCredentials } from "@/lib/demo-data";
import type { StaffAccount, StudentPortalCredential } from "@/lib/types";

const STUDENT_PORTAL_CREDENTIALS_STORE_PATH = path.join(
  process.cwd(),
  "data",
  "student-portal-credentials.json",
);

type StudentCredentialScopeViewer = Pick<StaffAccount, "role" | "schoolCode" | "grantedSchoolCodes">;

function normalizeCredential(credential: StudentPortalCredential): StudentPortalCredential {
  return {
    ...credential,
    schoolCode: credential.schoolCode || school.schoolCode,
    accountState: credential.accountState ?? "active",
    couponCode: credential.couponCode ?? "",
  };
}

function buildSeedStore() {
  return studentPortalCredentials.map(normalizeCredential);
}

async function ensureStudentPortalCredentialsStoreFile() {
  await mkdir(path.dirname(STUDENT_PORTAL_CREDENTIALS_STORE_PATH), { recursive: true });

  try {
    await readFile(STUDENT_PORTAL_CREDENTIALS_STORE_PATH, "utf8");
  } catch {
    await writeFile(
      STUDENT_PORTAL_CREDENTIALS_STORE_PATH,
      JSON.stringify(buildSeedStore(), null, 2),
      "utf8",
    );
  }
}

export async function readStudentPortalCredentials(): Promise<StudentPortalCredential[]> {
  await ensureStudentPortalCredentialsStoreFile();

  try {
    const fileContents = await readFile(STUDENT_PORTAL_CREDENTIALS_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as StudentPortalCredential[];
    const normalized = parsed.map(normalizeCredential);

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeStudentPortalCredentials(normalized);
    }

    return normalized;
  } catch {
    return buildSeedStore();
  }
}

export async function writeStudentPortalCredentials(credentials: StudentPortalCredential[]) {
  await ensureStudentPortalCredentialsStoreFile();
  await writeFile(
    STUDENT_PORTAL_CREDENTIALS_STORE_PATH,
    JSON.stringify(credentials.map(normalizeCredential), null, 2),
    "utf8",
  );
}

export async function readVisibleStudentPortalCredentials(viewer?: StudentCredentialScopeViewer | null) {
  const credentials = await readStudentPortalCredentials();

  if (!viewer) {
    return credentials;
  }

  return credentials.filter((credential) => canAccessSchool(viewer, credential.schoolCode));
}

export async function getStudentPortalCredentialByUsername(username: string) {
  const credentials = await readStudentPortalCredentials();
  return (
    credentials.find((credential) => credential.username.toLowerCase() === username.trim().toLowerCase()) ?? null
  );
}

export async function getStudentPortalCredentialByRegNumber(regNumber: string) {
  const credentials = await readStudentPortalCredentials();
  return credentials.find((credential) => credential.regNumber === regNumber) ?? null;
}

export async function saveStudentPortalCredential(nextCredential: StudentPortalCredential) {
  const credentials = await readStudentPortalCredentials();
  const nextCredentials = credentials.map((credential) =>
    credential.id === nextCredential.id ? normalizeCredential(nextCredential) : credential,
  );

  await writeStudentPortalCredentials(nextCredentials);
  return normalizeCredential(nextCredential);
}
