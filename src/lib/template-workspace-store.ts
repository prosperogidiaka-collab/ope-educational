import "server-only";

import { mkdir, readFile, writeFile } from "@/lib/storage-fs";
import path from "path";

import { publishedCount, school, starterTemplateSchemas } from "@/lib/demo-data";
import { buildDefaultTemplateWorkspace } from "@/lib/template-workspace";
import type { ResultTemplateWorkspace } from "@/lib/types";

const TEMPLATE_WORKSPACE_PATH = path.join(process.cwd(), "data", "template-workspace.json");

async function ensureTemplateWorkspaceFile() {
  await mkdir(path.dirname(TEMPLATE_WORKSPACE_PATH), { recursive: true });

  try {
    await readFile(TEMPLATE_WORKSPACE_PATH, "utf8");
  } catch {
    const defaultWorkspace = buildDefaultTemplateWorkspace(
      school.schoolCode,
      starterTemplateSchemas,
      publishedCount > 0,
    );
    await writeFile(TEMPLATE_WORKSPACE_PATH, JSON.stringify(defaultWorkspace, null, 2), "utf8");
  }
}

export async function readTemplateWorkspace(): Promise<ResultTemplateWorkspace> {
  await ensureTemplateWorkspaceFile();

  try {
    const fileContents = await readFile(TEMPLATE_WORKSPACE_PATH, "utf8");
    const parsed = JSON.parse(fileContents) as Partial<ResultTemplateWorkspace>;

    if (!parsed || !parsed.schoolCode || !parsed.draftSchema || !parsed.liveSchema) {
      return buildDefaultTemplateWorkspace(school.schoolCode, starterTemplateSchemas, publishedCount > 0);
    }

    return parsed as ResultTemplateWorkspace;
  } catch {
    return buildDefaultTemplateWorkspace(school.schoolCode, starterTemplateSchemas, publishedCount > 0);
  }
}

export async function writeTemplateWorkspace(workspace: ResultTemplateWorkspace) {
  await ensureTemplateWorkspaceFile();
  await writeFile(TEMPLATE_WORKSPACE_PATH, JSON.stringify(workspace, null, 2), "utf8");
}
