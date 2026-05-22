import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function StudentAffairsPage() {
  redirect("/dashboard/student-affairs/student-info");
}
