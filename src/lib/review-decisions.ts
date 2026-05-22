import type { ResultStatus } from "@/lib/types";

export type ReviewReleaseState = "in_review" | "corrections" | "approved" | "published";

export interface ReviewDecision {
  regNumber: string;
  releaseState: ReviewReleaseState;
  note: string;
  decidedBy: string;
  decidedByRole: string;
  decidedAt: string;
  stage: string;
}

export type ReviewDecisionStore = Record<string, ReviewDecision>;

const RELEASE_STATE_TO_STATUS: Record<ReviewReleaseState, ResultStatus> = {
  in_review: "under_review",
  corrections: "corrections_requested",
  approved: "principal_approved",
  published: "published",
};

export function releaseStateToStatus(state: ReviewReleaseState): ResultStatus {
  return RELEASE_STATE_TO_STATUS[state];
}

export function releaseStateLabel(state: ReviewReleaseState): string {
  const labels: Record<ReviewReleaseState, string> = {
    in_review: "Under Review",
    corrections: "Corrections Requested",
    approved: "Approved for Release",
    published: "Published",
  };

  return labels[state];
}
