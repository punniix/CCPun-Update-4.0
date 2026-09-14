import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildSocialDraftCreateDocument,
  planSocialDraftUpdate,
  socialDraftRequestSchema,
  socialDraftWorkspaceSchema,
} from "../../lib/admin/social/draft-contract";

const input = {
  masterContentId: "master-content-1",
  title: "Internal title",
  caption: "Caption",
  channel: "instagram" as const,
  format: "reel" as const,
  publishingMode: "native-finish" as const,
  mediaReferences: [{
    assetId: "media-1",
    role: "primary" as const,
    order: null,
    mimeType: "video/mp4" as const,
    widthPx: 1080,
    heightPx: 1920,
    durationMs: 15_000,
  }],
};

test("new social content is a Sanity Draft at version one and never approved", () => {
  const document = buildSocialDraftCreateDocument({ action: "create", ...input }, "fixture-id");
  assert.equal(document._id, "drafts.socialVariant-fixture-id");
  assert.equal(document._type, "socialVariant");
  assert.equal(document.version, 1);
  assert.deepEqual(document.review, { status: "drafting" });
  assert.equal(document.masterContent._ref, "master-content-1");
  assert.equal(document.linkUrl, null);
});

test("link posts require a distinct Facebook format and an explicit HTTPS URL", () => {
  const linkPost = {
    ...input,
    channel: "facebook" as const,
    format: "link-post" as const,
    publishingMode: "direct" as const,
    linkUrl: "https://www.ccpun.com/financial-planning",
  };
  const document = buildSocialDraftCreateDocument({ action: "create", ...linkPost }, "link-fixture");
  assert.equal(document.format, "link-post");
  assert.equal(document.linkUrl, linkPost.linkUrl);
  assert.equal(socialDraftRequestSchema.safeParse({ action: "create", ...linkPost, linkUrl: "http://example.com" }).success, false);
  assert.equal(socialDraftRequestSchema.safeParse({ action: "create", ...linkPost, channel: "instagram" }).success, false);
  assert.equal(socialDraftRequestSchema.safeParse({ action: "create", ...linkPost, format: "text-post" }).success, false);
  assert.equal(socialDraftRequestSchema.safeParse({ action: "create", ...linkPost, linkUrl: null, caption: "https://example.com/in-caption" }).success, false);
});

