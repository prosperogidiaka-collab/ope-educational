import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { promotionQueue } from "@/lib/demo-data";
import type { PromotionCandidate } from "@/lib/types";

const PROMOTION_QUEUE_STORE_PATH = path.join(process.cwd(), "data", "promotion-queue.json");

function buildSeedStore() {
  return promotionQueue;
}

async function ensurePromotionQueueStoreFile() {
  await mkdir(path.dirname(PROMOTION_QUEUE_STORE_PATH), { recursive: true });

  try {
    await readFile(PROMOTION_QUEUE_STORE_PATH, "utf8");
  } catch {
    await writeFile(PROMOTION_QUEUE_STORE_PATH, JSON.stringify(buildSeedStore(), null, 2), "utf8");
  }
}

function normalizeCandidate(candidate: PromotionCandidate): PromotionCandidate {
  return {
    ...candidate,
    reason: candidate.reason.trim(),
  };
}

export async function readPromotionQueue(): Promise<PromotionCandidate[]> {
  await ensurePromotionQueueStoreFile();

  try {
    const fileContents = await readFile(PROMOTION_QUEUE_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as PromotionCandidate[];
    const normalized = parsed.map(normalizeCandidate);

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writePromotionQueue(normalized);
    }

    return normalized;
  } catch {
    return buildSeedStore();
  }
}

export async function writePromotionQueue(queue: PromotionCandidate[]) {
  await ensurePromotionQueueStoreFile();
  await writeFile(
    PROMOTION_QUEUE_STORE_PATH,
    JSON.stringify(queue.map(normalizeCandidate), null, 2),
    "utf8",
  );
}

export async function savePromotionCandidate(nextCandidate: PromotionCandidate) {
  const queue = await readPromotionQueue();
  const existingIndex = queue.findIndex((candidate) => candidate.regNumber === nextCandidate.regNumber);

  if (existingIndex >= 0) {
    queue[existingIndex] = normalizeCandidate(nextCandidate);
  } else {
    queue.push(normalizeCandidate(nextCandidate));
  }

  await writePromotionQueue(queue);
  return normalizeCandidate(nextCandidate);
}
