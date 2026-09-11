import assert from "node:assert/strict";
import test from "node:test";
import {
  articleScheduleBlock,
  articleScheduleDocumentId,
  bangkokLocalDateTimeToIso,
  getScheduleDelaySeconds,
} from "../../cms/sanity/policy/article-scheduling";
import type { PublishableArticle } from "../../cms/sanity/policy/article-publication";
import { hasAdminPermission } from "../../lib/admin/rbac";

const draft: PublishableArticle = {
  _id: "drafts.article-1",
  _type: "article",
  _rev: "draft-rev-1",
  _createdAt: "2026-09-01T00:00:00Z",
  _updatedAt: "2026-09-01T00:00:00Z",
  review: { status: "approved" },
  slug: { current: "article-1" },
  category: { _ref: "category-1" },
};

const published: PublishableArticle = {
  ...draft,
  _id: "article-1",
  _rev: "live-rev-1",
  publishedAt: "2026-08-01T00:00:00Z",
};

const now = Date.parse("2026-09-11T12:00:00.000Z");

test("Bangkok local schedule input is converted explicitly to UTC", () => {
  assert.equal(bangkokLocalDateTimeToIso("2026-09-12T07:30"), "2026-09-12T00:30:00.000Z");
  assert.equal(bangkokLocalDateTimeToIso("2026-02-31T07:30"), null);
  assert.equal(bangkokLocalDateTimeToIso("2026-09-12 07:30"), null);
});

test("schedule validation reuses publish approval, URL and reference guards", () => {
  const target = "2026-09-12T00:30:00.000Z";
  assert.equal(articleScheduleBlock(draft, null, target, now), null);
  assert.ok(articleScheduleBlock({ ...draft, review: { status: "drafting" } }, null, target, now));
  assert.ok(articleScheduleBlock({ ...draft, slug: { current: "changed" } }, published, target, now));
  assert.ok(articleScheduleBlock({ ...draft, author: { _type: "reference", _ref: "drafts.author" } } as PublishableArticle, null, target, now));
  assert.match(String(articleScheduleBlock(draft, null, "2026-09-11T12:00:10.000Z", now)), /30 วินาที/);
});

test("schedule identifiers are private deterministic draft IDs", () => {
  const id = articleScheduleDocumentId("drafts.article-1");
  assert.match(id, /^drafts\.publishSchedule\.[a-f0-9]{32}$/);
  assert.equal(id, articleScheduleDocumentId("article-1"));
  assert.notEqual(id, articleScheduleDocumentId("article-2"));
});

test("workflow delay is clamped and invalid timestamps fail closed", () => {
  assert.equal(getScheduleDelaySeconds("2026-09-11T12:01:00.000Z", now), 60);
  assert.equal(getScheduleDelaySeconds("2026-09-11T11:59:00.000Z", now), 0);
  assert.equal(getScheduleDelaySeconds("not-a-date", now), null);
});

test("only the owner role receives the scheduling permission", () => {
  assert.equal(hasAdminPermission("owner", "content:schedule"), true);
  for (const role of ["editor", "seo-manager", "reviewer", "analyst", "viewer"] as const) {
    assert.equal(hasAdminPermission(role, "content:schedule"), false, role);
  }
});

test("scheduling implementation locks draft revision and fails stale revisions closed", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../../lib/admin/article-scheduling.ts", import.meta.url), "utf8"),
  );
  assert.match(source, /draftRevision: draft\._rev/);
  assert.match(source, /draft\._rev !== schedule\.draftRevision/);
  assert.match(source, /status: "stale"/);
  assert.match(source, /articlePublishBlock\(draft, published, Date\.now\(\)\)/);
  assert.match(source, /publishApprovedArticle/);
});
