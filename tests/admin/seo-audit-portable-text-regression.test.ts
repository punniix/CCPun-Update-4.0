import assert from "node:assert/strict";
import test from "node:test";
import { parseSeoAuditArticle } from "../../lib/admin/seo-audit";

test("SEO audit parser normalizes legacy null Portable Text markDefs", () => {
  const parsed = parseSeoAuditArticle({
    id: "drafts.ccpun-motor-car-insurance-types",
    revision: "fixture-revision",
    title: "Fixture",
    slug: "fixture",
    body: [
      {
        _type: "block",
        style: "normal",
        children: [{ _type: "span", text: "ข้อความทดสอบ", marks: null }],
        markDefs: null,
      },
    ],
    hasFeaturedImage: false,
    hasNativeFeaturedImage: false,
    usesMigratedFeaturedImage: false,
  });

  assert.deepEqual(parsed.body?.[0]?.markDefs, []);
});

test("SEO audit parser preserves real mark definitions", () => {
  const parsed = parseSeoAuditArticle({
    id: "drafts.fixture",
    revision: "fixture-revision",
    body: [
      {
        _type: "block",
        children: [{ _type: "span", text: "link" }],
        markDefs: [{ _key: "link-1", _type: "link", href: "https://example.com" }],
      },
    ],
    hasFeaturedImage: false,
    hasNativeFeaturedImage: false,
    usesMigratedFeaturedImage: false,
  });

  assert.equal(parsed.body?.[0]?.markDefs?.[0]?.href, "https://example.com");
});
