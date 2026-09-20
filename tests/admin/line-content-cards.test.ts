import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildLineArticleFlexMessage,
  buildLineArticleUrl,
  selectLineDiscoveryArticles,
  type LineArticleCardSource,
} from "../../lib/line/content-cards";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

function article(
  slug: string,
  category: string,
  categorySlug: string,
  options: Partial<LineArticleCardSource> = {},
): LineArticleCardSource {
  return {
    slug,
    title: `บทความ ${slug}`,
    excerpt: `คำอธิบาย ${slug}`,
    category,
    categorySlug,
    status: "published",
    noindex: false,
    featuredImage: {
      src: "https://cdn.sanity.io/images/test/article.png",
      alt: "ภาพบทความ",
      width: 1200,
      height: 630,
    },
    ...options,
  };
}

test("Life discovery reuses approved published articles in configured order", () => {
  const rows = [
    article("aia-senior-happy", "ประกันชีวิต", "life-insurance"),
    article("critical-illness-insurance", "ประกันโรคร้ายแรง", "critical-illness-insurance"),
    article("aia-health-ci-hero-guide", "ประกันสุขภาพ", "health-insurance"),
    article("financial-pyramid", "การเงินส่วนบุคคล", "personal-finance"),
  ];
  assert.deepEqual(
    selectLineDiscoveryArticles("life_health_policy_review", rows).map((item) => item.slug),
    ["critical-illness-insurance", "aia-health-ci-hero-guide", "aia-senior-happy"],
  );
});

test("Discovery excludes drafts and noindex content instead of filling with unapproved articles", () => {
  const rows = [
    article("car-insurance-types", "ประกันรถยนต์", "motor-insurance", { status: "draft" }),
    article("financial-pyramid", "การเงินส่วนบุคคล", "personal-finance", { noindex: true }),
  ];
  assert.equal(selectLineDiscoveryArticles("motor_quote_review", rows).length, 0);
  assert.equal(selectLineDiscoveryArticles("investment_before_you_act", rows).length, 0);
});

test("Motor and Investment use the currently available published bridge content", () => {
  const rows = [
    article("car-insurance-types", "ประกันรถยนต์", "motor-insurance"),
    article("financial-pyramid", "การเงินส่วนบุคคล", "personal-finance"),
  ];
  assert.deepEqual(
    selectLineDiscoveryArticles("motor_quote_review", rows).map((item) => item.slug),
    ["car-insurance-types"],
  );
  assert.deepEqual(
    selectLineDiscoveryArticles("investment_before_you_act", rows).map((item) => item.slug),
    ["financial-pyramid"],
  );
});

test("Article card links carry safe LINE attribution and no customer identifiers", () => {
  const row = article("car-insurance-types", "ประกันรถยนต์", "motor-insurance");
  const url = new URL(buildLineArticleUrl(row, "motor_quote_review"));
  assert.equal(url.origin, "https://ccpun.com");
  assert.match(url.pathname, /car-insurance-types/);
  assert.equal(url.searchParams.get("utm_source"), "line");
  assert.equal(url.searchParams.get("utm_medium"), "flex_message");
  assert.equal(url.searchParams.get("utm_campaign"), "rich_menu_v3_motor");
  assert.equal(url.searchParams.get("utm_content"), "car-insurance-types");
  assert.equal(url.searchParams.has("line_user_id"), false);
  assert.equal(url.searchParams.has("lead_id"), false);
  assert.equal(url.searchParams.has("customer_id"), false);
});

test("Flex builder creates article bubbles only from selected published content", () => {
  const rows = [
    article("car-insurance-types", "ประกันรถยนต์", "motor-insurance"),
    article("financial-pyramid", "การเงินส่วนบุคคล", "personal-finance"),
  ];
  const message = buildLineArticleFlexMessage("motor_quote_review", rows);
  assert.ok(message);
  assert.equal(message?.type, "flex");
  assert.equal(message?.contents.type, "carousel");
  assert.equal(message?.contents.contents.length, 1);
  const serialized = JSON.stringify(message);
  assert.match(serialized, /อ่านต่อบน CCPun/);
  assert.match(serialized, /"aspectRatio":"1\.91:1"/);
  assert.match(serialized, /utm_medium=flex_message/);
  assert.doesNotMatch(serialized, /line_user_id|lead_id|customer_id/);
});

test("Published card runtime is read-only Sanity and never requests drafts", () => {
  const source = read("lib/admin/line/content-cards.ts");
  assert.match(source, /listArticles\(\{ includeDrafts: false \}\)/);
  assert.doesNotMatch(source, /includeDrafts:\s*true/);
});

test("Admin card preview is authenticated read-only and performs no provider write", () => {
  const source = read("apps/admin/app/api/admin/line/content-cards/preview/route.ts");
  assert.match(source, /getAdminIdentity/);
  assert.match(source, /settings:read/);
  assert.match(source, /readPublishedLineDiscoveryArticles/);
  assert.match(source, /buildPublishedLineArticleFlexMessage/);
  assert.doesNotMatch(source, /CCPUN_LINE_CHANNEL_ACCESS_TOKEN|message\/push|message\/reply|fetch\("https:\/\/api\.line\.me/);
});
