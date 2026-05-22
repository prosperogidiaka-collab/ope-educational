import { NextResponse } from "next/server";

import { isSchoolAdminRole } from "@/lib/auth";
import { getCurrentStaffAccount, getCurrentStaffSession } from "@/lib/auth-server";
import { getStudentProfile } from "@/lib/student-profiles-store";
import { readPromotionQueue, savePromotionCandidate } from "@/lib/promotion-queue-store";
import type { PromotionCandidate } from "@/lib/types";

interface RouteContext {
  params: Promise<{
    regNumber: string;
  }>;
}

function canManagePromotionQueue(account: NonNullable<Awaited<ReturnType<typeof getCurrentStaffAccount>>>) {
  return isSchoolAdminRole(account.role) || account.role === "registrar" || Boolean(account.canRegisterStudents);
}

export async function PUT(request: Request, { params }: RouteContext) {
  const resolvedParams = await params;
  const regNumber = decodeURIComponent(resolvedParams.regNumber);
  const [session, account, queue, profile] = await Promise.all([
    getCurrentStaffSession(),
    getCurrentStaffAccount(),
    readPromotionQueue(),
    getStudentProfile(regNumber),
  ]);

  if (!session || !account || account.status !== "active") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManagePromotionQueue(account)) {
    return NextResponse.json(
      { error: "Only the school admin, principal, or assigned registrar can edit the promotion queue." },
      { status: 403 },
    );
  }

  const currentCandidate = queue.find((candidate) => candidate.regNumber === regNumber);
  if (!currentCandidate && !profile) {
    return NextResponse.json({ error: "Student promotion record not found." }, { status: 404 });
  }

  const body = (await request.json()) as Partial<PromotionCandidate>;
  const nextCandidate: PromotionCandidate = {
    regNumber,
    studentName: body.studentName?.trim() || currentCandidate?.studentName || profile?.fullName || regNumber,
    currentClass: body.currentClass?.trim() || currentCandidate?.currentClass || profile?.className || "",
    nextClass: body.nextClass?.trim() || currentCandidate?.nextClass || currentCandidate?.currentClass || profile?.className || "",
    status: body.status === "hold" ? "hold" : "ready",
    reason: body.reason?.trim() || currentCandidate?.reason || "Prepared from session rollover desk.",
  };

  await savePromotionCandidate(nextCandidate);
  return NextResponse.json({ candidate: nextCandidate });
}
