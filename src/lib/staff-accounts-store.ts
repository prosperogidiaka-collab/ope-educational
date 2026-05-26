import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { canAccessSchool, PLATFORM_SCHOOL_CODE } from "@/lib/auth";
import { portfolioSchoolAdminSeeds, school, staffAccounts } from "@/lib/demo-data";
import { generateTemporaryPassword } from "@/lib/secret-utils";
import type { StaffAccount } from "@/lib/types";

const STAFF_ACCOUNTS_STORE_PATH = path.join(process.cwd(), "data", "staff-accounts.json");
const STAFF_ACCOUNT_PASSWORD_STORE_PATH = path.join(
  process.cwd(),
  "data",
  "private",
  "staff-account-passwords.json",
);
const PLATFORM_ADMIN_ACCOUNT_ID = "acct_super_admin_001";
const PLATFORM_ADMIN_NAME = "Platform Super Admin";
const PLATFORM_ADMIN_EMAIL = "owner@ope.local";

export interface StoredStaffAccount extends StaffAccount {
  password: string;
}

type PublicStoredStaffAccount = Omit<StoredStaffAccount, "password"> & {
  password?: string;
};

type StoredStaffPasswordMap = Record<string, string>;
type StaffAccountScopeViewer = Pick<StaffAccount, "role" | "schoolCode" | "grantedSchoolCodes">;

function buildPlatformAdminAccount(): PublicStoredStaffAccount {
  return {
    id: PLATFORM_ADMIN_ACCOUNT_ID,
    schoolCode: schoolCodeForAdmin(),
    fullName: PLATFORM_ADMIN_NAME,
    email: PLATFORM_ADMIN_EMAIL,
    role: "super_admin",
    status: "active",
    mustChangePassword: false,
    registeredBy: "System",
    canRegisterTeachers: true,
    canDisableTeachers: true,
    canRegisterStudents: true,
    grantedSchoolCodes: [],
    assignedArms: [],
    assignedSubjects: [],
    classTeacherArms: [],
    lastAction: "Platform-wide account governance enabled.",
  };
}

function normalizePublicStoredStaffAccount(account: PublicStoredStaffAccount): PublicStoredStaffAccount {
  const normalizedRole =
    account.role === "principal" && account.schoolCode !== PLATFORM_SCHOOL_CODE
      ? "school_admin"
      : account.role === "class_teacher"
        ? "teacher"
        : account.role;
  const matchingSchoolAdminSeed = portfolioSchoolAdminSeeds.find(
    (seed) => seed.schoolCode.toUpperCase() === account.schoolCode.toUpperCase(),
  );
  const shouldRefreshLegacySchoolAdminIdentity =
    normalizedRole === "school_admin" &&
    matchingSchoolAdminSeed &&
    (account.id === "acct_principal_001" || account.email.toLowerCase() === "principal@ope.edu.ng");
  const normalizedRegisteredBy =
    account.schoolCode === school.schoolCode && account.registeredBy === school.principalName
      ? school.schoolAdminName ?? "School Admin"
      : account.registeredBy;
  const normalizedLastAction = account.lastAction.includes("pending reassignment by principal")
    ? account.lastAction.replace("pending reassignment by principal", "pending reassignment by the school admin")
    : account.lastAction;

  return {
    ...account,
    role: normalizedRole,
    fullName: shouldRefreshLegacySchoolAdminIdentity ? matchingSchoolAdminSeed.fullName : account.fullName,
    email: shouldRefreshLegacySchoolAdminIdentity ? matchingSchoolAdminSeed.email : account.email,
    mustChangePassword: Boolean(account.mustChangePassword),
    registeredBy: shouldRefreshLegacySchoolAdminIdentity ? "Super Admin" : normalizedRegisteredBy,
    lastAction: shouldRefreshLegacySchoolAdminIdentity
      ? "Updated staff permissions and publication controls for SS2 Gold."
      : normalizedLastAction,
    grantedSchoolCodes: account.grantedSchoolCodes ?? [],
  };
}

