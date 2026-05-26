import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { canAccessSchool } from "@/lib/auth";
import { school, studentPortalCredentials } from "@/lib/demo-data";
import { generateCouponCode, generateTemporaryPassword } from "@/lib/secret-utils";
import type { StaffAccount, StudentPortalCredential } from "@/lib/types";

const STUDENT_PORTAL_CREDENTIALS_STORE_PATH = path.join(
  process.cwd(),
  "data",
  "student-portal-credentials.json",
);
const STUDENT_PORTAL_SECRET_STORE_PATH = path.join(
  process.cwd(),
  "data",
  "private",
  "student-portal-secrets.json",
);

type StudentCredentialScopeViewer = Pick<StaffAccount, "role" | "schoolCode" | "grantedSchoolCodes">;
type PublicStudentPortalCredential = Omit<StudentPortalCredential, "temporaryPassword" | "couponCode"> &
  Partial<Pick<StudentPortalCredential, "temporaryPassword" | "couponCode">>;
type StudentPortalSecretStore = Record<
  string,
  Pick<StudentPortalCredential, "temporaryPassword" | "couponCode">
>;

function normalizePublicCredential(
  credential: PublicStudentPortalCredential,
): PublicStudentPortalCredential {
  return {
    ...credential,
    schoolCode: credential.schoolCode || school.schoolCode,
    accountState: credential.accountState ?? "active",
  };
}

function buildPublicSeedStore() {
  return studentPortalCredentials.map(normalizePublicCredential);
}

function stripStudentCredentialSecrets(
  credential: PublicStudentPortalCredential | StudentPortalCredential,
) {
  const { temporaryPassword: _temporaryPassword, couponCode: _couponCode, ...publicCredential } = credential;
  return publicCredential;
}

function defaultStudentSecret() {
  return {
    temporaryPassword: generateTemporaryPassword("Portal"),
    couponCode: generateCouponCode(),
  };
}

function mergeStudentPortalCredentials(
  publicCredentials: PublicStudentPortalCredential[],
  secretStore: StudentPortalSecretStore,
) {
  const nextSecretStore = { ...secretStore };
  const mergedCredentials = publicCredentials.map((credential) => {
    const existingSecret = nextSecretStore[credential.id];
    const secret = {
      temporaryPassword:
        (typeof credential.temporaryPassword === "string" && credential.temporaryPassword.trim()) ||
        existingSecret?.temporaryPassword ||
        defaultStudentSecret().temporaryPassword,
      couponCode:
        (typeof credential.couponCode === "string" && credential.couponCode.trim().toUpperCase()) ||
        existingSecret?.couponCode ||
        defaultStudentSecret().couponCode,
    };
    nextSecretStore[credential.id] = secret;

    return {
      ...stripStudentCredentialSecrets(credential),
      temporaryPassword: secret.temporaryPassword,
      couponCode: secret.couponCode,
    };
  });

  return { mergedCredentials, nextSecretStore };
}

async function readStudentPortalSecretStore(): Promise<StudentPortalSecretStore> {
  try {
    const fileContents = await readFile(STUDENT_PORTAL_SECRET_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as StudentPortalSecretStore;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, Pick<StudentPortalCredential, "temporaryPassword" | "couponCode">] =>
          Boolean(entry[1]?.temporaryPassword?.trim()) && Boolean(entry[1]?.couponCode?.trim()),
      ),
    );
  } catch {
    return {};
  }
}

async function writeStudentPortalSecretStore(secretStore: StudentPortalSecretStore) {
  await mkdir(path.dirname(STUDENT_PORTAL_SECRET_STORE_PATH), { recursive: true });
  await writeFile(STUDENT_PORTAL_SECRET_STORE_PATH, JSON.stringify(secretStore, null, 2), "utf8");
}

