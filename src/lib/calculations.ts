import type {
  AcademicConfig,
  ApprovalStage,
  ComputedSubjectScore,
  GradeBand,
  RankingPolicy,
  ScoreComponentRule,
  StudentResultBundle,
  StudentSummary,
  Subject,
} from "@/lib/types";

const FALLBACK_COMPONENTS: ScoreComponentRule[] = [
  { key: "test1", label: "Test 1", maxScore: 20, weight: 20, frozen: false, closesAt: "" },
  { key: "test2", label: "Test 2", maxScore: 20, weight: 20, frozen: false, closesAt: "" },
  { key: "exam", label: "Exam", maxScore: 60, weight: 60, frozen: false, closesAt: "" },
];

const FALLBACK_RANKING_POLICY: RankingPolicy = {
  tieBreakers: ["weightedAverage", "mathematics", "english", "attendance"],
  excludeIncompleteStudents: true,
  minimumSubjectCount: 1,
  roundingMode: "2 decimal places",
  missingScoresCountAsZero: false,
};

export function clampScore(value: number | null, max: number) {
  if (value === null || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(max, value));
}

type ScoreValueCarrier = {
  componentScores?: Record<string, number | null>;
  test1?: number | null;
  test2?: number | null;
  exam?: number | null;
};

export function getScoreValue(
  score: ScoreValueCarrier,
  key: string,
) {
  if (score.componentScores && Object.prototype.hasOwnProperty.call(score.componentScores, key)) {
    return score.componentScores[key] ?? null;
  }

  if (key === "test1") {
    return score.test1 ?? null;
  }

  if (key === "test2") {
    return score.test2 ?? null;
  }

  if (key === "exam") {
    return score.exam ?? null;
  }

  return null;
}

export function isSubjectIncomplete(
  score: ScoreValueCarrier,
  scoreComponents: ScoreComponentRule[] = FALLBACK_COMPONENTS,
) {
  return scoreComponents.some((component) => getScoreValue(score, component.key) === null);
}

export function calculateSubjectTotalForScore(
  score: ScoreValueCarrier,
  scoreComponents: ScoreComponentRule[] = FALLBACK_COMPONENTS,
  rankingPolicy: RankingPolicy = FALLBACK_RANKING_POLICY,
) {
  const total = scoreComponents.reduce((sum, component) => {
    const value = getScoreValue(score, component.key);

    if (value === null && !rankingPolicy.missingScoresCountAsZero) {
      return sum;
    }

    const normalized = clampScore(value, component.maxScore) / (component.maxScore || 1);

    return sum + normalized * component.weight;
  }, 0);

  return Number(total.toFixed(2));
}

export function resolveGrade(score: number, gradeScale: GradeBand[]) {
  return gradeScale.find((band) => score >= band.min && score <= band.max) ?? gradeScale[gradeScale.length - 1];
}

function trendDirection(points: { average: number }[]) {
  if (points.length < 2) {
    return "steady" as const;
  }

  const delta = points[points.length - 1].average - points[0].average;

  if (delta > 1.5) {
    return "up" as const;
  }

  if (delta < -1.5) {
    return "down" as const;
  }

  return "steady" as const;
}

export function buildOverallRemark(score: number, grade: GradeBand) {
  if (score >= 80) {
    return "Outstanding overall performance with strong consistency across subjects.";
  }

  if (score >= 65) {
    return "Strong performance with room to push the highest-value subjects even further.";
  }

  if (score >= 55) {
    return `Steady academic performance. ${grade.remark} profile with clear improvement potential.`;
  }

  return "Performance is below target and needs close follow-up before the next term.";
}

function resolveTieBreakerValue(summary: StudentSummary, rule: string) {
  if (rule === "weightedAverage") {
    return summary.weightedAverage;
  }

  if (rule === "total") {
    return summary.total;
  }

  if (rule === "attendance") {
    return summary.bundle.student.attendance.present;
  }

  const subjectMatch = summary.computedSubjects.find((subject) => {
    const ruleLower = rule.toLowerCase();
    return subject.subjectName.toLowerCase().includes(ruleLower) || subject.subjectCode.toLowerCase() === ruleLower;
  });

  return subjectMatch?.total ?? 0;
}