function normalizePublicStoredStaffAccounts(accounts: PublicStoredStaffAccount[]) {
  const normalizedAccounts = accounts.map(normalizePublicStoredStaffAccount);
  const platformAdminAccount = buildPlatformAdminAccount();
  const platformAdminIndex = normalizedAccounts.findIndex((account) => account.role === "super_admin");

  if (platformAdminIndex >= 0) {
    normalizedAccounts[platformAdminIndex] = {
      ...normalizedAccounts[platformAdminIndex],
      ...platformAdminAccount,
    };
  } else {
    normalizedAccounts.unshift(platformAdminAccount);
  }

  return normalizedAccounts;
}

function buildPublicSeedStore(): PublicStoredStaffAccount[] {
  const baseAccounts: PublicStoredStaffAccount[] = staffAccounts.map((account) =>
    normalizePublicStoredStaffAccount(account),
  );

  const seededSchoolCodes = new Set(baseAccounts.map((account) => account.schoolCode.toUpperCase()));
  const schoolAdminAccounts: PublicStoredStaffAccount[] = portfolioSchoolAdminSeeds
    .filter((seed) => !seededSchoolCodes.has(seed.schoolCode.toUpperCase()))
    .map((seed, index) =>
      normalizePublicStoredStaffAccount({
        id: `acct_school_admin_seed_${(index + 1).toString().padStart(3, "0")}`,
        schoolCode: seed.schoolCode,
        fullName: seed.fullName,
        email: seed.email,
        role: "school_admin",
        status: "active",
        mustChangePassword: false,
        registeredBy: "Super Admin",
        canRegisterTeachers: true,
        canDisableTeachers: true,
        canRegisterStudents: true,
        grantedSchoolCodes: [],
        assignedArms: [],
        assignedSubjects: [],
        classTeacherArms: [],
        lastAction: `Provisioned as school admin for ${seed.schoolName}.`,
      }),
    );

  return normalizePublicStoredStaffAccounts([...baseAccounts, ...schoolAdminAccounts]);
}

function schoolCodeForAdmin() {
  return PLATFORM_SCHOOL_CODE;
}

function stripStoredStaffAccountSecrets(account: PublicStoredStaffAccount | StoredStaffAccount) {
  const { password: _password, ...publicAccount } = account;
  return publicAccount;
}

function defaultPasswordForAccount() {
  return generateTemporaryPassword("Staff");
}

function mergeStoredStaffAccounts(
  publicAccounts: PublicStoredStaffAccount[],
  passwordMap: StoredStaffPasswordMap,
) {
  const nextPasswordMap = { ...passwordMap };
  const mergedAccounts = publicAccounts.map((account) => {
    const existingPassword =
      (typeof account.password === "string" && account.password.trim()) || nextPasswordMap[account.id];
    const password = existingPassword?.trim() || defaultPasswordForAccount();
    nextPasswordMap[account.id] = password;

    return {
      ...stripStoredStaffAccountSecrets(account),
      password,
    };
  });

  return { mergedAccounts, nextPasswordMap };
}

async function readStoredStaffPasswordMap(): Promise<StoredStaffPasswordMap> {
  try {
    const fileContents = await readFile(STAFF_ACCOUNT_PASSWORD_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as StoredStaffPasswordMap;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1].trim())),
    );
  } catch {
    return {};
  }
}

async function writeStoredStaffPasswordMap(passwordMap: StoredStaffPasswordMap) {
  await mkdir(path.dirname(STAFF_ACCOUNT_PASSWORD_STORE_PATH), { recursive: true });
  await writeFile(STAFF_ACCOUNT_PASSWORD_STORE_PATH, JSON.stringify(passwordMap, null, 2), "utf8");
}

