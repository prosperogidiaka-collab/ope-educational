import type { ResultTemplateSchema, ResultTemplateWorkspace } from "@/lib/types";

export function cloneTemplateSchema(schema: ResultTemplateSchema): ResultTemplateSchema {
  return JSON.parse(JSON.stringify(schema)) as ResultTemplateSchema;
}

export function buildDefaultTemplateWorkspace(
  schoolCode: string,
  starterTemplates: ResultTemplateSchema[],
  isLocked: boolean,
): ResultTemplateWorkspace {
  const liveSchema = cloneTemplateSchema(starterTemplates[0]);
  const draftSchema = cloneTemplateSchema(starterTemplates[0]);

  return {
    schoolCode,
    starterTemplates: starterTemplates.map((template) => cloneTemplateSchema(template)),
    draftSchema,
    liveSchema,
    status: isLocked ? "locked" : "live",
    lockedReason: isLocked
      ? "The current term already has published results, so the live template is locked for consistency."
      : undefined,
    updatedAt: new Date().toISOString(),
  };
}
