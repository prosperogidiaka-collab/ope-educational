import { notFound, redirect } from "next/navigation";

import { getLiveResults } from "@/lib/live-results";

interface ShortResultPageProps {
  params: Promise<{
    coupon: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function ShortResultPage({ params }: ShortResultPageProps) {
  const resolvedParams = await params;
  const coupon = decodeURIComponent(resolvedParams.coupon).trim().toUpperCase();
  const { summaries } = await getLiveResults();
  const summary = summaries.find((item) => item.bundle.coupon.code.trim().toUpperCase() === coupon);

  if (!summary) {
    notFound();
  }

  redirect(`/results/${encodeURIComponent(summary.bundle.student.regNumber)}?coupon=${encodeURIComponent(coupon)}`);
}
