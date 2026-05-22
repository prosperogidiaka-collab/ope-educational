import { SuperAdminPage } from "@/components/super-admin-page";

export const dynamic = "force-dynamic";

export default async function SuperAdminActivityPage() {
  return (
    <SuperAdminPage
      activeHref="/dashboard/super-admin/activity"
      eyebrow="Owner Activity"
      title="Support, billing, and publication signals"
      description="Review recent platform-level notifications without mixing them into school editing forms."
      view="activity"
    />
  );
}
