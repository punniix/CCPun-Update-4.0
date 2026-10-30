import { ownerReviewVisualSourcePredecessor } from "../qa/v5-owner-review-source-successor.mjs";
import { productionCmsDisplaySource } from '../qa/production-cms-source-proof.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Website v5 Phase A: the homepage route renders features/home/v5/V5Home.tsx.
// The same LCP/FAQ/skip-link/consent contracts are now asserted on the v5 owner;
// the unchanged Website 4.3 home component keeps its frozen proofs elsewhere.
const home = ownerReviewVisualSourcePredecessor("features/home/v5/V5Home.tsx", readFileSync(new URL("../features/home/v5/V5Home.tsx", import.meta.url), "utf8"));
const route = productionCmsDisplaySource("apps/web/app/page.tsx");
assert.match(route, /<V5Home authorProfile=\{authorProfile\} copy=\{copy\} faqs=\{homeFaqs\} \/>/);
const hero = home.split('<section id="home"')[1].split('</section>')[0];
assert.match(hero, /pun-cutout-31beef3a\.png/);
assert.match(hero, /loading="eager"/);
assert.match(hero, /fetchPriority="high"/);
assert.match(hero, /\bpreload\b/);
assert.match(hero, /sizes="\(max-width: 767px\) calc\(100vw - 40px\), \(max-width: 1023px\) calc\(100vw - 64px\), \(max-width: 1199px\) calc\(50vw - 56px\), \(max-width: 1439px\) calc\(50vw - 104px\), 616px"/, "the cutout uses the actual responsive portrait frame, not 100vw");
assert.doesNotMatch(hero, /loading="lazy"/);
assert.equal((hero.match(/<Image\b/g) ?? []).length, 1, "Home hero must request one responsive image");
assert.match(hero, /<h1 id="home-hero-title"[^>]*>\{text\.node\("home\.hero\.titleBefore"\)\}<em>\{text\.node\("home\.hero\.titleEmphasis"\)\}<\/em>\{text\.node\("home\.hero\.titleAfter"\)\}<\/h1>/, "approved headline keys and order are preserved");
const page = readFileSync(new URL("../components/layout/v5/V5Page.tsx", import.meta.url), "utf8");
assert.equal((page.match(/\bid="main-content"/g) ?? []).length, 1, "v5 pages have one skip-link focus target");
assert.match(page, /<main id="main-content" tabIndex=\{-1\}>/, "the focusable main landmark is the skip-link target");
assert.doesNotMatch(home, /id="main-content"/, "home does not add a second focus target");
for (const file of ['app/layout.tsx', 'apps/web/app/layout.tsx']) {
  const layout = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  assert.match(layout, /<a href="#main-content" className=/, file + ": skip link retains its exact target");
}
assert.match(route, /mainEntity: homeFaqs\.map/);
assert.match(home, /faqs = getHomeCopyFaqs\(copy\)/);
assert.match(home, /faqs\.map\(/);
assert.match(route, /const homeFaqs = getHomeCopyFaqs\(copy\)/);
assert.match(route, /faqs=\{homeFaqs\}/);
assert.doesNotMatch(home, /\/preview\//);
const footer = readFileSync(new URL("../components/layout/v5/V5Footer.tsx", import.meta.url), "utf8");
assert.match(footer, /import CookieSettingsButton from "@\/components\/layout\/CookieSettingsButton"/);
assert.match(footer, /<CookieSettingsButton \/>/, "Home must preserve consent reopening in the shared v5 footer");
console.log("PASS: approved Home responsive LCP and FAQ composition contract (v5)");
