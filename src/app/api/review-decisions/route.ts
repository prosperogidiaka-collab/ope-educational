import { NextResponse } from "next/server";

import { canAccess, canAccessSchool } from "@/lib/auth";
import { readRuntimeSchoolProfile } from "@/lib/academic-config-store";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import {
  deleteReviewDecision,
  readReviewDecisionStore,
  saveReviewDecision,
} from "@/lib/review-decisions-store";
import type { ReviewDecision } from "@/lib/review-decisions";

async function ensureScoreReviewAccess() {
  const [session, account, school] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readRuntimeSchoolProfile(),
  ]);

  if (!session || !account || account.status !== "active") {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }

  if (!canAccess(session.role, "/dashboard/score-review")) {
    return { error: NextResponse.json({ error: "Only assigned reviewers can manage release decisions." }, { status: 403 }) };
  }

  if (!canAccessSchool(account, school.schoolCode)) {
    return { error: NextResponse.json({ error: "This review desk does not belong to your account scope." }, { status: 403 }) };
  }

  return { session, account, school };
}

export async function GET() {
  const access = await ensureScoreReviewAccess();

  if ("error" in access) {
    return access.error;
  }

  const decisions = await readReviewDecisionStore();
  return NextResponse.json({ decisions });
}

export async function PUT(request: Request) {
  const access = await ensureScoreReviewAccess();

  if ("error" in access) {
    return access.error;
  }

  const incoming = (await request.json()) as ReviewDecision;

  if (!incoming?.regNumber) {
    return NextResponse.json({ error: "regNumber is required" }, { status: 400 });
  }

  const decision: ReviewDecision = {
    ...incoming,
    decidedAt: new Date().toISOString(),
  };
  const saved = await saveReviewDecision(incoming.regNumber, decision);

  return NextResponse.json({ decision: saved });
}

export async function DELETE(request: Request) {
  const access = await ensureScoreReviewAccess();

  if ("error" in access) {
    return access.error;
  }

  const url = new URL(request.url);
  const regNumber = url.searchParams.get("regNumber");

  if (!regNumber) {
    return NextResponse.json({ error: "regNumber query parameter is required" }, { status: 400 });
  }

  await deleteReviewDecision(decodeURIComponent(regNumber));

  return NextResponse.json({ ok: true });
}
