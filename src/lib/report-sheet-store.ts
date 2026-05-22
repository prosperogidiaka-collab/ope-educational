import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import type { ResultSheetDraft, ResultSheetDraftStore } from "@/lib/report-sheet";

const REPORT_DRAFT_STORE_PATH = path.join(process.cwd(), "data", "report-sheet-overrides.json");

async function ensureReportDraftStoreFile() {
  await mkdir(path.dirname(REPORT_DRAFT_STORE_PATH), { recursive: true });

  try {
    await readFile(REPORT_DRAFT_STORE_PATH, "utf8");
  } catch {
    await writeFile(REPORT_DRAFT_STORE_PATH, JSON.stringify({}, null, 2), "utf8");
  }
}

export async function readReportSheetDraftStore(): Promise<ResultSheetDraftStore> {
  await ensureReportDraftStoreFile();

  try {
    const fileContents = await readFile(REPORT_DRAFT_STORE_PATH, "utf8");
    return JSON.parse(fileContents) as ResultSheetDraftStore;
  } catch {
    return {};
  }
}

export async function writeReportSheetDraftStore(store: ResultSheetDraftStore) {
  await ensureReportDraftStoreFile();
  await writeFile(REPORT_DRAFT_STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function getReportSheetOverride(regNumber: string) {
  const store = await readReportSheetDraftStore();
  return store[regNumber] ?? null;
}

export async function saveReportSheetOverride(regNumber: string, draft: ResultSheetDraft) {
  const store = await readReportSheetDraftStore();
  store[regNumber] = draft;
  await writeReportSheetDraftStore(store);
  return draft;
}

export async function deleteReportSheetOverride(regNumber: string) {
  const store = await readReportSheetDraftStore();
  delete store[regNumber];
  await writeReportSheetDraftStore(store);
}
