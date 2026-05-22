import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import type { ReviewDecision, ReviewDecisionStore } from "@/lib/review-decisions";

const REVIEW_DECISION_STORE_PATH = path.join(process.cwd(), "data", "review-decisions.json");

async function ensureReviewDecisionStoreFile() {
  await mkdir(path.dirname(REVIEW_DECISION_STORE_PATH), { recursive: true });

  try {
    await readFile(REVIEW_DECISION_STORE_PATH, "utf8");
  } catch {
    await writeFile(REVIEW_DECISION_STORE_PATH, JSON.stringify({}, null, 2), "utf8");
  }
}

export async function readReviewDecisionStore(): Promise<ReviewDecisionStore> {
  await ensureReviewDecisionStoreFile();

  try {
    const fileContents = await readFile(REVIEW_DECISION_STORE_PATH, "utf8");
    return JSON.parse(fileContents) as ReviewDecisionStore;
  } catch {
    return {};
  }
}

export async function writeReviewDecisionStore(store: ReviewDecisionStore) {
  await ensureReviewDecisionStoreFile();
  await writeFile(REVIEW_DECISION_STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function getReviewDecision(regNumber: string) {
  const store = await readReviewDecisionStore();
  return store[regNumber] ?? null;
}

export async function saveReviewDecision(regNumber: string, decision: ReviewDecision) {
  const store = await readReviewDecisionStore();
  store[regNumber] = decision;
  await writeReviewDecisionStore(store);
  return decision;
}

export async function deleteReviewDecision(regNumber: string) {
  const store = await readReviewDecisionStore();
  delete store[regNumber];
  await writeReviewDecisionStore(store);
}
