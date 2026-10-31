import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import { createHash } from "node:crypto";

const home = readFileSync(new URL('../features/home/v5/V5Home.tsx',import.meta.url),'utf8');
const route = readFileSync(new URL('../apps/web/app/page.tsx',import.meta.url),'utf8');
const shell = readFileSync(new URL('../components/layout/v5/V5Page.tsx',import.meta.url),'utf8');
const copy = readFileSync(new URL('../lib/content/public-copy-registry.ts',import.meta.url),'utf8');
assert.match(route, /<V5Home authorProfile=\{authorProfile\}/);
const hero = home.split('<section id="home"')[1].split('</section>')[0];
assert.match(hero, /home-hero-white-outline-bottom-flush-f548ab58\.png/);
assert.match(hero, /loading="eager"/);
assert.match(hero, /fetchPriority="high"/);
assert.match(hero, /fill preload/);
assert.match(hero, /sizes="\(max-width: 767px\) calc\(100vw - 40px\), \(max-width: 1023px\) calc\(100vw - 64px\)/);
assert.doesNotMatch(hero, /loading="lazy"/);
assert.equal((hero.match(/<Image\b/g) ?? []).length,1,'one responsive native hero portrait');
for(const [key,text]of [['titleBefore','เพราะปัญหาทางการเงินมัน'],['titleEmphasis','ซับซ้อน'],['titleAfter',' เราจึงต้องวางแผน ออกแบบให้เหมาะกับตัวคุณ']]){
 assert.match(hero,new RegExp('text\\.node\\("home\\.hero\\.'+key+'"\\)'));
 assert.ok(copy.includes(JSON.stringify('home.hero.'+key)+': '+JSON.stringify(text)),'approved H1 text remains intact');
}
assert.equal((shell.match(/\bid="main-content"/g)??[]).length,1,'one native shell skip-link target');
assert.match(shell,/<main id="main-content" tabIndex=\{-1\}>\{children\}<\/main>/,'every native hero stays inside the focusable main');
assert.match(home,/<V5Page current="\/"/);
const css=readFileSync(new URL('../features/home/v5/V5Home.module.css',import.meta.url),'utf8');
assert.match(css,/\.portrait img \{ object-fit: contain; object-position: center bottom/,'cutout remains bottom-flush');
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
const shared = readFileSync(new URL("../components/layout/v5/V5Footer.tsx", import.meta.url), "utf8");
assert.match(shared, /import CookieSettingsButton from "@\/components\/layout\/CookieSettingsButton"/);
assert.match(shared, /<CookieSettingsButton\b/, "Home must preserve consent reopening in the responsive footer variants");
// Inspect every breakpoint, so a later broad right reserve cannot silently shrink a section.
const homeStyles = postcss.parse(css);
for (const selector of ['.heroCopy', '.homeSection > div', '.countdownFrame']) {
  homeStyles.walkRules(rule => {
    if (!rule.selectors.includes(selector)) return;
    rule.walkDecls(declaration => {
      if (/^padding-(?:right|inline-end)$/.test(declaration.prop)) {
        assert.equal(declaration.value, '0', `${selector} must not reserve one whole side`);
      }
      if (declaration.prop === 'padding-inline') assert.equal(declaration.value, 'var(--v5-gutter)');
    });
  });
}
assert.match(css, /\.homeSection > div \{ padding-inline: var\(--v5-gutter\); \}/);
assert.match(css, /@media \(min-width: 1360px\)/, 'four readable cards still start only at the approved width');
assert.match(css, /\.startHereCard:last-child \.pairedGuide \{ max-width: calc\(100% - max\(0px, 248px - var\(--v5-gutter\)\)\); \}/, 'bounded LINE clearance stays on the last interactive control');
// Native tablet changes are a single bounded media block: every original phone/desktop rule survives byte-exact.
const tabletBounds = '(min-width: 768px) and (max-width: 1023px)';
const tabletMarker = '\n/* Approved 820 portrait Home:';
const sha = value => createHash('sha256').update(value).digest('hex');
assert.equal(sha(css.slice(0,css.indexOf(tabletMarker))), 'c6a95090a63356987da1740a5b167c430f443d9155759b808fb7232461a91472');
let nativeTablet;homeStyles.walkAtRules('media',media=>{if(media.params===tabletBounds&&media.nodes.some(n=>n.type==='rule'&&n.selector==='.heroGrid')){assert.equal(nativeTablet,undefined);nativeTablet=media;}});
assert.equal(nativeTablet.type,'atrule'); assert.equal(nativeTablet.params,tabletBounds);
const declared = (tree,selector,property) => { let value; tree.walkRules(rule=>{if(rule.selectors.includes(selector))rule.walkDecls(property,d=>{value=d.value;});});return value; };
assert.equal(declared(nativeTablet,'.heroGrid','grid-template-columns'),'repeat(2, minmax(0, 1fr))');
assert.equal(declared(nativeTablet,'.heroTitle','font-size'),'36px');
assert.equal(declared(nativeTablet,'.portrait','bottom'),'0');
assert.equal(declared(nativeTablet,'.credentials.staticCredentials','grid-template-columns'),'repeat(2, minmax(0, 1fr))');
assert.equal(declared(nativeTablet,'.latestTrack.latestTrack','grid-template-columns'),'minmax(0, 1fr)');
assert.equal(declared(nativeTablet,'.latestCard.latestCard','flex-direction'),'row');
assert.equal(declared(nativeTablet,'.latestCard.latestCard > :is(img, span[aria-hidden])','width'),'240px');
assert.equal(declared(nativeTablet,'.latestCard p','-webkit-line-clamp'),'unset');
assert.equal(declared(nativeTablet,'.latestCard > div > span','font-size'),'16px');
assert.equal(declared(nativeTablet,'.latestCard h3','font-weight'),'600');
assert.equal(declared(nativeTablet,'.latestCard h3','line-height'),'1.35');
assert.equal(declared(nativeTablet,'.latestCard > div > p','font-size'),'16px');
assert.equal(declared(nativeTablet,'.quotes','grid-template-columns'),'repeat(2, minmax(0, 1fr))');
// Native tablet omits H03 visually; its original copy remains in the DOM for other responsive variants.
assert.equal(declared(nativeTablet,'.aboutSection.aboutSection','display'),'none');
assert.equal(declared(nativeTablet,'.partnerStrip.partnerStrip','order'),'-1');
assert.equal(declared(nativeTablet,'.partner','height'),'88px');
assert.equal(declared(nativeTablet,'.partner strong','clip-path'),'inset(50%)');
assert.match(home,/id="about-ccpun"/);assert.match(home,/text\.node\("home\.p3"\)/);assert.match(home,/text\.node\("home\.advisorNote"\)/);
assert.match(hero,/<Link className=\{shell.buttonOutline\} href="\/about\/">/);
assert.doesNotMatch(hero,/href="#about-ccpun"/);
assert.equal(declared(nativeTablet,'.painCard:first-child','border-radius'),'24px');
assert.equal(declared(nativeTablet,'.painCard::before','content'),'none');

for(const width of [390,767,768,820,834,1023,1024,1440]){
 const active=width>=768&&width<=1023;
 assert.equal(active,[768,820,834,1023].includes(width),`tablet changes at ${width}`);
 if(active){const copy=(width-64-32)/2,portrait=Math.min(360,copy);assert.ok(portrait<=copy);assert.ok((width-64-40-24-240)>=400,'latest text retains readable width');}
}
const chrome=readFileSync(new URL('../components/layout/v5/V5.module.css',import.meta.url),'utf8');
const chromeMarker='\n/* Native portrait tablet chrome';
let chromeBeforeTablet=chrome.slice(0,chrome.indexOf(chromeMarker));
const balancedSlotComment="/* All campaign placements keep balanced slots; only widget action hit regions clear LINE. */";
assert.equal(chromeBeforeTablet.split(balancedSlotComment).length,2);
chromeBeforeTablet=chromeBeforeTablet.replace(balancedSlotComment,"/* Full campaign actions in Blog/Article keep the existing fixed LINE corner clear; Home owns its frame. */\n.countdownSlot:has(:global([data-campaign-placement=\"blog\"])), .countdownSlot:has(:global([data-campaign-placement=\"article\"])) { padding-inline-end: max(0px, calc(80px - var(--v5-gutter))); }\n@media (min-width: 1024px) { .countdownSlot:has(:global([data-campaign-placement=\"blog\"])), .countdownSlot:has(:global([data-campaign-placement=\"article\"])) { padding-inline-end: max(0px, calc(248px - var(--v5-gutter))); } }");
assert.equal(sha(chromeBeforeTablet),'08e109515f30ee5040fcc1a35b3401bb1aaffc6191dd69f1cd988a84f02e790a','all other original shared CSS bytes and pins stay intact');
let tabletChrome;postcss.parse(chrome).walkAtRules('media',media=>{if(media.params===tabletBounds&&media.nodes.some(n=>n.type==='rule'&&n.selector==='.footerGrid')){assert.equal(tabletChrome,undefined);tabletChrome=media;}});
assert.equal(tabletChrome.params,tabletBounds);
assert.equal(declared(tabletChrome,'.desktopNav','display'),'block');
assert.equal(declared(tabletChrome,'.themeSegments','display'),'inline-grid');
assert.equal(declared(tabletChrome,'.menuButton','display'),'none');
assert.equal(declared(tabletChrome,'.footerGrid','grid-template-columns'),'repeat(3, minmax(0, 1fr))');
assert.equal(declared(tabletChrome,'.footerMark','font-size'),'96px');
const outline=[...homeStyles.nodes].reverse().find(node=>node.type==='atrule'&&node.params==='(max-width: 767px)');assert.ok(outline);
const outlineRule=outline.nodes.find(n=>n.type==='rule');assert.equal(outlineRule.selector,'.portrait img');
assert.deepEqual(outlineRule.nodes.map(d=>d.prop),['filter','clip-path']);
assert.equal((outlineRule.nodes[0].value.match(/drop-shadow/g)??[]).length,4);
assert.doesNotMatch(outlineRule.nodes[0].value,/3px|blur|border/);assert.equal(outlineRule.nodes[1].value,'inset(-4px -4px 0)');
console.log("PASS: approved Home responsive LCP and FAQ composition contract");
