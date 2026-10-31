import assert from "node:assert/strict";
import { createHash } from "node:crypto";
// Only the disabled Meta Pixel runtime mount may be removed. Every prior byte stays pinned.
export const META_PIXEL_WIDGETS = "features/analytics/components/ClientWidgets.tsx";
export const META_PIXEL_WIDGETS_BASELINE = "0d91482b985aff4118070f78086a6b96f4acac0249a8317e45104aafbe0d11a2";
const removedImport = "const MetaPixel = dynamic(() => import('@/features/analytics/components/MetaPixel'), { ssr: false });\n";
const removedGate = [
  "  const isMetaPixelSurface = pathname === '/ci-planning'",
  "    || pathname.startsWith('/ci-planning/')",
  "    || pathname === '/tools/fhc'",
  "    || pathname.startsWith('/tools/fhc/')",
  "    || pathname === '/tools/financial-health-check'",
  "    || pathname.startsWith('/tools/financial-health-check/');",
  "", ""
].join("\n");
const removedRender = "    {metaPixelId && isMetaPixelSurface && <MetaPixel pixelId={metaPixelId} />}\n";
const retiredComment = "  // Legacy prop remains only for the existing server layout contract; no Facebook SDK is mounted.\n  void metaPixelId;\n";
const gaMount = "    {gaId && <GoogleAnalytics gaId={gaId} />}\n";
const gtmImport = "const GoogleTagManager = dynamic(() => import('@/features/analytics/components/GoogleTagManager'), { ssr: false });\n";
const privateGuard = "  if (isPrivateSurface) return null;\n";
export function assertMetaPixelRuntimeRetirement(file, source, digest = META_PIXEL_WIDGETS_BASELINE) {
  assert.equal(file, META_PIXEL_WIDGETS);
  assert.equal(digest, META_PIXEL_WIDGETS_BASELINE, "original frozen source identity must remain pinned");
  for (const fragment of [retiredComment, gaMount, gtmImport, privateGuard]) assert.equal(source.split(fragment).length, 2);
  assert.ok(!source.includes("MetaPixel") && !source.includes("isMetaPixelSurface"), "no Facebook runtime import or mount");
  let old = source.replace(retiredComment, "");
  old = old.replace(gtmImport, gtmImport + removedImport);
  old = old.replace(privateGuard, removedGate + privateGuard).replace("\n\n  const isMetaPixelSurface", "\n  const isMetaPixelSurface");
  old = old.replace(gaMount, gaMount + removedRender);
  assert.equal(createHash("sha256").update(old).digest("hex"), META_PIXEL_WIDGETS_BASELINE,
    "all previous routes, HTML, consent, GTM and GA4 are byte-for-byte preserved");
  return digest;
}

// The original legacy module is retired rather than merely left as an orphan.
export const RETIRED_META_PIXEL_SOURCE = "features/analytics/components/MetaPixel.tsx";
export const RETIRED_META_PIXEL_SHA = "a1c57275db8692a6487b08ad0a291742d11b1209070461f7b433e7086713a6ea";
export function assertMetaPixelSourceRemoved(file, baselineDigest, exists) {
  assert.equal(file, RETIRED_META_PIXEL_SOURCE, "only the archived direct Meta Pixel source may be retired");
  assert.equal(baselineDigest, RETIRED_META_PIXEL_SHA, "old verified source identity is pinned");
  assert.equal(exists, false, "retired source must not be present in the repository");
  return baselineDigest;
}