async function ensureStaffAccountsStoreFile() {
  await mkdir(path.dirname(STAFF_ACCOUNTS_STORE_PATH), { recursive: true });
  await mkdir(path.dirname(STAFF_ACCOUNT_PASSWORD_STORE_PATH), { recursive: true });

  let publicAccounts: PublicStoredStaffAccount[];
  let hasExistingPublicFile = true;

  try {
    const fileContents = await readFile(STAFF_ACCOUNTS_STORE_PATH, "utf8");
    publicAccounts = normalizePublicStoredStaffAccounts(JSON.parse(fileContents) as PublicStoredStaffAccount[]);
  } catch {
    hasExistingPublicFile = false;
    publicAccounts = buildPublicSeedStore();
  }

  const passwordMap = await readStoredStaffPasswordMap();
  const { mergedAccounts, nextPasswordMap } = mergeStoredStaffAccounts(publicAccounts, passwordMap);
  const sanitizedPublicAccounts = mergedAccounts.map(stripStoredStaffAccountSecrets);

  if (
    !hasExistingPublicFile ||
    JSON.stringify(publicAccounts) !== JSON.stringify(sanitizedPublicAccounts)
  ) {
    await writeFile(STAFF_ACCOUNTS_STORE_PATH, JSON.stringify(sanitizedPublicAccounts, null, 2), "utf8");
  }

  if (JSON.stringify(passwordMap) !== JSON.stringify(nextPasswordMap)) {
    await writeStoredStaffPasswordMap(nextPasswordMap);
  }
}

export async function readStoredStaffAccounts(): Promise<StoredStaffAccount[]> {
  await ensureStaffAccountsStoreFile();

  try {
    const [fileContents, passwordMap] = await Promise.all([
      readFile(STAFF_ACCOUNTS_STORE_PATH, "utf8"),
      readStoredStaffPasswordMap(),
    ]);
    const parsed = JSON.parse(fileContents) as PublicStoredStaffAccount[];
    const normalizedPublicAccounts = normalizePublicStoredStaffAccounts(parsed);
    const { mergedAccounts, nextPasswordMap } = mergeStoredStaffAccounts(normalizedPublicAccounts, passwordMap);
    const normalizedPublicSnapshot = mergedAccounts.map(stripStoredStaffAccountSecrets);

    if (JSON.stringify(parsed) !== JSON.stringify(normalizedPublicSnapshot)) {
      await writeFile(
        STAFF_ACCOUNTS_STORE_PATH,
        JSON.stringify(normalizedPublicSnapshot, null, 2),
        "utf8",
      );
    }

    if (JSON.stringify(passwordMap) !== JSON.stringify(nextPasswordMap)) {
      await writeStoredStaffPasswordMap(nextPasswordMap);
    }

    return mergedAccounts;
  } catch {
    return mergeStoredStaffAccounts(buildPublicSeedStore(), {}).mergedAccounts;
  }
}

export async function writeStoredStaffAccounts(accounts: StoredStaffAccount[]) {
  await ensureStaffAccountsStoreFile();
  const publicAccounts = normalizePublicStoredStaffAccounts(accounts.map(stripStoredStaffAccountSecrets));
  const passwordMap = Object.fromEntries(
    accounts.map((account) => [account.id, account.password.trim() || defaultPasswordForAccount()]),
  );

  await Promise.all([
    writeFile(STAFF_ACCOUNTS_STORE_PATH, JSON.stringify(publicAccounts, null, 2), "utf8"),
    writeStoredStaffPasswordMap(passwordMap),
  ]);
}

export async function readStaffAccounts() {
  const accounts = await readStoredStaffAccounts();
  return accounts.map(({ password: _password, ...account }) => account);
}

export async function readSchoolStaffAccounts() {
  const accounts = await readStaffAccounts();
  return accounts.filter((account) => account.role !== "super_admin");
}

export async function readVisibleStaffAccounts(viewer?: StaffAccountScopeViewer | null) {
  const accounts = await readStaffAccounts();
  const schoolAccounts = accounts.filter((account) => account.role !== "super_admin");

  if (!viewer) {
    return schoolAccounts;
  }

  return schoolAccounts.filter((account) => canAccessSchool(viewer, account.schoolCode));
}

export async function getStoredStaffAccountByEmail(email: string) {
  const accounts = await readStoredStaffAccounts();
  return accounts.find((account) => account.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function getStoredStaffAccountById(accountId: string) {
  const accounts = await readStoredStaffAccounts();
  return accounts.find((account) => account.id === accountId) ?? null;
}

export async function saveStoredStaffAccount(nextAccount: StoredStaffAccount) {
  const accounts = await readStoredStaffAccounts();
  const nextAccounts = accounts.map((account) =>
    account.id === nextAccount.id ? nextAccount : account,
  );

  await writeStoredStaffAccounts(nextAccounts);
  return nextAccount;
}
