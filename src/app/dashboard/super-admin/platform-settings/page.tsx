import { SuperAdminPage } from "@/components/super-admin-page";

export const dynamic = "force-dynamic";

export default async function SuperAdminPlatformSettingsPage() {
  return (
    <SuperAdminPage
      activeHref="/dashboard/super-admin/platform-settings"
      eyebrow="Platform Settings"
      title="App-wide switches and broadcast"
      description="Control maintenance mode, onboarding, student access, and owner broadcast from a dedicated settings page."
      view="platformSettings"
    />
  );
}
