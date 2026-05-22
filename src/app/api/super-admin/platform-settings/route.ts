import { NextResponse } from "next/server";

import { readPlatformSettings, writePlatformSettings } from "@/lib/platform-settings-store";
import { requirePlatformSuperAdmin } from "@/lib/super-admin-access";
import type { PlatformSettings } from "@/lib/types";

export async function GET() {
  const access = await requirePlatformSuperAdmin();

  if ("error" in access) {
    return access.error;
  }

  const settings = await readPlatformSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const access = await requirePlatformSuperAdmin();

  if ("error" in access) {
    return access.error;
  }

  const incoming = (await request.json()) as Partial<PlatformSettings>;
  const current = await readPlatformSettings();
  const settings = await writePlatformSettings({
    ...current,
    ...incoming,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ settings });
}
