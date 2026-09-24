import { z } from "zod";

export const CAPTURE_SOURCES = ["admin", "shortcut"] as const;
export const CAPTURE_EVIDENCE_KINDS = ["fact", "inference", "recommendation"] as const;
export const CAPTURE_DESTINATIONS = [
  "crm.customer",
  "crm.lead",
  "crm.task",
  "crm.private_note",
  "content.inbox",
  "research.inbox",
  "calendar.projection",
] as const;

export const captureSourceSchema = z.enum(CAPTURE_SOURCES);
export const captureEvidenceKindSchema = z.enum(CAPTURE_EVIDENCE_KINDS);
export const captureDestinationSchema = z.enum(CAPTURE_DESTINATIONS);

export const captureProposalSchema = z.object({
  proposalId: z.string().uuid(),
  destination: captureDestinationSchema,
  evidenceKind: captureEvidenceKindSchema,
  fieldPath: z.string().regex(/^[a-zA-Z0-9_.-]{1,120}$/),
  sourceEvidenceDigestSha256: z.string().regex(/^[0-9a-f]{64}$/),
  confidence: z.number().min(0).max(1).nullable(),
  dataClass: z.enum(["public_safe", "internal_safe", "customer_private"]),
}).strict();

export type CaptureProposal = z.infer<typeof captureProposalSchema>;

export type CaptureProposalPolicy = {
  mayAutoCommit: boolean;
  requiresHumanConfirmation: boolean;
  reason:
    | "confirmed_fact_still_requires_private_write_confirmation"
    | "non_private_fact_can_be_committed_by_owner_flow"
    | "ai_inference_is_proposal_only"
    | "recommendation_is_proposal_only";
};

export function evaluateCaptureProposalPolicy(proposal: CaptureProposal): CaptureProposalPolicy {
  if (proposal.evidenceKind === "inference") {
    return { mayAutoCommit: false, requiresHumanConfirmation: true, reason: "ai_inference_is_proposal_only" };
  }
  if (proposal.evidenceKind === "recommendation") {
    return { mayAutoCommit: false, requiresHumanConfirmation: true, reason: "recommendation_is_proposal_only" };
  }
  if (proposal.dataClass === "customer_private") {
    return {
      mayAutoCommit: false,
      requiresHumanConfirmation: true,
      reason: "confirmed_fact_still_requires_private_write_confirmation",
    };
  }
  return {
    mayAutoCommit: true,
    requiresHumanConfirmation: false,
    reason: "non_private_fact_can_be_committed_by_owner_flow",
  };
}

export function captureSupportsManualFallback(destination: CaptureProposal["destination"]) {
  return CAPTURE_DESTINATIONS.includes(destination);
}
