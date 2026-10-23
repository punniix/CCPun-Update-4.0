import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadFixtureModule } from "../qa/phase1-fixture-loader.mjs";
import { sizedCopyPredecessor } from "../qa/phase2-source-proof.mjs";

const home = sizedCopyPredecessor(readFileSync(new URL("../features/home/website-43/Website43Home.tsx", import.meta.url), "utf8"));
const route = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
assert.match(route, /<Website43Home/);
const hero = home.split('<section id="home"')[1].split('</section>')[0];
assert.match(hero, /home-hero-desktop\.png/);
assert.match(hero, /loading="eager"/);
assert.match(hero, /fetchPriority="high"/);
assert.match(hero, /sizes="100vw"/);
assert.doesNotMatch(hero, /loading="lazy"/);
assert.equal((hero.match(/<Image\b/g) ?? []).length, 1, "Home hero must request one responsive image");
const emptyComponent = () => null;
const mocks = new Map([
  ['@/components/layout/website-43/Website43Shared', { Website43Navbar: emptyComponent }],
  ['./Website43HomeStatic', { HomeFooter: emptyComponent, HomeSectionHeading: emptyComponent }],
  ['@/components/ui/health-happy/HealthHappyCountdown', { __esModule: true, default: emptyComponent }],
  ...['phillip-logo.svg', 'website-43/icon-protection-gap.svg', 'website-43/icon-tax.svg', 'website-43/icon-investment-risk.svg'].map(path => [
    '../../../public/assets/' + path, { __esModule: true, default: '/assets/' + path },
  ]),
]);
const feature = loadFixtureModule('features/home/website-43/Website43Home.tsx', { mocks });
function findNodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => findNodes(child, predicate));
  if (!React.isValidElement(node)) return [];
  return [...(predicate(node) ? [node] : []), ...findNodes(node.props.children, predicate)];
}
function renderedHeadline(copy = {}) {
  const tree = feature.default({ copy, campaignAvailable: false });
  const headlines = findNodes(tree, node => node.type === 'h1' && node.props.id === 'home-hero-title');
  assert.equal(headlines.length, 1);
  return renderToStaticMarkup(headlines[0]).replace(/<[^>]+>/g, '');
}
for (const key of ['home.hero.titleBefore', 'home.hero.titleEmphasis', 'home.hero.titleAfter']) assert.ok(home.includes(`text("${key}")`));
const headline = renderedHeadline();
assert.equal(headline, "เพราะปัญหาทางการเงินมันซับซ้อน เราจึงต้องวางแผน ออกแบบให้เหมาะกับตัวคุณ", "Line-wrap markup must preserve the approved headline text");
assert.equal(renderedHeadline({ 'home.hero.titleBefore': 'UAT CMS H1 ' }), 'UAT CMS H1 ซับซ้อน เราจึงต้องวางแผน ออกแบบให้เหมาะกับตัวคุณ', 'Real SSR headline accepts the exact CMS key while preserving emphasis and suffix');
const focusTarget = '<div id="main-content" tabIndex={-1} className={styles.homeHeroCopy}>';
assert.equal((home.match(/\bid="main-content"/g) ?? []).length, 1, "Home has one skip-link focus target");
assert.ok(hero.includes(focusTarget), "The exact focusable homeHeroCopy DIV remains inside the Home hero");
const main = home.split('<main>')[1]?.split('</main>')[0];
assert.ok(main?.includes('<section id="home"') && main.includes(focusTarget), "The hero and focus target remain inside main");
assert.ok(hero.indexOf(focusTarget) < hero.indexOf('<h1'), "Skip-link target precedes the approved H1");
for (const file of ['app/layout.tsx', 'apps/web/app/layout.tsx']) {
  const layout = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  assert.match(layout, /<a href="#main-content" className=/, file + ": skip link retains its exact target");
}
assert.match(route, /mainEntity: homeFaqs\.map/);
assert.match(home, /faqs = getHomeCopyFaqs\(copy\)/);
assert.match(route, /getHomeCopyFaqs\(copy\)/);
const { getHomeCopyFaqs } = loadFixtureModule('lib/content/public-copy-registry.ts');
const faqs = findNodes(feature.default({ campaignAvailable: false }), node => node.type === 'section' && node.props.id === 'faq');
assert.equal(faqs.length, 1);
const visibleFaqs = findNodes(faqs[0], node => node.type === 'details').map(detail => ({
  question: findNodes(detail, node => node.type === 'summary')[0].props.children[0].props.children,
  answer: findNodes(detail, node => node.type === 'p')[0].props.children,
}));
assert.deepEqual(visibleFaqs, getHomeCopyFaqs({}), 'Actual Home FAQ composition uses the same canonical pairs as route JSON-LD');
assert.doesNotMatch(home, /\/preview\//);
const shared = readFileSync(new URL("../components/layout/website-43/Website43Shared.tsx", import.meta.url), "utf8");
assert.match(shared, /import CookieSettingsButton from '@\/components\/layout\/CookieSettingsButton'/);
assert.match(shared, /<CookieSettingsButton\b/, "Home must preserve consent reopening in the responsive footer variants");
console.log("PASS: approved Home responsive LCP and FAQ composition contract");
