import { ReportSheetView } from "@/components/report-sheet-view";
import {
  buildResultSheetDraft,
  mergeResultSheetDraft,
  type ResultSheetDraft,
} from "@/lib/report-sheet";
import { buildShortVerificationPath } from "@/lib/short-links";
import type { AcademicConfig, GradeBand, ResultTemplateSchema, SchoolProfile, StudentSummary } from "@/lib/types";

interface ReportCardProps {
  school: SchoolProfile;
  summary: StudentSummary;
  overrideDraft?: Partial<ResultSheetDraft> | null;
  templateSchema?: ResultTemplateSchema;
  classSize?: number;
  gradeBands?: GradeBand[];
  academicConfig?: AcademicConfig;
}

export function ReportCard({
  school,
  summary,
  overrideDraft,
  templateSchema,
  classSize,
  gradeBands,
  academicConfig,
}: ReportCardProps) {
  const baseDraft = buildResultSheetDraft(school, summary, { classSize, gradeBands, academicConfig });
  const draft = mergeResultSheetDraft(baseDraft, overrideDraft);

  return (
    <ReportSheetView
      draft={draft}
      templateSchema={templateSchema}
      verificationHref={buildShortVerificationPath(summary.bundle.verificationId)}
      showActions
      academicConfig={academicConfig}
    />
  );
}