test("link-post authoring carries the explicit field end to end without caption parsing", () => {
  const schema = readFileSync(new URL("../../cms/sanity/schema/documents/social-variant.ts", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../../features/admin/social/SocialPostsWorkspace.tsx", import.meta.url), "utf8");
  const client = readFileSync(new URL("../../features/admin/social/social-workspace-client.ts", import.meta.url), "utf8");
  assert.match(schema, /"text-post", "link-post", "image-post"/);
  assert.match(schema, /name: "linkUrl"[\s\S]*protocol === "https:"/);
  assert.match(workspace, /linkUrl: form\.linkUrl\.trim\(\) \|\| null/);
  assert.match(workspace, /ระบบไม่อ่านลิงก์จากแคปชัน/);
  assert.match(client, /item\.format === "link-post" \? httpsLinkUrl\(item\.linkUrl\) : null/);
  assert.doesNotMatch(workspace, /new URL\(form\.caption|form\.caption\.match\(/);
});

test("Facebook Comment Series persists exact ordered text and rejects gaps or non-Facebook children", () => {
  const comments = [1, 2, 3, 4].map((position) => ({ position, text: `รายละเอียด ${position}` }));
  const request = {
    action: "create" as const,
    ...input,
    channel: "facebook" as const,
    format: "text-post" as const,
    publishingMode: "direct" as const,
    mediaReferences: [],
    commentSeriesMode: "threaded" as const,
    commentSeries: comments,
  };
  const document = buildSocialDraftCreateDocument(request, "comment-series-fixture");
  assert.equal(document.commentSeriesMode, "threaded");
  assert.deepEqual(document.commentSeries.map(({ position, text }) => ({ position, text })), comments);
  assert.equal(new Set(document.commentSeries.map((comment) => comment._key)).size, 4);
  assert.equal(socialDraftRequestSchema.safeParse({
    ...request,
    commentSeries: [{ position: 1, text: "หนึ่ง" }, { position: 3, text: "สาม" }],
  }).success, false);
  assert.equal(socialDraftRequestSchema.safeParse({ ...request, channel: "instagram" }).success, false);
});

test("editing an approved Draft is revision-bound, increments version and resets review", () => {
  const planned = planSocialDraftUpdate(
    { action: "update", variantId: "socialVariant-fixture-id", expectedRevision: "rev-2", ...input },
    { _id: "drafts.socialVariant-fixture-id", _rev: "rev-2", version: 4, review: { status: "approved", notes: "keep" } },
  );
  assert.equal(planned.expectedRevision, "rev-2");
  assert.equal(planned.set.version, 5);
  assert.deepEqual(planned.set.review, { status: "drafting", notes: "keep" });
  assert.throws(
    () => planSocialDraftUpdate(
      { action: "update", variantId: "socialVariant-fixture-id", expectedRevision: "stale", ...input },
      { _id: "drafts.socialVariant-fixture-id", _rev: "rev-2", version: 4, review: { status: "approved" } },
    ),
    /SOCIAL_DRAFT_REVISION_CONFLICT/,
  );
});

test("editing content during review always returns it to drafting", () => {
  const plan = planSocialDraftUpdate({
    action: "update",
    variantId: "socialVariant-existing",
    expectedRevision: "rev-current",
    ...input,
  }, {
    _id: "drafts.socialVariant-existing",
    _rev: "rev-current",
    version: 4,
    review: {
      status: "compliance-review",
      contentReviewedAt: "2026-09-01T01:00:00.000Z",
      factCheckedAt: "2026-09-01T02:00:00.000Z",
      notes: "retain this note",
    },
  });
  assert.deepEqual(plan.set.review, { status: "drafting", notes: "retain this note" });
});

test("channel modes are compatible and Sanity list responses are validated", () => {
  assert.equal(socialDraftRequestSchema.safeParse({ action: "create", ...input, publishingMode: "native-scheduled" }).success, false);
  assert.equal(socialDraftRequestSchema.safeParse({ action: "create", ...input, channel: "facebook", publishingMode: "native-finish" }).success, false);
  assert.equal(socialDraftWorkspaceSchema.safeParse({ drafts: [], masterContentChoices: [{ id: "master-1", title: "Title", summary: "" }] }).success, true);
  assert.equal(socialDraftWorkspaceSchema.safeParse({ drafts: "untrusted", masterContentChoices: [] }).success, false);
});

test("social Draft API stays owner-only, same-origin, runtime-gated and has no publish action", () => {
  const route = readFileSync(new URL("../../app/api/admin/social/drafts/route.ts", import.meta.url), "utf8");
  const store = readFileSync(new URL("../../lib/admin/social/drafts.ts", import.meta.url), "utf8");
  assert.match(route, /identity\.actorType !== "human" \|\| identity\.role !== "owner"/);
  assert.match(route, /isConfiguredAdminOrigin/);
  assert.match(route, /isSameOriginAdminMutation/);
  assert.match(store, /resolveSocialRuntime\(process\.env/);
  assert.match(store, /runtime\.sanityProjectId/);
  assert.match(store, /runtime\.sanityDataset/);
  assert.match(store, /SANITY_API_WRITE_TOKEN|SANITY_WRITE_TOKEN|getAdminSanityWriteToken/);
  assert.match(store, /\.ifRevisionId\(plan\.expectedRevision\)/);
  assert.match(store, /sanity\.create\(buildSocialDraftCreateDocument/);
  assert.match(store, /"linkUrl": coalesce\(linkUrl, null\)/);
  assert.match(store, /"commentSeries": coalesce\(commentSeries\[\] \| order\(position asc\)/);
  assert.doesNotMatch(store, /\.publish\(|createOrReplace|createIfNotExists|\.delete\(/);
});
