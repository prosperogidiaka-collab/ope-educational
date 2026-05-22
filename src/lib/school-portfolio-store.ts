import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { schoolPortfolio } from "@/lib/demo-data";
import type { SchoolPortfolioItem } from "@/lib/types";

const SCHOOL_PORTFOLIO_STORE_PATH = path.join(process.cwd(), "data", "school-portfolio.json");

function normalizeSchoolPortfolioItem(item: SchoolPortfolioItem): SchoolPortfolioItem {
  return {
    ...item,
    schoolCode: item.schoolCode.trim().toUpperCase(),
    portalSlug: item.portalSlug.trim().toLowerCase(),
    students: Math.max(0, Number(item.students) || 0),
    storageUsedGb: Number((Number(item.storageUsedGb) || 0).toFixed(1)),
    storageQuotaGb: Math.max(Number((Number(item.storageQuotaGb) || 0).toFixed(1)), Number(item.storageUsedGb) || 0),
    lastFollowUpAt: item.lastFollowUpAt || new Date().toISOString(),
    notes: item.notes?.trim() || "No follow-up note recorded yet.",
  };
}

async function ensureSchoolPortfolioStoreFile() {
  await mkdir(path.dirname(SCHOOL_PORTFOLIO_STORE_PATH), { recursive: true });

  try {
    await readFile(SCHOOL_PORTFOLIO_STORE_PATH, "utf8");
  } catch {
    await writeFile(SCHOOL_PORTFOLIO_STORE_PATH, JSON.stringify(schoolPortfolio, null, 2), "utf8");
  }
}

export async function readSchoolPortfolio(): Promise<SchoolPortfolioItem[]> {
  await ensureSchoolPortfolioStoreFile();

  try {
    const fileContents = await readFile(SCHOOL_PORTFOLIO_STORE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as SchoolPortfolioItem[];
    const normalized = parsed.map(normalizeSchoolPortfolioItem);

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeSchoolPortfolio(normalized);
    }

    return normalized;
  } catch {
    return schoolPortfolio.map(normalizeSchoolPortfolioItem);
  }
}

export async function writeSchoolPortfolio(items: SchoolPortfolioItem[]) {
  await ensureSchoolPortfolioStoreFile();
  const normalized = items.map(normalizeSchoolPortfolioItem);
  await writeFile(SCHOOL_PORTFOLIO_STORE_PATH, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

export async function getSchoolPortfolioItemById(schoolId: string) {
  const portfolio = await readSchoolPortfolio();
  return portfolio.find((item) => item.id === schoolId) ?? null;
}