export function computeStudentSummary(
  bundle: StudentResultBundle,
  subjects: Subject[],
  gradeScale: GradeBand[],
  academicConfig?: AcademicConfig,
): StudentSummary {
  const scoreComponents = academicConfig?.scoreComponents ?? FALLBACK_COMPONENTS;
  const rankingPolicy = academicConfig?.rankingPolicy ?? FALLBACK_RANKING_POLICY;
  const registeredSubjectIds = bundle.student.registeredSubjectIds;
  const relevantScores = bundle.scores.filter((score) => registeredSubjectIds.includes(score.subjectId));

  const computedSubjects: ComputedSubjectScore[] = relevantScores.map((score) => {
    const subject = subjects.find((item) => item.id === score.subjectId);

    if (!subject) {
      throw new Error(`Missing subject definition for ${score.subjectId}`);
    }

    const total = calculateSubjectTotalForScore(score, scoreComponents, rankingPolicy);
    const grade = resolveGrade(total, gradeScale);
    const incomplete = isSubjectIncomplete(score, scoreComponents);

    return {
      ...score,
      subjectName: subject.name,
      subjectCode: subject.code,
      weight: subject.weight,
      total,
      grade,
      classAverage: 0,
      classHighest: 0,
      classLowest: 0,
      subjectPosition: 0,
      isIncomplete: incomplete,
    };
  });

  const completeSubjects = computedSubjects.filter((entry) => !entry.isIncomplete);
  const total = computedSubjects.reduce((sum, entry) => sum + entry.total, 0);
  const denominator = completeSubjects.length || computedSubjects.length || 1;
  const average = Number((total / denominator).toFixed(2));
  const weightedUnits = completeSubjects.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  const weightedAverage = Number(
    (
      completeSubjects.reduce((sum, entry) => sum + entry.total * entry.weight, 0) / weightedUnits
    ).toFixed(2),
  );
  const overallGrade = resolveGrade(weightedAverage, gradeScale);
  const gradePoints = Number(
    (
      completeSubjects.reduce((sum, entry) => sum + entry.grade.points, 0) / (completeSubjects.length || 1)
    ).toFixed(2),
  );
  const incompleteSubjects = computedSubjects.filter((entry) => entry.isIncomplete).length;
  const eligibleForPosition =
    completeSubjects.length >= rankingPolicy.minimumSubjectCount &&
    (!rankingPolicy.excludeIncompleteStudents || incompleteSubjects === 0);
  const sortedSubjects = [...computedSubjects].sort((left, right) => right.total - left.total);
  const bestSubject = sortedSubjects[0];
  const weakestSubject = sortedSubjects[sortedSubjects.length - 1];
  const anomalies: string[] = [];

  if (incompleteSubjects > 0) {
    anomalies.push(`${incompleteSubjects} subject score(s) incomplete`);
  }

  if (bundle.clearances.some((item) => item.status === "blocked")) {
    anomalies.push("Release blocked by school clearance rule");
  }

  return {
    bundle,
    computedSubjects,
    total,
    average,
    weightedAverage,
    gradePoints,
    overallGrade,
    position: 0,
    bestSubject,
    weakestSubject,
    overallRemarkSuggestion: buildOverallRemark(weightedAverage, overallGrade),
    trendDirection: trendDirection(bundle.student.trend),
    incompleteSubjects,
    eligibleForPosition,
    anomalies,
  };
}

