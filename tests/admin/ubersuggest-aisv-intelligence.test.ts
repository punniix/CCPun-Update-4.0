import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  aisvSnapshotImportSchema,
  deriveAisvReadState,
  matchReviewedIntentOwner,
} from "../../lib/admin/seo-intelligence/aisv";

function readySnapshot() {
  return {
    source: "ubersuggest-aisv" as const,
    sourceRuntime: "chatgpt-ubersuggest-connector" as const,
    fetchedAt: "2026-09-24T16:30:00.000Z",
    reportStatus: "ready" as const,
    reportWindow: { start: "2026-08-26", end: "2026-09-24" },
    providerFreshness: { promptsUpdatedAt: "2026-09-21", answerCollectedAt: null },
    account: {
      tier: "tier1",
      domain: "ccpun.com" as const,
      projectId: "fixture-project",
      projectUpdateFrequency: "WEEKLY",
      brandUpdateFrequency: "MONTHLY",
      quotas: [],
    },
    geo: {
      domain: "ccpun.com" as const,
      projectId: "fixture-project",
      visibilityPercentage: 0,
      totalMentions: 0,
      shareOfVoice: 0,
      averageRank: null,
      totalAnswers: 20,
      totalPrompts: 10,
      totalCompetitors: 25,
      providers: [
        { provider: "openai", averageRank: null, totalMentions: 0, visibilityPercentage: 0 },
        { provider: "gemini", averageRank: null, totalMentions: 0, visibilityPercentage: 0 },
      ],
      competitors: [],
      intents: [],
      prompts: [{
        promptText: "ประกันโรคร้ายแรง คืออะไร",
        topic: "critical illness",
        language: "th",
        locId: null,
        intents: ["informational"],
        totalAnswers: 2,
        userAverageRank: null,
        userTotalMentions: 0,
        userVisibilityPercentage: 0,
        topBrands: [],
      }],
    },
    limitations: ["Provider does not expose the exact AI answer collection timestamp."],
  };
}

test("AISV import preserves measured zero instead of treating it as missing", () => {
  const parsed = aisvSnapshotImportSchema.parse(readySnapshot());
  assert.equal(parsed.geo?.visibilityPercentage, 0);
  assert.equal(parsed.geo?.totalMentions, 0);
  assert.equal(parsed.geo?.prompts[0]?.userVisibilityPercentage, 0);

  const missingReady = readySnapshot();
  missingReady.geo.visibilityPercentage = null as unknown as number;
  assert.equal(aisvSnapshotImportSchema.safeParse(missingReady).success, false);

  const partial = readySnapshot();
  partial.reportStatus = "partial" as "ready";
  partial.geo.visibilityPercentage = null as unknown as number;
  assert.equal(aisvSnapshotImportSchema.safeParse(partial).success, true);
});

test("AISV input is bounded and rejects credential-shaped extra fields", () => {
  const payload = readySnapshot() as ReturnType<typeof readySnapshot> & { accessToken?: string };
  payload.accessToken = "must-not-be-accepted";
  assert.equal(aisvSnapshotImportSchema.safeParse(payload).success, false);

  const tooMany = readySnapshot();
  tooMany.geo.prompts = Array.from({ length: 26 }, (_, index) => ({
    ...tooMany.geo.prompts[0],
    promptText: "prompt " + index,
  }));
  assert.equal(aisvSnapshotImportSchema.safeParse(tooMany).success, false);
});

test("AISV presentation states distinguish ready stale pending missing and provider failures", () => {
  const now = Date.parse("2026-09-24T12:00:00Z");
  assert.equal(deriveAisvReadState({ error: null, snapshot: { reportStatus: "ready", windowEnd: "2026-09-24" }, now }), "ready");
  assert.equal(deriveAisvReadState({ error: null, snapshot: { reportStatus: "ready", windowEnd: "2026-07-01" }, now }), "stale");
  assert.equal(deriveAisvReadState({ error: null, snapshot: { reportStatus: "pending_update", windowEnd: "2026-09-24" }, now }), "pending_update");
  assert.equal(deriveAisvReadState({ error: null, snapshot: null, now }), "missing");
  assert.equal(deriveAisvReadState({ error: "not-configured", snapshot: null, now }), "not-configured");
  assert.equal(deriveAisvReadState({ error: "request-failed", snapshot: null, now }), "unavailable");
});

test("AISV intent-owner matching is exact and never infers a broad-topic owner", () => {
  assert.equal(
    matchReviewedIntentOwner("ประกันโรคร้ายแรงต่างจากประกันสุขภาพอย่างไร")?.ownerUrl,
    "https://ccpun.com/blog/critical-illness-insurance/what-is-critical-illness-insurance/",
  );
  assert.equal(
    matchReviewedIntentOwner("เปรียบเทียบประกันโรคร้ายแรงกับประกันสุขภาพแบบไหนดีกว่า"),
    null,
  );
  assert.equal(
    matchReviewedIntentOwner("AIA Health CI Hero คืออะไร")?.ownerUrl,
    "https://ccpun.com/blog/health-insurance/aia-health-ci-hero-guide/",
  );
});

test("AISV reviewed import is human-only same-origin UAT-only and separate from provider OAuth", () => {
  const route = readFileSync("app/api/admin/providers/ubersuggest/sync/route.ts", "utf8");
  const page = readFileSync("features/admin/research/page.tsx", "utf8");
  const provider = readFileSync("lib/admin/ubersuggest.ts", "utf8");

  assert.match(route, /identity\.actorType !== "human"/);
  assert.match(route, /research:provider-query/);
  assert.match(route, /isConfiguredAdminOrigin/);
  assert.match(route, /isSameOriginAdminMutation/);
  assert.match(route, /environment === "admin-uat" \|\| environment === "local-uat"/);
  assert.match(route, /aisvSnapshotImportSchema/);
  assert.match(page, /ยังไม่ได้จับคู่กับ Intent Owner Registry/);
  assert.match(page, /provider ส่ง 0% จริง/);
  assert.match(page, /UbersuggestAisvImportForm/);
  assert.match(provider, /\["development", "local-uat", "local-production"\]/);
  assert.doesNotMatch(provider, /admin-uat[^\n]*providerLaneAllowed/);
});
