import { SuperAdminPage } from "@/components/super-admin-page";

export const dynamic = "force-dynamic";

export default async function SuperAdminOnboardingPage() {
  return (
    <SuperAdminPage
      activeHref="/dashboard/super-admin/onboarding"
      eyebrow="Create School"
      title="Provision a new school"
      description="Create a new tenant school and its school-admin login without mixing the form into other platform controls."
      view="onboarding"
    />
  );
}