export function rankStudentSummaries(
  bundles: StudentResultBundle[],
  subjects: Subject[],
  gradeScale: GradeBand[],
  academicConfig?: AcademicConfig,
) {
  const summaries = bundles.map((bundle) => computeStudentSummary(bundle, subjects, gradeScale, academicConfig));
  const subjectAverages = new Map<string, number>();
  const subjectHighest = new Map<string, number>();
  const subjectLowest = new Map<string, number>();
  const subjectPositions = new Map<string, Map<string, number>>();

  subjects.forEach((subject) => {
    const completeEntries = summaries
      .flatMap((summary) =>
        summary.computedSubjects
          .filter((entry) => entry.subjectId === subject.id && !entry.isIncomplete)
          .map((entry) => ({ regNumber: summary.bundle.student.regNumber, total: entry.total })),
      );
    const totals = completeEntries.map((entry) => entry.total);

    subjectAverages.set(
      subject.id,
      Number(((totals.reduce((sum, value) => sum + value, 0) / (totals.length || 1)) || 0).toFixed(2)),
    );
    subjectHighest.set(subject.id, totals.length ? Math.max(...totals) : 0);
    subjectLowest.set(subject.id, totals.length ? Math.min(...totals) : 0);

    const ranked = [...completeEntries].sort((left, right) => right.total - left.total);
    const positionByReg = new Map<string, number>();
    let previousTotal = Number.NaN;
    let previousPosition = 0;

    ranked.forEach((entry, index) => {
      if (index > 0 && entry.total === previousTotal) {
        positionByReg.set(entry.regNumber, previousPosition);
        return;
      }

      previousPosition = index + 1;
      previousTotal = entry.total;
      positionByReg.set(entry.regNumber, previousPosition);
    });

    subjectPositions.set(subject.id, positionByReg);
  });

  summaries.forEach((summary) => {
    summary.computedSubjects = summary.computedSubjects.map((entry) => ({
      ...entry,
      classAverage: subjectAverages.get(entry.subjectId) ?? 0,
      classHighest: subjectHighest.get(entry.subjectId) ?? 0,
      classLowest: subjectLowest.get(entry.subjectId) ?? 0,
      subjectPosition: entry.isIncomplete
        ? 0
        : subjectPositions.get(entry.subjectId)?.get(summary.bundle.student.regNumber) ?? 0,
    }));

    summary.bestSubject = [...summary.computedSubjects].sort((left, right) => right.total - left.total)[0];
    summary.weakestSubject = [...summary.computedSubjects].sort((left, right) => left.total - right.total)[0];
  });

  const rankingPolicy = academicConfig?.rankingPolicy ?? FALLBACK_RANKING_POLICY;
  const eligible = summaries.filter((summary) => summary.eligibleForPosition);
  const ineligible = summaries.filter((summary) => !summary.eligibleForPosition);
  const ordered = [...eligible].sort((left, right) => {
    for (const rule of rankingPolicy.tieBreakers) {
      const delta = resolveTieBreakerValue(right, rule) - resolveTieBreakerValue(left, rule);

      if (delta !== 0) {
        return delta;
      }
    }

    return 0;
  });

  let previousKey = "";
  let previousPosition = 0;

  ordered.forEach((summary, index) => {
    const key = rankingPolicy.tieBreakers.map((rule) => resolveTieBreakerValue(summary, rule)).join("|");

    if (index > 0 && key === previousKey) {
      summary.position = previousPosition;
      return;
    }

    summary.position = index + 1;
    previousPosition = summary.position;
    previousKey = key;
  });

  ineligible.forEach((summary) => {
    summary.position = 0;
  });

  return [...ordered, ...ineligible];
}

export function ordinal(position: number) {
  if (position <= 0) {
    return "N/A";
  }

  const mod100 = position % 100;

  if (mod100 >= 11 && mod100 <= 13) {
    return `${position}th`;
  }

  switch (position % 10) {
    case 1:
      return `${position}st`;
    case 2:
      return `${position}nd`;
    case 3:
      return `${position}rd`;
    default:
      return `${position}th`;
  }
}

export function stageLabel(stage: ApprovalStage) {
  const labels: Record<ApprovalStage, string> = {
    teacher_submission: "Teacher Submission",
    hod_review: "HOD Review",
    class_teacher_review: "Class Teacher Review",
    bursary_clearance: "Bursary Clearance",
    management_audit: "Management Audit",
    principal_approval: "School Admin Approval",
  };

  return labels[stage];
}

export function resultStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted",
    under_review: "Under Review",
    corrections_requested: "Corrections Requested",
    hod_approved: "HOD Approved",
    principal_approved: "School Admin Approved",
    published: "Published",
    locked: "Locked",
    archived: "Archived",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    cleared: "Cleared",
    blocked: "Blocked",
    active: "Active",
    disabled: "Disabled",
    invited: "Invited",
    trial: "Trial",
    expired: "Expired",
    suspended: "Suspended",
    ready: "Ready",
    hold: "Hold",
    declined: "Declined",
    excused: "Excused",
    praise: "Praise",
    guidance: "Guidance",
    discipline: "Discipline",
    health: "Health",
    result_comment: "Result Comment",
    general: "General",
    withdrawn: "Withdrawn",
    graduated: "Graduated",
    left: "Left",
    retired: "Retired",
    core: "Core",
    elective: "Elective",
    duplicate_structure: "Duplicate Structure",
    promote_students: "Promote Students",
    archive_arm: "Archive Arm",
    daily_report: "Daily Report",
    weekly_report: "Weekly Report",
    challenge: "Challenge",
    progress: "Progress",
    incident: "Incident",
    visitor: "Visitor",
    commendation: "Commendation",
    warning: "Warning",
    observation: "Observation",
    development: "Development",
    day: "Day",
    week: "Week",
    month: "Month",
    term: "Term",
    session: "Session",
  };

  return labels[status] ?? status;
}

export function formatDate(dateText: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateText));
}

export function formatDateOnly(dateText: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(new Date(dateText));
}

export function isExpired(dateText: string) {
  return new Date(dateText).getTime() < Date.now();
}