async function ensureStudentPortalCredentialsStoreFile() {
  await mkdir(path.dirname(STUDENT_PORTAL_CREDENTIALS_STORE_PATH), { recursive: true });
  await mkdir(path.dirname(STUDENT_PORTAL_SECRET_STORE_PATH), { recursive: true });

  let publicCredentials: PublicStudentPortalCredential[];
  let hasExistingPublicFile = true;

  try {
    const fileContents = await readFile(STUDENT_PORTAL_CREDENTIALS_STORE_PATH, "utf8");
    publicCredentials = (JSON.parse(fileContents) as PublicStudentPortalCredential[]).map(normalizePublicCredential);
  } catch {
    hasExistingPublicFile = false;
    publicCredentials = buildPublicSeedStore();
  }

  const secretStore = await readStudentPortalSecretStore();
  const { mergedCredentials, nextSecretStore } = mergeStudentPortalCredentials(publicCredentials, secretStore);
  const sanitizedPublicCredentials = mergedCredentials.map(stripStudentCredentialSecrets);

  if (
    !hasExistingPublicFile ||
    JSON.stringify(publicCredentials) !== JSON.stringify(sanitizedPublicCredentials)
  ) {
    await writeFile(
      STUDENT_PORTAL_CREDENTIALS_STORE_PATH,
      JSON.stringify(sanitizedPublicCredentials, null, 2),
      "utf8",
    );
  }

  if (JSON.stringify(secretStore) !== JSON.stringify(nextSecretStore)) {
    await writeStudentPortalSecretStore(nextSecretStore);
  }
}

export async function readStudentPortalCredentials(): Promise<StudentPortalCredential[]> {
  await ensureStudentPortalCredentialsStoreFile();

  try {
    const [fileContents, secretStore] = await Promise.all([
      readFile(STUDENT_PORTAL_CREDENTIALS_STORE_PATH, "utf8"),
      readStudentPortalSecretStore(),
    ]);
    const parsed = JSON.parse(fileContents) as PublicStudentPortalCredential[];
    const normalizedPublicCredentials = parsed.map(normalizePublicCredential);
    const { mergedCredentials, nextSecretStore } = mergeStudentPortalCredentials(
      normalizedPublicCredentials,
      secretStore,
    );
    const normalizedPublicSnapshot = mergedCredentials.map(stripStudentCredentialSecrets);

    if (JSON.stringify(parsed) !== JSON.stringify(normalizedPublicSnapshot)) {
      await writeFile(
        STUDENT_PORTAL_CREDENTIALS_STORE_PATH,
        JSON.stringify(normalizedPublicSnapshot, null, 2),
        "utf8",
      );
    }

    if (JSON.stringify(secretStore) !== JSON.stringify(nextSecretStore)) {
      await writeStudentPortalSecretStore(nextSecretStore);
    }

    return mergedCredentials;
  } catch {
    return mergeStudentPortalCredentials(buildPublicSeedStore(), {}).mergedCredentials;
  }
}

export async function writeStudentPortalCredentials(credentials: StudentPortalCredential[]) {
  await ensureStudentPortalCredentialsStoreFile();
  const publicCredentials = credentials.map((credential) =>
    normalizePublicCredential(stripStudentCredentialSecrets(credential)),
  );
  const secretStore = Object.fromEntries(
    credentials.map((credential) => [
      credential.id,
      {
        temporaryPassword: credential.temporaryPassword.trim() || defaultStudentSecret().temporaryPassword,
        couponCode: credential.couponCode.trim().toUpperCase() || defaultStudentSecret().couponCode,
      },
    ]),
  );

  await writeFile(
    STUDENT_PORTAL_CREDENTIALS_STORE_PATH,
    JSON.stringify(publicCredentials, null, 2),
    "utf8",
  );
  await writeStudentPortalSecretStore(secretStore);
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
    credential.id === nextCredential.id
      ? {
          ...nextCredential,
          schoolCode: nextCredential.schoolCode || school.schoolCode,
          accountState: nextCredential.accountState ?? "active",
          couponCode: nextCredential.couponCode?.trim().toUpperCase() ?? "",
        }
      : credential,
  );

  await writeStudentPortalCredentials(nextCredentials);
  return nextCredentials.find((credential) => credential.id === nextCredential.id) ?? nextCredential;
}
