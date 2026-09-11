import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { executeArticleSchedule, matchesScheduledSnapshot, type ArticlePair } from "../../lib/admin/article-schedule-executor";
import { scheduleView, type ArticleScheduleRow, type ScheduleStatus } from "../../lib/admin/operations/article-schedule-contract";
import type { ScheduleStore } from "../../lib/admin/operations/article-schedule-store";

const now = Date.parse("2026-09-11T12:00:00Z");
function fixture(mode: "publish" | "validate-only" = "publish") {
  const article: ArticlePair = { draft: { _id: "drafts.article-1", _type: "article", _rev: "draft-1", _createdAt: "2026-01-01T00:00:00Z", _updatedAt: "2026-01-01T00:00:00Z",
    title: "Article", excerpt: "Excerpt", slug: { current: "article-1" }, category: { _ref: "category-1" }, author: { _type: "reference", _ref: "author-1" },
    body: [{ _type: "block", _key: "a", children: [{ _type: "span", text: "Unchanged content" }] }], seo: { description: "Description" }, review: { status: "approved" } }, published: null };
  const row: ArticleScheduleRow = { article_id: "article-1", generation: randomUUID(), row_version: 2, draft_revision: "draft-1", published_revision: null,
    scheduled_at: new Date(now - 60_000).toISOString(), timezone: "Asia/Bangkok", mode, status: "scheduled", created_by: "owner@example.test",
    workflow_run_id: "run-1", execution_id: null, lease_expires_at: null, created_at: new Date(now-120_000).toISOString(), updated_at: new Date(now).toISOString(), completed_at: null, error_code: null, transaction_id: null };
  const state = { owner: true, authorized: true, readFails: false, publishFails: false, checkpointFails: false, replyLost: false, calls: 0, claims: 0 };
  const store: ScheduleStore = {
    mode, enabled: true, read: async () => structuredClone(row), prepare: async () => null, acknowledge: async () => null, failDispatch: async () => {}, cancel: async () => null,
    claim: async (_id,generation,executionId) => {
      if (row.status !== "scheduled" || row.generation !== generation) return null;
      row.status = "executing"; row.execution_id = executionId; row.lease_expires_at = new Date(now+120_000).toISOString(); row.row_version++; state.claims++;
      return structuredClone(row);
    },
    authorize: async () => state.authorized,
    finish: async (_claim,status,errorCode,transactionId) => {
      if (state.checkpointFails && status === "published") throw new Error("connection lost");
      if (row.status !== "executing") throw new Error("CAS failed");
      row.status = status; row.row_version++; row.error_code = errorCode ?? null; row.transaction_id = transactionId ?? null;
      if (state.replyLost && status === "published") throw new Error("reply lost after commit");
    },
  };
  const run = () => executeArticleSchedule({ store, now: () => now, ownerAllowed: () => state.owner,
    readArticle: async () => { if (state.readFails) throw new Error("read failure"); return structuredClone(article); },
    publish: async () => { state.calls++; if (state.publishFails) throw new Error("reply lost during external mutation"); return { transactionId: "transaction-1" }; },
  }, { articleId: row.article_id, generation: row.generation });
  return { row, article, store, state, run };
}

test("a late due job publishes the exact approved content once with a transaction receipt", async () => {
  const f = fixture(); const before = structuredClone(f.article);
  assert.equal((await f.run()).status, "published"); assert.equal(f.row.transaction_id, "transaction-1");
  assert.deepEqual(f.article, before); assert.equal(f.state.calls, 1);
  assert.equal((await f.run()).status, "ignored"); assert.equal(f.state.calls, 1);
});
test("UAT validates but never calls a Sanity publication mutation", async () => {
  const f = fixture("validate-only"); assert.equal((await f.run()).status, "validated"); assert.equal(f.state.calls, 0);
});
test("concurrent worker delivery can acquire only one execution identity", async () => {
  const f = fixture(); const results = await Promise.all([f.run(),f.run(),f.run()]);
  assert.equal(results.filter((r) => r.status === "published").length, 1); assert.equal(f.state.claims, 1); assert.equal(f.state.calls, 1);
});
test("preparing, cancelled, completed and not-yet-due rows do not publish", async () => {
  for (const status of ["preparing","cancelled","published","validated","stale","failed","executing","reconciliation-required"] as ScheduleStatus[]) {
    const f = fixture(); f.row.status = status; await f.run(); assert.equal(f.state.calls, 0, status);
  }
  const f = fixture(); f.row.scheduled_at = new Date(now+1).toISOString(); assert.equal((await f.run()).status,"not-due"); assert.equal(f.state.claims,0);
});
test("changed or missing Draft and changed published base fail closed instead of inferring success", async () => {
  for (const change of ["draft","published","missing"] as const) {
    const f = fixture();
    if (change === "draft") f.article.draft!._rev = "changed";
    if (change === "published" || change === "missing") f.article.published = { ...f.article.draft!, _id: "article-1", _rev: "live-changed", publishedAt: "2026-01-01T00:00:00Z" };
    if (change === "missing") f.article.draft = null;
    assert.equal((await f.run()).status, "stale", change); assert.equal(f.state.calls, 0);
  }
});
test("revoked owner, disabled execution, validation failure and read failure never publish", async () => {
  for (const change of ["owner","execution","review","read","mode"] as const) {
    const f = fixture();
    if (change === "owner") f.state.owner = false;
    if (change === "execution") f.state.authorized = false;
    if (change === "review") f.article.draft!.review = { status: "drafting" };
    if (change === "read") f.state.readFails = true;
    if (change === "mode") f.row.mode = "validate-only";
    assert.equal((await f.run()).status, "failed", change); assert.equal(f.state.calls,0);
  }
  const f = fixture(); f.store.enabled = false; await f.run(); assert.equal(f.state.claims,0);
});
test("uncertain external commit and failed Neon checkpoint require reconciliation without a second publication", async () => {
  for (const failure of ["publishFails","checkpointFails"] as const) {
    const f = fixture(); f.state[failure] = true;
    assert.equal((await f.run()).status,"reconciliation-required"); await f.run(); assert.equal(f.state.calls,1);
  }
});
test("a lost reply after a persisted success never causes another external write", async () => {
  const f = fixture(); f.state.replyLost = true; await assert.rejects(f.run(), /outcome-unknown/);
  assert.equal(f.row.status,"published"); assert.equal(f.row.transaction_id,"transaction-1"); await f.run(); assert.equal(f.state.calls,1);
});
test("expired execution is presented as unknown without mutating state or exposing private fields", () => {
  const f = fixture(); f.row.status="executing"; f.row.lease_expires_at=new Date(now-1).toISOString();
  const view=scheduleView(f.row,now)!; assert.equal(view.status,"reconciliation-required"); assert.equal(f.row.status,"executing");
  for(const key of ["created_by","workflow_run_id","execution_id","draft_revision"]) assert.equal(key in view,false);
});
test("idempotent retries require all frozen snapshot values to match", () => {
  const f=fixture(); const input={generation:f.row.generation,draftRevision:f.row.draft_revision,publishedRevision:null,scheduledAt:f.row.scheduled_at,actor:f.row.created_by};
  assert.equal(matchesScheduledSnapshot(f.row,input),true);
  assert.equal(matchesScheduledSnapshot(f.row,{...input,draftRevision:"new"}),false);
  assert.equal(matchesScheduledSnapshot(f.row,{...input,actor:"another-owner@example.test"}),false);
});
