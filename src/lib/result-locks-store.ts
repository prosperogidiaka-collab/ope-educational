import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { seedResultLocks } from "@/lib/demo-data";
import type { ResultLockRecord } from "@/lib/types";

const RESULT_LOCKS_STORE_PATH = path.join(process.cwd(), "data", "result-locks.json");

function buildSeedStore() {
  return seedResultLocks;
}

async function ensureResultLocksStoreFile() {
  await mkdir(path.dirname(RESULT_LOCKS_STORE_PATH), { recursive: true });

  try {
    await readFile(RESULT_LOCKS_STORE_PATH, "utf8");
  } catch {
    await writeFile(RESULT_LOCKS_STORE_PATH, JSON.stringify(buildSeedStore(), null, 2), "utf8");
  }
}

export async function readResultLocks(): Promise<ResultLockRecord[]> {
  await ensureResultLocksStoreFile();

  try {
    const fileContents = await readFile(RESULT_LOCKS_STORE_PATH, "utf8");
    return JSON.parse(fileContents) as ResultLockRecord[];
  } catch {
    return buildSeedStore();
  }
}

export async function writeResultLocks(locks: ResultLockRecord[]) {
  await ensureResultLocksStoreFile();
  await writeFile(RESULT_LOCKS_STORE_PATH, JSON.stringify(locks, null, 2), "utf8");
}

export async function getResultLockForClass(className: string) {
  const locks = await readResultLocks();
  return locks.find((lock) => lock.className === className) ?? null;
}

export async function saveResultLock(nextLock: ResultLockRecord) {
  const locks = await readResultLocks();
  const nextLocks = locks.map((lock) => (lock.id === nextLock.id ? nextLock : lock));

  await writeResultLocks(nextLocks);
  return nextLock;
}
