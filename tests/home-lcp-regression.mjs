import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
console.log("PASS: approved Home responsive LCP and FAQ composition contract");
