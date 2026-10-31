import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// Approved SEO sitemap-only successor for preexisting, indexable canonical pages.
// Preserve the frozen Production route-owner hash instead of resealing the baseline.
export const CORE_ROUTE = "apps/web/app/sitemaps/core.xml/route.ts";
export const CORE_BASELINE_SHA = "b65773febf84cb13cc71d28b59d35b1d812db008e721f3c011eca2736c48b7ce";
export const NEW_CANONICAL_URLS = Object.freeze([
  "https://ccpun.com/about/",
  "https://ccpun.com/tools/",
  "https://ccpun.com/play/money-story/",
]);

const needle = '      { loc: "https://ccpun.com/privacy/" },\n';
const addition = NEW_CANONICAL_URLS.map(loc => `      { loc: "${loc}" },\n`).join("");
const digest = text => createHash("sha256").update(text).digest("hex");

export function reviewedCoreSitemapBaseline(file, source, baselineSha = CORE_BASELINE_SHA) {
  assert.equal(file, CORE_ROUTE, "only the Web core sitemap may use this admission");
  assert.equal(baselineSha, CORE_BASELINE_SHA, "the original Production baseline stays pinned");
  assert.equal(source.split(addition + needle).length, 2, "insert exactly the three approved canonical URLs before privacy");
  const prior = source.replace(addition + needle, needle);
  assert.equal(digest(prior), baselineSha, "all original sitemap code and URLs remain unchanged");
  return baselineSha;
}
