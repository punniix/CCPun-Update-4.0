export const SOCIAL_MARKETING_MART_P2 = {
  version: "20260902_social_marketing_mart_p2_full_backfill_clean",
  checksum: "sha256:1dfbe426656ada42fa59f4b0d0727a39c293534abf964690bbbe0d8c6294727f",
} as const;

export const SOCIAL_MARKETING_MART_PROVENANCE = {
  version: "20260902_social_marketing_mart_p2_metric_provenance",
  checksum: "sha256:5b421a7bb67798d6b45911c1b05e3f54bc9f50c0482b48857f6780e7379ef866",
} as const;

export const SOCIAL_MARKETING_REQUIRED_RELATIONS = [
  "marketing_content_current",
  "post_metric_status_latest",
  "post_metric_coverage_summary",
  "post_performance_clean",
] as const;

export type SocialMarketingCapabilityMode = "clean-mart" | "raw-preview-fallback" | "blocked";

export function resolveSocialMarketingCapabilityMode(input: {
  lane: "uat" | "production";
  martCurrent: boolean;
  provenanceCurrent: boolean;
  relationsCurrent: boolean;
}): SocialMarketingCapabilityMode {
  const clean = input.martCurrent && input.provenanceCurrent && input.relationsCurrent;
  if (clean) return "clean-mart";
  return input.lane === "uat" ? "raw-preview-fallback" : "blocked";
}
