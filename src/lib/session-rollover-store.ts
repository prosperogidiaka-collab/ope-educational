import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { school } from "@/lib/demo-data";
import type { SessionRolloverRecord } from "@/lib/types";

const SESSION_ROLLOVER_STORE_PATH = path.join(process.cwd(), "data", "session-rollover.json");

function buildSeedStore(): SessionRolloverRecord[] {
  return [];
}

async function ensureSessionRolloverStoreFile() {
  await mkdir(path.dirname(SESSION_ROLLOVER_STORE_PATH), { recursive: true });

  try {
    await readFile(SESSION_ROLLOVER_STORE_PATH, "utf8");
  } catch {
    await writeFile(SESSION_ROLLOVER_STORE_PATH, JSON.stringify(buildSeedStore(), null, 2), "utf8");
  }
}

function normalizeRolloverRecord(record: SessionRolloverRecord): SessionRolloverRecord {
  return {
    ...record,
    schoolCode: record.schoolCode || school.schoolCode,
    note: record.note.trim(),
  };
}

export async function readSessionRolloverRecords(): Promise<SessionRolloverRecord[]> {
  await ensureSessionRolloverStoreFile();

  try {
    const fileContents = await readFile(SESSION_ROLLOVER_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as SessionRolloverRecord[];
    const normalized = parsed.map(normalizeRolloverRecord);

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeSessionRolloverRecords(normalized);
    }

    return normalized.sort((left, right) => new Date(right.actedAt).getTime() - new Date(left.actedAt).getTime());
  } catch {
    return buildSeedStore();
  }
}

export async function writeSessionRolloverRecords(records: SessionRolloverRecord[]) {
  await ensureSessionRolloverStoreFile();
  await writeFile(
    SESSION_ROLLOVER_STORE_PATH,
    JSON.stringify(records.map(normalizeRolloverRecord), null, 2),
    "utf8",
  );
}

export async function saveSessionRolloverRecord(nextRecord: SessionRolloverRecord) {
  const records = await readSessionRolloverRecords();
  records.unshift(normalizeRolloverRecord(nextRecord));
  await writeSessionRolloverRecords(records);
  return normalizeRolloverRecord(nextRecord);
}
