import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { canAccessSchool, PLATFORM_SCHOOL_CODE } from "@/lib/auth";
import { portfolioSchoolAdminSeeds, school, staffAccounts, staffLoginCredentials } from "@/lib/demo-data";
import type { StaffAccount } from "@/lib/types";

const STAFF_ACCOUNTS_STORE_PATH = path.join(process.cwd(), "data", "staff-accounts.json");
const PLATFORM_ADMIN_ACCOUNT_ID = "acct_super_admin_001";

export interface StoredStaffAccount extends StaffAccount {
  password: string;
}

type StaffAccountScopeViewer = Pick<StaffAccount, "role" | "schoolCode" | "grantedSchoolCodes">;

function normalizeStoredStaffAccount(account: StoredStaffAccount): StoredStaffAccount {
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
  const normalizedPassword =
    account.role === "class_teacher" && account.password === "Classteacher@123"
      ? "Teacher@123"
      : account.password;

  return {
    ...account,
    role: normalizedRole,
    fullName: shouldRefreshLegacySchoolAdminIdentity ? matchingSchoolAdminSeed.fullName : account.fullName,
    email: shouldRefreshLegacySchoolAdminIdentity ? matchingSchoolAdminSeed.email : account.email,
    password: shouldRefreshLegacySchoolAdminIdentity ? matchingSchoolAdminSeed.password : normalizedPassword,
    registeredBy: shouldRefreshLegacySchoolAdminIdentity ? "Super Admin" : normalizedRegisteredBy,
    lastAction: shouldRefreshLegacySchoolAdminIdentity
      ? "Updated staff permissions and publication controls for SS2 Gold."
      : normalizedLastAction,
    grantedSchoolCodes: account.grantedSchoolCodes ?? [],
  };
}

function normalizeStoredStaffAccounts(accounts: StoredStaffAccount[]) {
  const normalizedAccounts = accounts.map(normalizeStoredStaffAccount);
  const adminCredential = staffLoginCredentials.find((credential) => credential.role === "super_admin");

  if (!adminCredential) {
    return normalizedAccounts;
  }

  const platformAdminAccount: StoredStaffAccount = {
    id: PLATFORM_ADMIN_ACCOUNT_ID,
    schoolCode: schoolCodeForAdmin(),
    fullName: adminCredential.name,
    email: adminCredential.email,
    password: adminCredential.password,
    role: "super_admin",
    status: "active",
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

function buildSeedStore(): StoredStaffAccount[] {
  const credentialsByEmail = new Map(
    staffLoginCredentials.map((credential) => [credential.email.toLowerCase(), credential.password]),
  );
  const baseAccounts: StoredStaffAccount[] = staffAccounts.map((account) =>
    normalizeStoredStaffAccount({
      ...account,
      password: credentialsByEmail.get(account.email.toLowerCase()) ?? "Teacher@123",
    }),
  );

  const seededSchoolCodes = new Set(baseAccounts.map((account) => account.schoolCode.toUpperCase()));
  const schoolAdminAccounts: StoredStaffAccount[] = portfolioSchoolAdminSeeds
    .filter((seed) => !seededSchoolCodes.has(seed.schoolCode.toUpperCase()))
    .map((seed, index) =>
      normalizeStoredStaffAccount({
        id: `acct_school_admin_seed_${(index + 1).toString().padStart(3, "0")}`,
        schoolCode: seed.schoolCode,
        fullName: seed.fullName,
        email: seed.email,
        password: seed.password,
        role: "school_admin",
        status: "active",
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

  return normalizeStoredStaffAccounts([...baseAccounts, ...schoolAdminAccounts]);
}

function schoolCodeForAdmin() {
  return PLATFORM_SCHOOL_CODE;
}

async function ensureStaffAccountsStoreFile() {
  await mkdir(path.dirname(STAFF_ACCOUNTS_STORE_PATH), { recursive: true });

  try {
    await readFile(STAFF_ACCOUNTS_STORE_PATH, "utf8");
  } catch {
    await writeFile(STAFF_ACCOUNTS_STORE_PATH, JSON.stringify(buildSeedStore(), null, 2), "utf8");
  }
}

export async function readStoredStaffAccounts(): Promise<StoredStaffAccount[]> {
  await ensureStaffAccountsStoreFile();

  try {
    const fileContents = await readFile(STAFF_ACCOUNTS_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as StoredStaffAccount[];
    const normalized = normalizeStoredStaffAccounts(parsed);

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeStoredStaffAccounts(normalized);
    }

    return normalized;
  } catch {
    return buildSeedStore();
  }
}

export async function writeStoredStaffAccounts(accounts: StoredStaffAccount[]) {
  await ensureStaffAccountsStoreFile();
  await writeFile(STAFF_ACCOUNTS_STORE_PATH, JSON.stringify(accounts, null, 2), "utf8");
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
