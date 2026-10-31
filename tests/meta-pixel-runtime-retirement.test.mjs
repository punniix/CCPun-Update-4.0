import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { META_PIXEL_WIDGETS, META_PIXEL_WIDGETS_BASELINE, assertMetaPixelRuntimeRetirement, RETIRED_META_PIXEL_SOURCE, RETIRED_META_PIXEL_SHA, assertMetaPixelSourceRemoved } from "../qa/meta-pixel-runtime-retirement.mjs";
const current = readFileSync(new URL("../" + META_PIXEL_WIDGETS, import.meta.url), "utf8");

test("retired direct Meta Pixel cannot run on any public page while the UX and GA4/GTM remain byte-identical", () => {
  assert.equal(assertMetaPixelRuntimeRetirement(META_PIXEL_WIDGETS, current), META_PIXEL_WIDGETS_BASELINE);
  assert.equal(assertMetaPixelSourceRemoved(RETIRED_META_PIXEL_SOURCE, RETIRED_META_PIXEL_SHA, false), RETIRED_META_PIXEL_SHA);
  assert.match(current, /<CookieConsent \/>/);
  assert.match(current, /<GoogleTagManager gtmId=\{gtmId\}/);
  assert.match(current, /<GoogleAnalytics gaId=\{gaId\}/);
  assert.doesNotMatch(current, /MetaPixel|fbevents\.js|facebook\.com\/tr|isMetaPixelSurface/);
});

test("retirement proof rejects changed consent, routes, GA4/GTM, forbidden Meta re-mounts or unrelated code", () => {
  const altered = [
    current.replace("<CookieConsent />", ""),
    current.replace("GoogleAnalytics gaId={gaId}", "GoogleAnalytics gaId={gtmId}"),
    current.replace("pathname === '/studio'", "pathname === '/foo'"),
    current + "\n// Unreviewed change\n",
    current.replace("  void metaPixelId;", "  void gaId;"),
    current.replace("    {gaId && <GoogleAnalytics gaId={gaId} />}", "    {gaId && <GoogleAnalytics gaId={gaId} />}{<MetaPixel />}"),
  ];
  for (const candidate of altered) {
    assert.notEqual(candidate, current);
    assert.throws(() => assertMetaPixelRuntimeRetirement(META_PIXEL_WIDGETS, candidate));
  }
  assert.throws(() => assertMetaPixelRuntimeRetirement("apps/admin/app/layout.tsx", current));
});
