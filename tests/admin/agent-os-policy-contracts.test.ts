import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  captureProposalSchema,
  evaluateCaptureProposalPolicy,
} from "../../lib/admin/agent-os/capture-contract";
import {
  resolveComparisonWindow,
  resolveInsightWindow,
} from "../../lib/admin/agent-os/insight-window";
import {
  detectHeavyWorkloadCollisions,
  isInsideRecommendedHeavyWindow,
  LOCAL_AI_MAX_CONCURRENCY,
} from "../../lib/admin/agent-os/workload-scheduler";
import {
  cloudPayloadUsesOnlyAllowedKeys,
  evaluateCloudEligibility,
} from "../../lib/admin/agent-os/privacy-routing";

test("Capture keeps AI inference separate from confirmed customer facts", () => {
  const base = {
    proposalId: randomUUID(),
    destination: "crm.lead",
    fieldPath: "journey",
    sourceEvidenceDigestSha256: "a".repeat(64),
    confidence: 0.91,
    dataClass: "customer_private",
  } as const;
  const inference = captureProposalSchema.parse({ ...base, evidenceKind: "inference" });
  assert.deepEqual(evaluateCaptureProposalPolicy(inference), {
    mayAutoCommit: false,
    requiresHumanConfirmation: true,
    reason: "ai_inference_is_proposal_only",
  });
  const fact = captureProposalSchema.parse({ ...base, evidenceKind: "fact" });
  assert.equal(evaluateCaptureProposalPolicy(fact).mayAutoCommit, false);
});

test("Historical insight windows support rolling, YTD, all and comparisons", () => {
  const nowIso = "2026-09-24T04:00:00.000Z";
  const p90 = resolveInsightWindow({ period: "90d", nowIso });
  assert.equal(p90.end, nowIso);
  assert.equal(Date.parse(p90.end) - Date.parse(p90.start!), 90 * 86_400_000);

  const ytd = resolveInsightWindow({ period: "ytd", nowIso });
  assert.equal(ytd.start, "2025-12-31T17:00:00.000Z");

  const all = resolveInsightWindow({ period: "all", nowIso });
  assert.equal(all.start, null);
  assert.equal(resolveComparisonWindow({ primary: all, comparison: "previous_period" }), null);

  const previous = resolveComparisonWindow({ primary: p90, comparison: "previous_period" });
  assert.ok(previous?.start);
  assert.equal(Date.parse(previous!.end) - Date.parse(previous!.start!), 90 * 86_400_000);
  assert.equal(previous!.end, p90.start);
});

test("VPS scheduling keeps Local AI concurrency one and detects heavy collisions", () => {
  assert.equal(LOCAL_AI_MAX_CONCURRENCY, 1);
  assert.equal(isInsideRecommendedHeavyWindow(3 * 60 + 30, 60), true);
  assert.equal(isInsideRecommendedHeavyWindow(5 * 60, 60), false);

  const collisions = detectHeavyWorkloadCollisions([
    { key: "local-ai.seo", workloadClass: "batch", startMinuteBkk: 210, durationMinutes: 60, heavy: true },
    { key: "social.backfill", workloadClass: "batch", startMinuteBkk: 240, durationMinutes: 60, heavy: true },
    { key: "calendar.sync", workloadClass: "routine", startMinuteBkk: 240, durationMinutes: 5, heavy: false },
  ]);
  assert.deepEqual(collisions, [{ left: "local-ai.seo", right: "social.backfill" }]);
});

test("Cloud routing never accepts raw conversation or secrets", () => {
  assert.deepEqual(
    evaluateCloudEligibility({
      dataClass: "raw_conversation",
      sanitized: true,
      allowlisted: true,
      explicitWorkflowOptIn: true,
    }),
    { allowed: false, reason: "raw_conversation_prohibited" },
  );
  assert.equal(
    evaluateCloudEligibility({
      dataClass: "health_sensitive",
      sanitized: true,
      allowlisted: true,
      explicitWorkflowOptIn: true,
    }).allowed,
    true,
  );
  assert.equal(
    evaluateCloudEligibility({
      dataClass: "health_sensitive",
      sanitized: true,
      allowlisted: true,
      explicitWorkflowOptIn: false,
    }).allowed,
    false,
  );
});

test("Cloud payload is allowlist-first and rejects direct identifiers", () => {
  assert.equal(
    cloudPayloadUsesOnlyAllowedKeys(
      { topic: "health_coverage", count: 28, qualified_rate: 0.4 },
      ["topic", "count", "qualified_rate"],
    ),
    true,
  );
  assert.equal(
    cloudPayloadUsesOnlyAllowedKeys(
      { topic: "health_coverage", email: "person@example.com" },
      ["topic", "email"],
    ),
    false,
  );
});
