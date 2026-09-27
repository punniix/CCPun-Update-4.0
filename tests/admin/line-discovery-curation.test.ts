import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  selectLineDiscoveryArticles,
  type LineArticleCardSource,
} from "../../lib/line/content-cards";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

function article(slug: string): LineArticleCardSource {
  return {
    slug,
    title: "บทความ " + slug,
    excerpt: "คำอธิบาย " + slug,
    category: "ทดสอบ",
    categorySlug: "test",
    status: "published",
    noindex: false,
    featuredImage: undefined,
  };
}

test("runtime curation controls order, active state and max cards without changing content source", () => {
  const rows = [article("a"), article("b"), article("c"), article("d")];
  const selected = selectLineDiscoveryArticles(
    "life_health_policy_review",
    rows,
    {
      maxCards: 2,
      items: [
        { slug: "c", enabled: true },
        { slug: "a", enabled: false },
        { slug: "d", enabled: true },
        { slug: "b", enabled: true },
      ],
    },
  );
  assert.deepEqual(selected.map((item) => item.slug), ["c", "d"]);
});

test("runtime curation still excludes noindex and non-published articles", () => {
  const rows = [
    article("a"),
    article("b"),
    article("c"),
  ];
  rows[1] = { ...rows[1], noindex: true };
  rows[2] = { ...rows[2], status: "draft" };

  const selected = selectLineDiscoveryArticles(
    "motor_quote_review",
    rows,
    {
      maxCards: 5,
      items: [
        { slug: "b", enabled: true },
        { slug: "c", enabled: true },
        { slug: "a", enabled: true },
      ],
    },
  );
  assert.deepEqual(selected.map((item) => item.slug), ["a"]);
});

test("Sanity curation is lane-guarded, published-only and revision-protected", () => {
  const source = read("lib/admin/line/discovery-config.ts");
  assert.match(source, /isAdminReadDataPlaneAllowed/);
  assert.match(source, /isAdminDataPlaneAllowed/);
  assert.match(source, /perspective: "published"/);
  assert.match(source, /coalesce\(seo\.noindex, false\) != true/);
  assert.match(source, /LINE_DISCOVERY_ARTICLE_NOT_PUBLISHED/);
  assert.match(source, /ifRevisionId\(current\._rev\)/);
  assert.match(source, /LINE_DISCOVERY_STALE/);
  assert.doesNotMatch(source, /includeDrafts:\s*true|perspective:\s*"drafts"/);
});

test("Admin mutation endpoint is owner-only, same-origin and bounded", () => {
  const route = read("apps/admin/app/api/admin/line/discovery/route.ts");
  assert.match(route, /identity\.role !== "owner"/);
  assert.match(route, /settings:read/);
  assert.match(route, /isSameOriginAdminMutation/);
  assert.match(route, /payload-too-large/);
  assert.match(route, /stale-revision/);
  assert.match(route, /article-not-published/);
  assert.doesNotMatch(route, /CCPUN_LINE_CHANNEL_ACCESS_TOKEN|line_user_id|customer_id|console\./i);
});

test("Admin curation UI supports desktop drag and mobile-accessible reorder controls", () => {
  const source = read("features/admin/line/LineDiscoveryManager.tsx");
  assert.match(source, /draggable/);
  assert.match(source, /onDragStart/);
  assert.match(source, /↑ ขึ้น/);
  assert.match(source, /↓ ลง/);
  assert.match(source, /เปิดใช้/);
  assert.match(source, /แสดงสูงสุด/);
  assert.match(source, /บันทึกแล้ว · LINE จะใช้ลำดับนี้กับการกดครั้งถัดไป/);
  assert.match(source, /ตัวอย่างนี้ใช้ข้อมูลเดียวกับการ์ดบทความจริง/);
});

test("Integrations owns the curation surface and Sanity schema is registered", () => {
  const settings = read("apps/admin/app/(control-plane)/settings/[section]/page.tsx");
  const schema = read("cms/sanity/schema/index.ts");
  assert.match(settings, /LineDiscoveryManager/);
  assert.match(settings, /readLineDiscoveryAdminModel/);
  assert.match(schema, /lineDiscoveryConfig/);
});
