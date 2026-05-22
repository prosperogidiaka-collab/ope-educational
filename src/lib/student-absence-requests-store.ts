import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { canAccessSchool } from "@/lib/auth";
import { resultBundles, school } from "@/lib/demo-data";
import type { StaffAccount, StudentAbsenceRequest } from "@/lib/types";

const STUDENT_ABSENCE_REQUESTS_STORE_PATH = path.join(
  process.cwd(),
  "data",
  "student-absence-requests.json",
);

type StudentAbsenceRequestScopeViewer = Pick<StaffAccount, "role" | "schoolCode" | "grantedSchoolCodes">;

function normalizeStudentAbsenceRequest(request: StudentAbsenceRequest): StudentAbsenceRequest {
  return {
    ...request,
    schoolCode: request.schoolCode || school.schoolCode,
    reason: request.reason.trim(),
    note: request.note?.trim() || undefined,
    attachmentLabel: request.attachmentLabel?.trim() || undefined,
    attachmentUrl: request.attachmentUrl?.trim() || undefined,
    decisionNote: request.decisionNote?.trim() || undefined,
  };
}

function buildSeedStore(): StudentAbsenceRequest[] {
  return [
    normalizeStudentAbsenceRequest({
      id: "absence_req_001",
      schoolCode: school.schoolCode,
      regNumber: resultBundles[1]?.student.regNumber ?? "OPE/SS2/002",
      studentName: resultBundles[1]?.student.fullName ?? "Okonkwo Daniel",
      className: resultBundles[1]?.student.className ?? "SS2 Gold",
      requestedFrom: "2026-05-19",
      requestedTo: "2026-05-21",
      reason: "Family travel for a medical review appointment outside Lagos.",
      note: "Parent informed the class teacher and requested the missed notes on return.",
      status: "pending",
      requestedAt: "2026-05-14T18:10:00.000Z",
    }),
    normalizeStudentAbsenceRequest({
      id: "absence_req_002",
      schoolCode: school.schoolCode,
      regNumber: resultBundles[0]?.student.regNumber ?? "OPE/SS2/001",
      studentName: resultBundles[0]?.student.fullName ?? "Adewale Maria",
      className: resultBundles[0]?.student.className ?? "SS2 Gold",
      requestedFrom: "2026-05-06",
      requestedTo: "2026-05-06",
      reason: "Representing the school at an inter-school science fair.",
      note: "Approved as an official school outing.",
      status: "approved",
      requestedAt: "2026-05-05T16:00:00.000Z",
      decidedAt: "2026-05-05T19:30:00.000Z",
      decidedBy: school.schoolAdminName ?? "School Admin",
      decisionNote: "Approved and copied to the class teacher for attendance marking.",
    }),
  ];
}

async function ensureStudentAbsenceRequestsStoreFile() {
  await mkdir(path.dirname(STUDENT_ABSENCE_REQUESTS_STORE_PATH), { recursive: true });

  try {
    await readFile(STUDENT_ABSENCE_REQUESTS_STORE_PATH, "utf8");
  } catch {
    await writeFile(
      STUDENT_ABSENCE_REQUESTS_STORE_PATH,
      JSON.stringify(buildSeedStore(), null, 2),
      "utf8",
    );
  }
}

export async function readStudentAbsenceRequests(): Promise<StudentAbsenceRequest[]> {
  await ensureStudentAbsenceRequestsStoreFile();

  try {
    const fileContents = await readFile(STUDENT_ABSENCE_REQUESTS_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as StudentAbsenceRequest[];
    const normalized = parsed.map(normalizeStudentAbsenceRequest);

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeStudentAbsenceRequests(normalized);
    }

    return normalized;
  } catch {
    return buildSeedStore();
  }
}

export async function writeStudentAbsenceRequests(requests: StudentAbsenceRequest[]) {
  await ensureStudentAbsenceRequestsStoreFile();
  await writeFile(
    STUDENT_ABSENCE_REQUESTS_STORE_PATH,
    JSON.stringify(requests.map(normalizeStudentAbsenceRequest), null, 2),
    "utf8",
  );
}

export async function readVisibleStudentAbsenceRequests(viewer?: StudentAbsenceRequestScopeViewer | null) {
  const requests = await readStudentAbsenceRequests();

  if (!viewer) {
    return requests;
  }

  return requests.filter((request) => canAccessSchool(viewer, request.schoolCode));
}

export async function listStudentAbsenceRequestsForRegNumber(
  regNumber: string,
  viewer?: StudentAbsenceRequestScopeViewer | null,
) {
  const requests = await readVisibleStudentAbsenceRequests(viewer);
  return requests.filter((request) => request.regNumber === regNumber);
}

export async function getStudentAbsenceRequestById(requestId: string) {
  const requests = await readStudentAbsenceRequests();
  return requests.find((request) => request.id === requestId) ?? null;
}

export async function saveStudentAbsenceRequest(nextRequest: StudentAbsenceRequest) {
  const requests = await readStudentAbsenceRequests();
  const existingIndex = requests.findIndex((request) => request.id === nextRequest.id);
  const normalized = normalizeStudentAbsenceRequest(nextRequest);

  if (existingIndex >= 0) {
    requests[existingIndex] = normalized;
  } else {
    requests.unshift(normalized);
  }

  await writeStudentAbsenceRequests(requests);
  return normalized;
}
