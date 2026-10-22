import { productionCmsDisplaySource } from '../qa/production-cms-source-proof.mjs';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = productionCmsDisplaySource("features/home/website-43/Website43Home.tsx");
const route = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
assert.match(route, /<Website43Home/);
const hero = home.split('<section id="home"')[1].split('</section>')[0];
assert.match(hero, /home-hero-desktop\.png/);
assert.match(hero, /loading="eager"/);
assert.match(hero, /fetchPriority="high"/);
assert.match(hero, /sizes="100vw"/);
assert.doesNotMatch(hero, /loading="lazy"/);
assert.equal((hero.match(/<Image\b/g) ?? []).length, 1, "Home hero must request one responsive image");
const headline = home.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, "");
assert.equal(headline, "เพราะปัญหาทางการเงินมันซับซ้อน เราจึงต้องวางแผน ออกแบบให้เหมาะกับตัวคุณ", "Line-wrap markup must preserve the approved headline text");
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
assert.match(home, /faqs\.map\(/);
assert.match(route, /const homeFaqs = getHomeCopyFaqs\(copy\)/);
assert.match(route, /faqs=\{homeFaqs\}/);
assert.doesNotMatch(home, /\/preview\//);
const shared = readFileSync(new URL("../components/layout/website-43/Website43Shared.tsx", import.meta.url), "utf8");
assert.match(shared, /import CookieSettingsButton from '@\/components\/layout\/CookieSettingsButton'/);
assert.match(shared, /<CookieSettingsButton\b/, "Home must preserve consent reopening in the responsive footer variants");
console.log("PASS: approved Home responsive LCP and FAQ composition contract");
