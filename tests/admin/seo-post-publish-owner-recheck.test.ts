import { readPhase1Source } from "../../qa/read-phase1-source.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const read = (path: string) => readPhase1Source(new URL(path, import.meta.url));

test("Production recheck is owner-only and operates on already-published article ID without CMS mutation", () => {
  const page = read("../../apps/admin/app/(control-plane)/seo/page.tsx");
  const button = read("../../features/admin/components/PostPublishOwnerRecheckButton.tsx");
  assert.match(page, /identity\.role === "owner"/);
  assert.match(page, /getAdminEnvironment\(\) === "production-admin"/);
  assert.match(page, /CCPUN_SEO_POST_PUBLISH_QUEUE_ENABLED === "1"/);
  assert.match(page, /!article\.isDraft/);
  assert.match(page, /render: \(articleId\) => <PostPublishOwnerRecheckButton articleId=\{articleId\}/);
  assert.match(page, /ownerRecheckReady && !article\.isDraft \? copy\.publishedOwnerRecheck\?\.render\(article\.id\)/);
  assert.match(button, /confirming/);
  assert.match(button, /method: "POST"/);
  assert.match(button, /credentials: "same-origin"/);
  assert.match(button, /JSON\.stringify\(\{ articleId \}\)/);
  assert.match(button, /encodeURIComponent\(articleId\)/);
  assert.doesNotMatch(button, /publishApprovedArticle|client\.create|client\.patch|sanity\.mutate|gscSitemapSubmit/);
});
