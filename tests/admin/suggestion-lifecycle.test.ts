import assert from "node:assert/strict";
import test from "node:test";
import {
  approvedBaseIsCurrent,
  canApplySuggestion,
  canApproveSuggestion,
  canEditSuggestion,
  canRejectSuggestion,
  deterministicAuditSuggestionId,
  frozenControlsForApply,
  isHumanReviewActor,
  isAppliedSuggestionReplay,
  isCompatibleReviewSuggestion,
  indexSuggestionTargets,
  privateAdminDocumentId,
  isStaleSuggestionRevision,
} from "../../lib/admin/suggestion-lifecycle";

test("approval and apply accept human actors only", () => {
  assert.equal(isHumanReviewActor("human"), true);
  assert.equal(isHumanReviewActor("ai"), false);
  assert.equal(isHumanReviewActor("system"), false);
});

test("proposal lifecycle never moves a replayed state backward", () => {
  assert.equal(canApproveSuggestion("needs-human-review"), true);
  assert.equal(canEditSuggestion("needs-human-review"), true);
  assert.equal(canRejectSuggestion("needs-human-review"), true);
  assert.equal(canApproveSuggestion("approved"), false);
  assert.equal(canEditSuggestion("approved"), false);
  assert.equal(canRejectSuggestion("applied"), false);
  assert.equal(canApproveSuggestion("applied"), false);
  assert.equal(canApplySuggestion("approved"), true);
  assert.equal(canApplySuggestion("needs-human-review"), false);
  assert.equal(canApplySuggestion("applied"), false);
  assert.equal(isAppliedSuggestionReplay("applied"), true);
  assert.equal(isAppliedSuggestionReplay("approved"), false);
});

test("approved base requires both the same revision and field value", () => {
  const base = { currentRevision: "rev-1", approvedRevision: "rev-1", currentValue: "old", approvedBaseValue: "old" };
  assert.equal(approvedBaseIsCurrent(base), true);
  assert.equal(approvedBaseIsCurrent({ ...base, currentRevision: "rev-2" }), false);
  assert.equal(approvedBaseIsCurrent({ ...base, currentValue: "edited" }), false);
  assert.equal(approvedBaseIsCurrent({ ...base, currentValue: undefined, approvedBaseValue: null }), true);
});

test("review queue treats missing or changed target revisions as stale", () => {
  assert.equal(isStaleSuggestionRevision("rev-2", "rev-2"), false);
  assert.equal(isStaleSuggestionRevision("rev-1", "rev-2"), true);
  assert.equal(isStaleSuggestionRevision(null, "rev-2"), true);
});

test("review queue contains only current proposals with complete approval controls", () => {
  const current = { targetRevision: "rev-2", targetCurrentRevision: "rev-2" };
  assert.equal(isCompatibleReviewSuggestion({ status: "needs-human-review", ...current }), true);
  assert.equal(isCompatibleReviewSuggestion({ status: "needs-human-review", ...current, targetRevision: "rev-1" }), false);
  assert.equal(isCompatibleReviewSuggestion({ status: "applied", ...current }), false);
  assert.equal(isCompatibleReviewSuggestion({
    status: "approved",
    approvedAfter: "new",
    approvedType: "seo-title",
    approvedRiskLevel: "low",
    approvedTargetId: "article-1",
    approvedTargetRevision: "rev-2",
    targetCurrentRevision: "rev-2",
  }), true);
  assert.equal(isCompatibleReviewSuggestion({
    status: "approved",
    approvedAfter: "new",
    approvedType: "seo-title",
    approvedRiskLevel: "low",
    approvedTargetId: "article-1",
    approvedTargetRevision: "rev-1",
    targetCurrentRevision: "rev-2",
  }), false);
});

test("review target lookup normalizes drafts IDs and prefers current draft revisions", () => {
  const rows = [
    { id: "article-1", isDraft: false, revision: "published-rev" },
    { id: "drafts.article-1", isDraft: true, revision: "draft-rev" },
    { id: "drafts.article-2", isDraft: true, revision: "rev-2" },
  ];
  const result = indexSuggestionTargets(rows);
  assert.equal(result.size, 2);
  assert.equal(result.get("article-1")?.revision, "draft-rev");
  assert.equal(result.get("article-2")?.revision, "rev-2");
  assert.equal(result.has("drafts.article-1"), false);
  assert.equal(isCompatibleReviewSuggestion({
    status: "needs-human-review",
    targetRevision: "rev-2",
    targetCurrentRevision: result.get("article-2")?.revision,
  }), true);
  assert.equal(isCompatibleReviewSuggestion({
    status: "needs-human-review",
    targetRevision: "old-rev",
    targetCurrentRevision: result.get("article-2")?.revision,
  }), false);
});

test("audit proposal id is stable per draft revision and proposal type", () => {
  const input = { draftId: "drafts.article-1", revision: "rev-1", type: "seo-title" };
  const first = deterministicAuditSuggestionId(input);
  assert.equal(first, deterministicAuditSuggestionId(input));
  assert.notEqual(first, deterministicAuditSuggestionId({ ...input, revision: "rev-2" }));
  assert.notEqual(first, deterministicAuditSuggestionId({ ...input, type: "meta-description" }));
  assert.match(first, /^seoSuggestion\.audit\.[a-f0-9]{32}$/);
});

test("every internal Admin document stays in Sanity's authenticated Draft namespace", () => {
  assert.equal(privateAdminDocumentId("seoSuggestion.audit.abc"), "drafts.seoSuggestion.audit.abc");
  assert.equal(privateAdminDocumentId("drafts.auditLog.abc"), "drafts.auditLog.abc");
  assert.equal(privateAdminDocumentId("researchSnapshot.abc"), "drafts.researchSnapshot.abc");
});

test("apply uses the approved type even if the live type is tampered", () => {
  const live = { type: "primary-keyword" };
  const frozen = frozenControlsForApply({ approvedType: "seo-title", approvedRiskLevel: "low", approvedTargetId: "article-1" });
  assert.equal(live.type, "primary-keyword");
  assert.equal(frozen?.type, "seo-title");
});

test("apply uses the approved risk even if the live risk is lowered", () => {
  const live = { riskLevel: "low" };
  const frozen = frozenControlsForApply({ approvedType: "seo-title", approvedRiskLevel: "high", approvedTargetId: "article-1" });
  assert.equal(live.riskLevel, "low");
  assert.equal(frozen?.riskLevel, "high");
});

test("apply uses the approved target even if the live reference is redirected", () => {
  const live = { targetId: "article-2" };
  const frozen = frozenControlsForApply({ approvedType: "seo-title", approvedRiskLevel: "low", approvedTargetId: "article-1" });
  assert.equal(live.targetId, "article-2");
  assert.equal(frozen?.targetId, "article-1");
});
