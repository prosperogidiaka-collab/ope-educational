import { redirect } from "next/navigation";

interface ShortVerificationPageProps {
  params: Promise<{
    token: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function ShortVerificationPage({ params }: ShortVerificationPageProps) {
  const resolvedParams = await params;
  redirect(`/verification/${encodeURIComponent(decodeURIComponent(resolvedParams.token))}`);
}
