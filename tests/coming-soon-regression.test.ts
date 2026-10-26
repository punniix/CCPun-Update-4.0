// Coming Soon (owner-approved concept, 2026-10-25, UAT): registered-only planned pages with strict
// SEO safety, one consent-gated interest event and a per-page LINE chat topic.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  allComingSoonPages,
  comingSoonChatPrefill,
  comingSoonMetadata,
  comingSoonSlug,
  findComingSoonPage,
  listComingSoonPages,
  COMING_SOON_CHAT_LABEL,
} from "../lib/content/coming-soon";
import { buildSemanticDataLayerEvent, resolveEventMapping, sanitizeEventParams } from "../lib/analytics";
import { chatContextForPath, chatPlacementKeys, LINE_CHAT_DEFAULTS, LINE_CHAT_PLACEMENT_KEY, resolveChatPanel, withPageTopic } from "../lib/line/chat-panel";
import { chatTextIssues } from "../lib/line/chat-config";
import { WEB_REDIRECTS } from "../lib/runtime/web-build-config.mjs";
import { BLOG_TOPIC_HUBS } from "../lib/content/taxonomy";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const pages = allComingSoonPages();
const BANNED = /ฟรี|การันตี|รับประกัน|ดีที่สุด|อันดับ ?1|100%|\.\.\.|…|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

test("registry: Production registers no page; the single example is UAT-only", () => {
  assert.deepEqual(listComingSoonPages("production"), [], "no linked-but-unbuilt route exists, so Production registers none");
  assert.deepEqual(listComingSoonPages("unknown"), []);
  assert.ok(pages.length >= 1);
  for (const page of pages.filter((candidate) => candidate.lanes === "uat-only")) {
    assert.equal(findComingSoonPage(page.path, "web-uat"), page);
    assert.equal(findComingSoonPage(page.path, "local-uat"), page);
    assert.equal(findComingSoonPage(page.path, "production"), undefined);
  }
  assert.equal(findComingSoonPage("/tools/not-registered/", "web-uat"), undefined, "an unknown path is never a Coming Soon page");
  assert.equal(findComingSoonPage("/tools/tax-deduction", "web-uat"), undefined, "exact registered path only");
});

test("registry: planned paths never collide with live routes, redirects or the legacy ledger", () => {
  const ledger = read("qa/legacy-url-ledger.json");
  const paths = pages.map((page) => page.path);
  assert.equal(new Set(paths).size, paths.length, "unique paths");
  assert.equal(new Set(pages.map((page) => page.chatRef)).size, pages.length, "unique chat reference numbers");
  assert.equal(new Set(pages.map((page) => page.chatTopicId)).size, pages.length, "unique chat topic ids");
  for (const page of pages) {
    assert.match(page.path, /^\/tools\/[a-z0-9][a-z0-9-]{1,60}\/$/, `${page.path}: served by apps/web/app/tools/[slug]`);
    assert.equal(existsSync(new URL(`../apps/web/app/tools/${comingSoonSlug(page)}/`, import.meta.url)), false, `${page.path}: a built route owns this path`);
    assert.ok(!WEB_REDIRECTS.some(({ prefix }) => page.path === `${prefix}/` || page.path.startsWith(`${prefix}/`)), `${page.path}: redirected path`);
    assert.ok(!ledger.includes(`"${page.path}"`) && !ledger.includes(`"${page.path.slice(0, -1)}"`), `${page.path}: historical URL`);
    assert.ok(Number.isInteger(page.chatRef) && page.chatRef >= 1 && page.chatRef <= 99);
  }
});

test("One Search Intent = One Owner: every page links an existing owner that serves the intent today", () => {
  const liveTools = new Set(["/ci-planning/", "/tools/financial-health-check/", "/play/money-story/", "/tools/"]);
  const topicSlugs = new Set(BLOG_TOPIC_HUBS.map((hub) => hub.slug));
  for (const page of pages) {
    const target = page.closestExisting.path;
    if (page.closestExisting.kind === "tool") assert.ok(liveTools.has(target), `${page.path}: ${target} is not a live tool`);
    else {
      const match = /^\/blog\/([a-z0-9-]+)\/([a-z0-9-]+)\/$/.exec(target);
      assert.ok(match && topicSlugs.has(match[1] as never), `${page.path}: ${target} is not an article URL`);
    }
    assert.ok(!pages.some((other) => other.path === target), "never points at another planned page");
  }
});

