import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import * as contracts from "../../lib/local-ai/contracts";

const require = createRequire(import.meta.url);
const id = "018f2f2b-90ac-7a21-bd5a-252727b10d4b";
const sentinel = "synthetic-private-do-not-export";
const content = {
  category: "health-insurance", tags: ["health"], slugSuggestion: "health-planning",
  excerpt: "สรุปเนื้อหาสาธารณะ", faqCandidates: [], reviewRequired: true,
};
const seo = { clusters: [{ label: "ประกันสุขภาพ", intent: "informational", queries: ["ประกันสุขภาพ"], ownerCandidate: "/blog/health/", reviewRequired: true }] };
const initial = {
  id, taskType: "content-operations", dataClass: "public-safe", status: "succeeded",
  reviewStatus: "approved", output: content, errorCategory: sentinel, updatedAt: "2026-10-14T00:00:00Z",
};

test("actual review GET exports only validated approved public content/SEO output", async () => {
  let authorized = true;
  let row: unknown = initial;
  let failure = false;
  let calls = 0;
  const reads: string[] = [];
  const source = readFileSync(path.resolve(import.meta.dirname, "../../apps/admin/app/api/internal/local-ai/reviews/route.ts"), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} as { GET: (request: Request) => Promise<Response> } };
  const dependencies = (name: string) => {
    if (name === "@/lib/admin/local-ai/database") return { readLocalAiJob: async (value: string) => {
      reads.push(value);
      if (failure) throw new Error(sentinel);
      return row;
    } };
    if (name === "@/lib/admin/local-ai/service-auth") return { isN8nLocalAiRequestAuthorized: () => authorized };
    if (name === "@/lib/local-ai/contracts") return contracts;
    if (name === "next/server" || name === "zod") return require(name);
    throw new Error(`unexpected route dependency: ${name}`);
  };
  new Function("require", "module", "exports", code)(dependencies, loaded, loaded.exports);

  const call = async (expected: number, query = id) => {
    calls += 1;
    const response = await loaded.exports.GET(new Request(`https://admin-test.example/api/internal/local-ai/reviews/?jobId=${encodeURIComponent(query)}`));
    assert.equal(response.status, expected);
    assert.equal(response.headers.get("cache-control"), "private, no-cache, no-store");
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    const body = await response.json();
    assert.doesNotMatch(JSON.stringify(body), new RegExp(sentinel));
    return { response, body };
  };

  authorized = false;
  await call(401);
  assert.equal(reads.length, 0);
  authorized = true;
  for (const invalid of ["", "not-a-uuid", ` ${id}`, `${id}/private`]) await call(404, invalid);
  assert.equal(reads.length, 0, "invalid IDs cannot reach the database");

  row = null;
  await call(404);
  for (const reviewStatus of [null, ...contracts.LOCAL_AI_REVIEW_STATUSES]) {
    for (const taskType of contracts.LOCAL_AI_TASK_TYPES) {
      row = { ...initial, taskType, reviewStatus, dataClass: "customer-private", output: { text: sentinel } };
      await call(404);
    }
  }
  for (const taskType of ["privacy-redaction", "line-intent", "analytics-review", "marketing-analysis", "constructor"]) {
    row = { ...initial, taskType, output: { text: sentinel } };
    await call(404);
  }

  for (const fields of [
    { id: "invalid" }, { id: "018f2f2b-90ac-7a21-bd5a-252727b10d4c" },
    { status: "constructor" }, { reviewStatus: "constructor" }, { reviewStatus: undefined },
    { output: null }, { output: { ...content, privateText: sentinel } },
    { output: { ...content, faqCandidates: [{ question: "test", answerDraft: "test", secret: sentinel }] } },
    { taskType: "seo-preprocessing", output: { ...seo, privateText: sentinel } },
  ]) {
    row = { ...initial, ...fields };
    const { response, body } = await call(503);
    assert.deepEqual(body, { error: "local-ai-unavailable", retryable: true });
    assert.equal(response.headers.get("retry-after"), "30");
  }

  for (const [taskType, output] of [["content-operations", content], ["seo-preprocessing", seo]]) {
    row = { ...initial, id: id.toUpperCase(), taskType, output };
    const { body } = await call(200, id.toUpperCase());
    assert.equal(reads.at(-1), id);
    assert.equal(body.jobId, id);
    assert.deepEqual(body.output, output);
    assert.equal(body.errorCategory, null);
  }

  for (const status of contracts.LOCAL_AI_JOB_STATUSES) {
    for (const reviewStatus of [null, ...contracts.LOCAL_AI_REVIEW_STATUSES]) {
      if (status === "succeeded" && reviewStatus === "approved") continue;
      row = { ...initial, status, reviewStatus, output: { privateText: sentinel } };
      const { response, body } = await call(200);
      assert.equal(body.output, null);
      const waiting = status === "succeeded" && reviewStatus === "pending";
      assert.equal(body.status, waiting ? "awaiting-review" : status);
      assert.equal(response.headers.get("retry-after"), status === "queued" || status === "leased" || waiting ? "3" : null);
      assert.equal(body.errorCategory, status === "failed" || status === "reconciliation-required" ? "local-ai-job-failed" : null);
    }
  }
  failure = true;
  assert.deepEqual((await call(503)).body, { error: "local-ai-unavailable", retryable: true });
  assert.equal(calls, 70);
});
