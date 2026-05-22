import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import type { PlatformSettings } from "@/lib/types";

const PLATFORM_SETTINGS_STORE_PATH = path.join(process.cwd(), "data", "platform-settings.json");

const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  maintenanceMode: false,
  allowSchoolOnboarding: true,
  allowPortalAccess: true,
  supportEmail: "support@opeeducational.com",
  ownerBroadcast: "Platform normal. Follow up trial renewals and suspended schools from the super-admin board.",
  updatedAt: "2026-05-14T00:00:00.000Z",
};

function normalizePlatformSettings(settings: PlatformSettings): PlatformSettings {
  return {
    maintenanceMode: Boolean(settings.maintenanceMode),
    allowSchoolOnboarding: Boolean(settings.allowSchoolOnboarding),
    allowPortalAccess: Boolean(settings.allowPortalAccess),
    supportEmail: settings.supportEmail?.trim() || DEFAULT_PLATFORM_SETTINGS.supportEmail,
    ownerBroadcast: settings.ownerBroadcast?.trim() || DEFAULT_PLATFORM_SETTINGS.ownerBroadcast,
    updatedAt: settings.updatedAt || new Date().toISOString(),
  };
}

async function ensurePlatformSettingsStoreFile() {
  await mkdir(path.dirname(PLATFORM_SETTINGS_STORE_PATH), { recursive: true });

  try {
    await readFile(PLATFORM_SETTINGS_STORE_PATH, "utf8");
  } catch {
    await writeFile(PLATFORM_SETTINGS_STORE_PATH, JSON.stringify(DEFAULT_PLATFORM_SETTINGS, null, 2), "utf8");
  }
}

export async function readPlatformSettings(): Promise<PlatformSettings> {
  await ensurePlatformSettingsStoreFile();

  try {
    const fileContents = await readFile(PLATFORM_SETTINGS_STORE_PATH, "utf8");
    return normalizePlatformSettings(JSON.parse(fileContents) as PlatformSettings);
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

export async function writePlatformSettings(settings: PlatformSettings) {
  await ensurePlatformSettingsStoreFile();
  const normalized = normalizePlatformSettings(settings);
  await writeFile(PLATFORM_SETTINGS_STORE_PATH, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}