test("SEO: noindex,follow, no canonical, excluded from every sitemap", async () => {
  for (const page of pages) {
    const metadata = comingSoonMetadata(page);
    assert.deepEqual(metadata.robots, { index: false, follow: true });
    assert.equal(metadata.alternates?.canonical, null);
  }
  const { GET: core } = await import("../apps/web/app/sitemaps/core.xml/route");
  const { GET: tools } = await import("../apps/web/app/sitemaps/tools.xml/route");
  const { GET: index } = await import("../apps/web/app/sitemap.xml/route");
  for (const xml of [await core().text(), await tools().text(), await index().text()]) {
    for (const page of pages) assert.ok(!xml.includes(page.path), `${page.path} listed in a sitemap`);
  }
  // Blog and AI Search sitemaps list Sanity articles/categories only; neither can emit a /tools/ path.
  for (const file of ["apps/web/app/sitemaps/blog.xml/route.ts", "apps/web/app/sitemaps/ai-search.xml/route.ts", "lib/content/sitemap.ts"]) {
    assert.doesNotMatch(read(file), /coming-soon|\/tools\//, `${file}`);
  }
});

test("routing: only registered slugs render; everything else is the real 404", () => {
  const route = read("apps/web/app/tools/[slug]/page.tsx");
  assert.match(route, /^export const dynamicParams = false;$/m, "unregistered slugs are not generated on demand");
  assert.match(route, /export \{ default, generateMetadata, generateStaticParams \} from "@\/features\/coming-soon\/page";/);
  const page = read("features/coming-soon/page.tsx");
  assert.match(page, /if \(!page\) notFound\(\);/, "the page itself 404s when the registry does not know the slug");
  assert.match(page, /listComingSoonPages\(resolveContentEnvironment\(\)\)/, "static params come from the lane-filtered registry");
  assert.doesNotMatch(page, /\[\.\.\./, "no catch-all segment");
  assert.match(read("apps/web/app/not-found.tsx"), /export default async function NotFound/, "the real 404 page is unchanged");
});

test("analytics: coming_soon_interest carries only the planned path, GA4-only and consent-gated", () => {
  assert.deepEqual(sanitizeEventParams({ coming_soon_path: "/tools/tax-deduction/", email: "a@b.co", note: "free text" }), { coming_soon_path: "/tools/tax-deduction/" });
  for (const value of ["/tools/tax-deduction", "/blog/x/", "https://ccpun.com/tools/x/", "/tools/x/?email=a@b.co", "/tools/ภาษี/"]) {
    assert.equal(sanitizeEventParams({ coming_soon_path: value }).coming_soon_path, undefined, value);
  }
  assert.deepEqual(resolveEventMapping("coming_soon_interest", sanitizeEventParams({ coming_soon_path: "/tools/tax-deduction/" })), { ga: ["coming_soon_interest"], meta: "none" });
  const previous = process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED;
  process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED = "true";
  try {
    assert.equal(buildSemanticDataLayerEvent("coming_soon_interest", { coming_soon_path: "/tools/tax-deduction/" }, { analytics: false, social: false }), null);
    const model = { ...buildSemanticDataLayerEvent("coming_soon_interest", { coming_soon_path: "/tools/tax-deduction/" }, { analytics: true, social: false }) };
    Object.assign(model, buildSemanticDataLayerEvent("line_oa_click", { contact_channel: "line" }, { analytics: true, social: false }));
    assert.equal(model.coming_soon_path, null, "a later event clears the planned path");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED; else process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED = previous;
  }
  const interest = read("features/coming-soon/ComingSoonInterest.tsx");
  assert.deepEqual([...interest.matchAll(/trackEvent\(([^)]*)\)/g)].map((match) => match[1]), ['"coming_soon_interest", { coming_soon_path: path }']);
  assert.doesNotMatch(interest, /\bgtag\s*\(|\bfbq\s*\(|dataLayer|localStorage|fetch\(/, "no provider call, storage or network request besides trackEvent");
});

test("LINE: one dock per page; the planned page adds its own topic and CS reference code without writing Sanity", () => {
  const page = read("features/coming-soon/page.tsx");
  assert.match(page, /<V5Page current=\{page\.path\} chat=\{\{ pageGroup: "coming_soon" \}\} chatTopic=\{chatTopic\}>/);
  assert.doesNotMatch(page, /lin\.ee|line\.me|LINE_OA/, "no second LINE button on the page");
  assert.ok(LINE_CHAT_PLACEMENT_KEY.test("coming_soon"));
  assert.deepEqual(chatPlacementKeys({ pageGroup: "coming_soon" }), ["coming_soon", "default"]);
  assert.deepEqual(chatContextForPath("/tools/tax-deduction/"), { pageGroup: "default" }, "only an explicit chat context selects the group");
  for (const entry of pages) {
    const topic = { id: entry.chatTopicId, ref: entry.chatRef, label: COMING_SOON_CHAT_LABEL, prefill: comingSoonChatPrefill(entry), journey: "human" as const, enabled: true };
    assert.deepEqual(chatTextIssues(topic.label, 28), [], "label passes the Admin text rules");
    assert.deepEqual(chatTextIssues(topic.prefill, 120), [], "prefill passes the Admin text rules");
    const config = withPageTopic(LINE_CHAT_DEFAULTS, "coming_soon", topic);
    const panel = resolveChatPanel({ pageGroup: "coming_soon", config, now: new Date("2026-10-25T00:00:00Z"), consentGiven: false });
    assert.equal(panel.mode, "panel");
    if (panel.mode !== "panel") continue;
    assert.equal(panel.pageGroup, "coming_soon");
    assert.equal(panel.topics[0].id, entry.chatTopicId);
    // Owner decision 2026-10-26: no "(รหัส ...)" code in the visible message; the topic id stays in analytics.
    assert.equal(panel.topics[0].prefill, topic.prefill);
    assert.ok(panel.topics[0].prefill.includes(entry.title));
    assert.doesNotMatch(panel.topics.map((item) => item.prefill).join(" "), /รหัส/);
    assert.deepEqual(panel.topics.map((item) => item.id), [entry.chatTopicId, "book-a-chat", "type-own"]);
    // The owner's published config wins: a disabled owner topic with the same id stays disabled,
    // and an owner placement keeps its topics after the page topic.
    const owner = { ...LINE_CHAT_DEFAULTS, topics: [...LINE_CHAT_DEFAULTS.topics, { ...topic, enabled: false }], placements: [...LINE_CHAT_DEFAULTS.placements, { key: "coming_soon", topicIds: ["money-plan"] }] };
    const ownerPanel = resolveChatPanel({ pageGroup: "coming_soon", config: withPageTopic(owner, "coming_soon", topic), now: new Date(), consentGiven: false });
    assert.ok(ownerPanel.mode === "panel" && ownerPanel.topics.map((item) => item.id).join() === "money-plan,type-own");
    assert.equal(withPageTopic({ ...LINE_CHAT_DEFAULTS, enabled: false }, "coming_soon", topic).topics.length, LINE_CHAT_DEFAULTS.topics.length, "a switched-off chat stays plain");
  }
  assert.match(read("lib/analytics.ts"), /page_group: new Set\(\[[^\]]*'coming_soon'/, "page_group token is allowlisted");
});

test("copy rules and motion: no banned words or eyebrows; the blueprint draws once and respects reduced motion", () => {
  for (const page of pages) {
    for (const text of [page.title, page.intent, page.closestExisting.label, page.closestExisting.note, comingSoonChatPrefill(page), page.expected ?? ""]) {
      assert.doesNotMatch(text, BANNED, text);
    }
  }
  const sources = ["features/coming-soon/page.tsx", "features/coming-soon/ComingSoonInterest.tsx", "features/coming-soon/ComingSoonBlueprint.tsx"].map(read).join("\n");
  // Source scan skips "..." (JS spread); visible strings were checked above with the full rule.
  assert.doesNotMatch(sources, /ฟรี|การันตี|รับประกัน|ดีที่สุด|อันดับ ?1|…|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  assert.doesNotMatch(sources, /eyebrow|kicker/i);
  const css = read("features/coming-soon/ComingSoon.module.css");
  const [outside, inside = ""] = css.split("@media (prefers-reduced-motion: no-preference)");
  assert.doesNotMatch(outside.replace(/@keyframes[\s\S]*$/, ""), /animation:/, "nothing animates outside the no-preference block");
  assert.match(inside, /animation: comingSoonDraw 900ms ease-out forwards/);
  for (const [, body] of css.matchAll(/@keyframes \w+ \{([^}]*\})/g)) assert.match(body, /^\s*to \{ (?:stroke-dashoffset: 0|opacity: 1); \}$/, "only the draw and opacity");
  assert.doesNotMatch(css, /transition:|animation-iteration-count|infinite/);
  for (const [, size] of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(size) >= 13);
  assert.match(read("features/coming-soon/ComingSoonBlueprint.tsx"), /aria-hidden="true"/, "decorative drawing is hidden from assistive technology");
});
