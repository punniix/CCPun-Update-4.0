import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVE_ARTICLE_CATEGORIES, isReservedArticleSlug, normalizeArticleTaxonomy } from "../../lib/content/taxonomy";

test("taxonomy exposes exactly five primary URL-bearing categories", () => {
  assert.deepEqual(ACTIVE_ARTICLE_CATEGORIES, [
    { slug: "personal-finance", title: "การเงินส่วนบุคคล" },
    { slug: "life-insurance", title: "ประกันชีวิต" },
    { slug: "health-insurance", title: "ประกันสุขภาพ" },
    { slug: "critical-illness-insurance", title: "ประกันโรคร้ายแรง" },
    { slug: "investment", title: "การลงทุน" },
  ]);
});

test("active category slugs and titles normalize to their physical URL owner", () => {
  assert.deepEqual(normalizeArticleTaxonomy({ categorySlug: "personal-finance" }), {
    categorySlug: "personal-finance",
    tags: [],
  });
  assert.deepEqual(normalizeArticleTaxonomy({ categoryTitle: "ประกันชีวิต" }), {
    categorySlug: "life-insurance",
    tags: [],
  });
  assert.deepEqual(normalizeArticleTaxonomy({ categorySlug: "health-insurance" }), {
    categorySlug: "health-insurance",
    tags: ["ประกันสุขภาพ"],
  });
  assert.deepEqual(normalizeArticleTaxonomy({ categoryTitle: "ประกันสุขภาพ" }), {
    categorySlug: "health-insurance",
    tags: ["ประกันสุขภาพ"],
  });
  assert.deepEqual(normalizeArticleTaxonomy({ categoryTitle: "ประกันโรคร้ายแรง" }), {
    categorySlug: "critical-illness-insurance",
    tags: ["ประกันโรคร้ายแรง"],
  });
  assert.deepEqual(normalizeArticleTaxonomy({ categorySlug: "critical-illness" }), {
    categorySlug: "critical-illness-insurance",
    tags: ["ประกันโรคร้ายแรง"],
  });
  assert.deepEqual(normalizeArticleTaxonomy({ categoryTitle: "การลงทุน" }), {
    categorySlug: "investment",
    tags: [],
  });
});

test("the legacy UAT personal-finance slug normalizes to the active category", () => {
  assert.deepEqual(normalizeArticleTaxonomy({ categorySlug: "personal-finance-uat" }), {
    categorySlug: "personal-finance",
    tags: [],
  });
});

test("topic hub slugs stay reserved and cannot collide with article slugs", () => {
  assert.equal(isReservedArticleSlug("health-insurance"), true);
  assert.equal(isReservedArticleSlug("critical-illness"), true);
  assert.equal(isReservedArticleSlug("critical-illness-insurance"), true);
});

test("current Health and Critical Illness are physical while the historical combined WordPress category stays backward compatible", () => {
  assert.deepEqual(normalizeArticleTaxonomy({ categoryTitle: "ประกันสุขภาพและโรคร้ายแรง", categorySlug: "health-insurance" }), {
    categorySlug: "life-insurance",
    tags: ["ประกันสุขภาพ"],
  });
  assert.deepEqual(normalizeArticleTaxonomy({ categoryTitle: "ประกันสุขภาพและโรคร้ายแรง", categorySlug: "critical-illness" }), {
    categorySlug: "life-insurance",
    tags: ["ประกันโรคร้ายแรง"],
  });
  assert.deepEqual(normalizeArticleTaxonomy({ categoryTitle: "ประกันสุขภาพและโรคร้ายแรง" }), {
    categorySlug: "life-insurance",
    tags: ["ประกันสุขภาพ", "ประกันโรคร้ายแรง"],
  });
});

test("existing tags are trimmed, blanks dropped, and deduped case-insensitively in first-seen order", () => {
  const sourceTags = ["  Retirement ", "retirement", "", "  ", "ประกันสุขภาพ", "Health"] as const;

  assert.deepEqual(
    normalizeArticleTaxonomy({
      categorySlug: "health-insurance",
      tags: sourceTags,
    }),
    {
      categorySlug: "health-insurance",
      tags: ["Retirement", "ประกันสุขภาพ", "Health"],
    },
  );
  assert.deepEqual(sourceTags, ["  Retirement ", "retirement", "", "  ", "ประกันสุขภาพ", "Health"]);
});

test("unknown category signals fail closed while preserving normalized tags", () => {
  assert.deepEqual(normalizeArticleTaxonomy({ categorySlug: "legacy-unknown", tags: [" Topic "] }), {
    categorySlug: null,
    tags: ["Topic"],
  });
});

test("conflicting category title and slug fail closed instead of moving the canonical path", () => {
  assert.deepEqual(normalizeArticleTaxonomy({
    categoryTitle: "ประกันสุขภาพ",
    categorySlug: "personal-finance",
  }), {
    categorySlug: null,
    tags: ["ประกันสุขภาพ"],
  });
  assert.deepEqual(normalizeArticleTaxonomy({
    categoryTitle: "การเงินส่วนบุคคล",
    categorySlug: "health-insurance",
  }), {
    categorySlug: null,
    tags: ["ประกันสุขภาพ"],
  });
});
