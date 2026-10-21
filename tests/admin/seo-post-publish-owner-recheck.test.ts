import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readPhase1Source } from "../../qa/read-phase1-source.mjs";
import { loadFixtureModule } from "../../qa/phase1-fixture-loader.mjs";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Production recheck is owner-only and operates on already-published article ID without CMS mutation", () => {
  const page = readPhase1Source("apps/admin/app/(control-plane)/seo/page.tsx");
  const button = read("../../features/admin/components/PostPublishOwnerRecheckButton.tsx");
  assert.match(page, /identity\.role === "owner"/);
  assert.match(page, /getAdminEnvironment\(\) === "production-admin"/);
  assert.match(page, /CCPUN_SEO_POST_PUBLISH_QUEUE_ENABLED === "1"/);
  assert.match(page, /!article\.isDraft/);
  assert.match(page, /PostPublishOwnerRecheckButton articleId=\{article\.id\}/);
  assert.match(button, /confirming/);
  assert.match(button, /method: "POST"/);
  assert.match(button, /credentials: "same-origin"/);
  assert.match(button, /JSON\.stringify\(\{ articleId \}\)/);
  assert.match(button, /encodeURIComponent\(articleId\)/);
  assert.doesNotMatch(button, /publishApprovedArticle|client\.create|client\.patch|sanity\.mutate|gscSitemapSubmit/);
});

test("compiled Production page and real recheck button enforce every owner, lane, queue and publication gate", async () => {
  const button = loadFixtureModule("features/admin/components/PostPublishOwnerRecheckButton.tsx");
  for (const role of ["owner", "editor"]) for (const environment of ["production-admin", "admin-uat"]) {
    for (const enabled of [false, true]) for (const isDraft of [false, true]) {
      const reads: string[] = [];
      const mocks = new Map([
        ["@/lib/admin/require-permission", { requireAdminPermission: async (permission: string) => { reads.push(permission); return { role }; } }],
        ["@/lib/admin/environment", { getAdminEnvironment: () => environment, isStudioDataPlaneAllowed: () => true }],
        ["@/lib/admin/sanity-control", { listAdminArticles: async () => ({ rows: [{ id: "article-1", rawId: "article-1", title: "Article", slug: "article", isDraft, seoScore: null }], status: { dataset: "production", writeReady: true } }) }],
        ["@/lib/admin/seo-heuristics", { SEO_AUDIT_VERSION: "fixture" }],
        ["@/lib/admin/seo-intelligence/foundation", { getSeoIntelligenceRuntimeStatus: () => ({ enabled: false }) }],
        ["@/lib/admin/presentation", { datasetLabel: () => "production" }],
        ["@/features/admin/components/PostPublishOwnerRecheckButton", button],
      ]);
      const page = loadFixtureModule("apps/admin/app/(control-plane)/seo/page.tsx", {
        mocks, globals: { process: { env: { CCPUN_SEO_POST_PUBLISH_QUEUE_ENABLED: enabled ? "1" : "0" } } },
      });
      const html = renderToStaticMarkup(await page.default());
      const expected = role === "owner" && environment === "production-admin" && enabled && !isDraft;
      assert.equal(html.includes("ตรวจ Post-Publish อีกครั้ง"), expected, JSON.stringify({ role, environment, enabled, isDraft }));
      assert.equal(html.includes("สถานะคิว"), expected);
      assert.deepEqual(reads, ["seo:read"]);
    }
  }
});


test("compiled confirmation button retains its dark text color without adding a public CSS utility", () => {
  for (const working of [false, true]) {
    const states: unknown[] = [true, working, ""];
    const button = loadFixtureModule("features/admin/components/PostPublishOwnerRecheckButton.tsx", {
      mocks: new Map([["react", { ...React, useState: () => [states.shift(), () => {}] }]]),
    });
    const html = renderToStaticMarkup(button.default({ articleId: "article-1" }));
    const confirmation = html.match(/<button\b[^>]*>ยืนยันส่งตรวจ SEO<\/button>/)?.[0];
    assert.ok(confirmation);
    assert.match(confirmation, /style="color:#352727"/);
    assert.match(confirmation, /bg-\[#e0c985\]/);
    assert.match(confirmation, /disabled:opacity-40/);
    assert.doesNotMatch(confirmation, /text-\[#352727\]/);
    assert.equal(confirmation.includes('disabled=""'), working);
    assert.equal(states.length, 0);
  }
});
