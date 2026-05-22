import { currentAcademicConfig, school } from "@/lib/demo-data";
import type {
  AcademicConfig,
  LegacyScoreField,
  ScoreComponentRule,
  SchoolProfile,
} from "@/lib/types";

export const LEGACY_COMPONENT_KEYS: LegacyScoreField[] = ["test1", "test2", "exam"];
export const TERM_OPTIONS = ["First Term", "Second Term", "Third Term"];
export const SECTION_OPTIONS: AcademicConfig["section"][] = ["junior", "senior"];

const COMPONENT_DEFAULTS: Record<LegacyScoreField, ScoreComponentRule> = {
  test1: {
    key: "test1",
    label: "Assessment 1",
    maxScore: 20,
    weight: 20,
    frozen: false,
    closesAt: "",
  },
  test2: {
    key: "test2",
    label: "Assessment 2",
    maxScore: 20,
    weight: 20,
    frozen: false,
    closesAt: "",
  },
  exam: {
    key: "exam",
    label: "Exam",
    maxScore: 60,
    weight: 60,
    frozen: false,
    closesAt: "",
  },
};

const SEED_ACADEMIC_CONFIG = {
  ...currentAcademicConfig,
  scoreComponents: currentAcademicConfig.scoreComponents.map((component) => ({
    ...component,
  })),
  rankingPolicy: {
    ...currentAcademicConfig.rankingPolicy,
    tieBreakers: [...currentAcademicConfig.rankingPolicy.tieBreakers],
  },
};

function slugifyComponentKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function uniqueComponentKey(baseKey: string, seen: Set<string>) {
  let candidate = baseKey || "assessment";
  let suffix = 2;

  while (seen.has(candidate)) {
    candidate = `${baseKey || "assessment"}_${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function defaultComponentLabel(index: number, isLastSlot = false) {
  if (index === 0) {
    return "Assessment 1";
  }

  if (index === 1) {
    return "Assessment 2";
  }

  if (index === 2 || isLastSlot) {
    return "Exam";
  }

  return `Assessment ${index + 1}`;
}

function normalizeComponent(
  component: Partial<ScoreComponentRule> | undefined,
  index: number,
  seen: Set<string>,
  isFallbackExam = false,
): ScoreComponentRule {
  const fallbackFromLegacy = COMPONENT_DEFAULTS[LEGACY_COMPONENT_KEYS[index] as LegacyScoreField];
  const fallbackKey = fallbackFromLegacy?.key ?? `assessment_${index + 1}`;
  const fallbackLabel =
    fallbackFromLegacy?.label ?? defaultComponentLabel(index, isFallbackExam);
  const baseKey = slugifyComponentKey(component?.key || component?.label || fallbackKey) || fallbackKey;
  const key = uniqueComponentKey(baseKey, seen);
  seen.add(key);

  return {
    key,
    label: component?.label?.trim() || fallbackLabel,
    maxScore: Math.max(1, Number(component?.maxScore) || fallbackFromLegacy?.maxScore || 20),
    weight: Math.max(0, Number(component?.weight) || fallbackFromLegacy?.weight || 0),
    frozen: Boolean(component?.frozen),
    closesAt: component?.closesAt || fallbackFromLegacy?.closesAt || "",
  };
}

export function normalizeAcademicConfig(config: Partial<AcademicConfig>): AcademicConfig {
  const seedConfig = SEED_ACADEMIC_CONFIG;
  const componentInput = config.scoreComponents ?? seedConfig.scoreComponents;
  const seen = new Set<string>();
  const normalizedComponents = componentInput
    .map((component, index) =>
      normalizeComponent(
        component,
        index,
        seen,
        index === componentInput.length - 1 && componentInput.length >= 3,
      ),
    );

  const scoreComponents =
    normalizedComponents.length > 0
      ? normalizedComponents
      : seedConfig.scoreComponents.map((component, index) =>
          normalizeComponent(component, index, seen, index === 2),
        );

  return {
    session: config.session?.trim() || seedConfig.session,
    term: config.term?.trim() || seedConfig.term,
    examType: config.examType?.trim() || seedConfig.examType,
    section: config.section ?? seedConfig.section,
    gradeScaleName: config.gradeScaleName?.trim() || seedConfig.gradeScaleName,
    publishScope: config.publishScope?.trim() || seedConfig.publishScope,
    scoreComponents,
    rankingPolicy: {
      tieBreakers:
        config.rankingPolicy?.tieBreakers?.filter(Boolean).map((item) => item.trim()) ||
        seedConfig.rankingPolicy.tieBreakers,
      excludeIncompleteStudents:
        config.rankingPolicy?.excludeIncompleteStudents ?? seedConfig.rankingPolicy.excludeIncompleteStudents,
      minimumSubjectCount: Math.max(
        1,
        Number(config.rankingPolicy?.minimumSubjectCount) || seedConfig.rankingPolicy.minimumSubjectCount,
      ),
      roundingMode: config.rankingPolicy?.roundingMode?.trim() || seedConfig.rankingPolicy.roundingMode,
      missingScoresCountAsZero:
        config.rankingPolicy?.missingScoresCountAsZero ?? seedConfig.rankingPolicy.missingScoresCountAsZero,
    },
  };
}

export const DEFAULT_ACADEMIC_CONFIG: AcademicConfig = normalizeAcademicConfig(SEED_ACADEMIC_CONFIG);

export function buildLegacyComponentKeyMap(config?: AcademicConfig) {
  const componentKeys = (config?.scoreComponents ?? DEFAULT_ACADEMIC_CONFIG.scoreComponents).map(
    (component) => component.key,
  );

  return {
    test1: componentKeys[0] ?? null,
    test2: componentKeys[1] ?? null,
    exam: componentKeys[2] ?? null,
  } satisfies Record<LegacyScoreField, string | null>;
}

export function buildAcademicComponentLabels(config?: AcademicConfig) {
  const scoreComponents = config?.scoreComponents ?? DEFAULT_ACADEMIC_CONFIG.scoreComponents;

  return {
    test1: scoreComponents[0]?.label ?? COMPONENT_DEFAULTS.test1.label,
    test2: scoreComponents[1]?.label ?? COMPONENT_DEFAULTS.test2.label,
    exam: scoreComponents[2]?.label ?? COMPONENT_DEFAULTS.exam.label,
  } satisfies Record<LegacyScoreField, string>;
}

export function buildComponentScoresFromLegacy(values?: {
  test1?: number | null;
  test2?: number | null;
  exam?: number | null;
}) {
  return {
    test1: values?.test1 ?? null,
    test2: values?.test2 ?? null,
    exam: values?.exam ?? null,
  };
}

export function normalizeComponentScoreMap(
  componentScores: Record<string, number | null> | undefined,
  config?: AcademicConfig,
  legacyValues?: { test1?: number | null; test2?: number | null; exam?: number | null },
) {
  const source: Record<string, number | null> =
    componentScores && Object.keys(componentScores).length > 0
      ? componentScores
      : buildComponentScoresFromLegacy(legacyValues);
  const configuredKeys = (config?.scoreComponents ?? DEFAULT_ACADEMIC_CONFIG.scoreComponents).map(
    (component) => component.key,
  );
  const nextScores: Record<string, number | null> = {};

  configuredKeys.forEach((key) => {
    nextScores[key] = source[key] ?? null;
  });

  Object.entries(source).forEach(([key, value]) => {
    if (!(key in nextScores)) {
      nextScores[key] = value ?? null;
    }
  });

  return nextScores;
}

export function buildLegacyScoreSnapshot(
  componentScores: Record<string, number | null> | undefined,
  config?: AcademicConfig,
) {
  const map = buildLegacyComponentKeyMap(config);
  const normalized = normalizeComponentScoreMap(componentScores, config);

  return {
    test1: map.test1 ? normalized[map.test1] ?? null : null,
    test2: map.test2 ? normalized[map.test2] ?? null : null,
    exam: map.exam ? normalized[map.exam] ?? null : null,
  };
}

export function buildAssessmentBreakdown(config: AcademicConfig) {
  return config.scoreComponents
    .map((component) => `${component.label} (${component.weight})`)
    .join(", ");
}

export function totalConfiguredWeight(config: AcademicConfig) {
  return config.scoreComponents.reduce((sum, component) => sum + component.weight, 0);
}

export function createAssessmentComponent(existingComponents: ScoreComponentRule[]) {
  const seen = new Set(existingComponents.map((component) => component.key));
  const nextIndex = existingComponents.length + 1;
  const key = uniqueComponentKey(`assessment_${nextIndex}`, seen);

  return {
    key,
    label: `Assessment ${nextIndex}`,
    maxScore: 10,
    weight: 0,
    frozen: false,
    closesAt: "",
  } satisfies ScoreComponentRule;
}

export function buildRuntimeSchoolProfile(
  config: AcademicConfig,
  baseSchool: SchoolProfile = school,
): SchoolProfile {
  return {
    ...baseSchool,
    session: config.session,
    term: config.term,
    examType: config.examType,
  };
}
