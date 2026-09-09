import assert from "node:assert/strict";
const BASE_URL = process.env.PRODUCTION_READ_BASE_URL ?? "http://127.0.0.1:3000";
const response = await fetch(`${BASE_URL}/`);
assert.equal(response.status, 200);
const html = await response.text();
const hero = html.match(/<section id="home"[\s\S]*?<\/section>/)?.[0];
assert.ok(hero, "Homepage renders its hero in server HTML");
assert.match(hero, /home-hero-desktop/);
assert.match(hero, /loading="eager"/);
assert.match(hero, /fetchPriority="high"|fetchpriority="high"/);
assert.doesNotMatch(hero, /loading="lazy"/);
assert.equal((hero.match(/<img\b/g) ?? []).length, 1);
assert.doesNotMatch(html, /href="\/preview\//);
assert.doesNotMatch(html, /href=""/);
const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
const faq = schemas.find((schema) => schema['@type'] === 'FAQPage');
assert.equal(faq?.mainEntity.length, 2);
for (const item of faq.mainEntity) {
  assert.ok(html.includes(item.name));
  assert.ok(html.includes(item.acceptedAnswer.text));
}
console.log("PASS: rendered Home LCP, public links and matching FAQ schema");
