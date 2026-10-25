// LINE chat button system (owner-approved 2026-10-25, decisions L1-L9): config validation, the
// pure panel resolver, Admin safety and the website wiring.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildLineChatCampaignLink,
  chatContextForPath,
  chatTextIssues,
  countChatCharacters,
  defaultEvergreenReviewAt,
  LINE_CHAT_BANNED_WORDS,
  LINE_CHAT_DEFAULTS,
  LINE_CHAT_LIMITS,
  lineChatAdminWarnings,
  lineChatConfigFromProjection,
  lineChatConfigSchema,
  lineChatConfigToSanityFields,
  lineChatImmutabilityIssues,
  lineChatMergeForRevert,
  parseLineChatConfig,
  resolveChatPanel,
  selectChatConfigForPage,
  type LineChatCampaign,
  type LineChatConfig,
} from "../../lib/line/chat-config";
import { buildLineOaMessageHref, LINE_OA_CHAT_URL, LINE_OA_ID } from "../../lib/line/oa-link";
import { buildLineContinueLink } from "../../lib/line/ecosystem";
import { encodeQr } from "../../components/layout/v5/qr-code";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const OA_MESSAGE = "https://line.me/R/oaMessage/%40ccpun/?";
const NOW = new Date("2026-11-10T03:00:00.000Z");
const decode = (href: string) => decodeURIComponent(href.slice(OA_MESSAGE.length));

function config(campaigns: LineChatCampaign[] = [], patch: Partial<LineChatConfig> = {}): LineChatConfig {
  return { ...structuredClone(LINE_CHAT_DEFAULTS), campaigns, ...patch };
}

const smartNetwork: LineChatCampaign = {
  code: "smartnetwork-2611", refCode: "SN", title: "Smart Network", type: "temporary",
  startsAt: "2026-11-01T00:00:00.000Z", endsAt: "2026-11-18T00:00:00.000Z",
  pageGroups: ["all"], pinnedTopicIds: ["smart-network-hospital"], headline: "เช็กสิทธิ์ Smart Network ก่อน 18 พ.ย.", paused: false,
};
const bio: LineChatCampaign = {
  code: "bio-facebook", refCode: "FB", title: "ลิงก์ใน bio Facebook", type: "evergreen",
  reviewAt: "2027-01-30T00:00:00.000Z", pageGroups: ["all"], pinnedTopicIds: ["book-a-chat"], paused: false,
};

test("shipped defaults pass the same validation as Admin saves, in natural Thai within the limits", () => {
  assert.equal(lineChatConfigSchema.safeParse(LINE_CHAT_DEFAULTS).success, true);
  assert.equal(parseLineChatConfig(LINE_CHAT_DEFAULTS).source, "stored");
  for (const topic of LINE_CHAT_DEFAULTS.topics) {
    assert.ok(countChatCharacters(topic.label) <= LINE_CHAT_LIMITS.label, topic.label);
    assert.ok(countChatCharacters(topic.prefill) <= LINE_CHAT_LIMITS.prefill, topic.prefill);
    assert.deepEqual(chatTextIssues(topic.label, LINE_CHAT_LIMITS.label), [], topic.id);
    assert.deepEqual(chatTextIssues(topic.prefill, LINE_CHAT_LIMITS.prefill), [], topic.id);
    assert.doesNotMatch(topic.prefill + topic.label, /journey:|entry:|\.\.\.|…/);
  }
  const labels = (key: string) => LINE_CHAT_DEFAULTS.placements.find((item) => item.key === key)!.topicIds.map((id) => LINE_CHAT_DEFAULTS.topics.find((topic) => topic.id === id)!.label);
  assert.deepEqual(labels("home"), ["เช็กประกันที่มีอยู่", "วางแผนประกันสุขภาพ", "ลดหย่อนภาษีปีนี้"]);
  assert.deepEqual(labels("category:health-insurance").slice(0, 2), ["รพ.นี้อยู่ใน Smart Network ไหม", "แผนไหนเหมาะกับฉัน"]);
  assert.deepEqual(labels("tool_ci"), ["ขอคุยเรื่องผลที่คำนวณได้", "ขอดูแผนคุ้มครองโรคร้าย"]);
  assert.deepEqual(labels("about"), ["ขอนัดคุยกับปั้น", "เช็กประกันที่มีอยู่"]);
  for (const key of ["home", "blog_index", "tool_ci", "tool_fhc", "tool_money_story", "tool_investment_allocation", "tools_hub", "about", "default"]) {
    assert.ok(LINE_CHAT_DEFAULTS.placements.some((item) => item.key === key), `default placement for ${key}`);
  }
});

test("copy rules reject links, phone numbers, emails, banned words, emoji, ellipsis and over-length text", () => {
  assert.deepEqual(chatTextIssues("ดูที่ https://example.com", 120), ["url"]);
  assert.ok(chatTextIssues("ทักที่ line.me/ti/p/@other", 120).includes("url"));
  assert.deepEqual(chatTextIssues("โทร 081-234-5678", 120), ["phone"]);
  assert.deepEqual(chatTextIssues("อีเมล a@b.co", 120).includes("email"), true);
  for (const word of LINE_CHAT_BANNED_WORDS) assert.ok(chatTextIssues(`ประกัน${word}`, 120).includes("banned-word"), word);
  assert.ok(chatTextIssues("สวัสดี 🙂", 120).includes("emoji"));
  assert.ok(chatTextIssues("รอสักครู่...", 120).includes("ellipsis"));
  assert.ok(chatTextIssues("ก".repeat(29), 28).includes("too-long"));
  assert.equal(countChatCharacters("ที่นี่"), 2, "Thai vowel and tone marks are not extra characters");
  assert.deepEqual(chatTextIssues("   ", 28), ["empty"]);
});

test("resolver precedence: utm campaign > latest active temporary campaign > page placement > default", () => {
  const later: LineChatCampaign = { ...smartNetwork, code: "tax-2611", refCode: "TX", startsAt: "2026-11-05T00:00:00.000Z", pinnedTopicIds: ["tax-deduction"], headline: undefined };
  const cfg = config([smartNetwork, later, bio]);
  const viaUtm = resolveChatPanel({ pageGroup: "home", config: cfg, utmCampaign: "bio-facebook", now: NOW, consentGiven: false });
  assert.equal(viaUtm.mode, "panel");
  if (viaUtm.mode !== "panel") return;
  assert.equal(viaUtm.source, "campaign-utm");
  assert.equal(viaUtm.campaignCode, "bio-facebook");
  assert.equal(viaUtm.topics[0].id, "book-a-chat");
  assert.equal(decode(viaUtm.topics[0].href), "อยากนัดคุยกับปั้นครับ สะดวกช่วงไหนบ้าง (รหัส FB08)");

  const temporary = resolveChatPanel({ pageGroup: "home", config: cfg, now: NOW, consentGiven: true });
  assert.ok(temporary.mode === "panel" && temporary.source === "campaign-temporary" && temporary.campaignCode === "tax-2611", "the latest-started temporary campaign wins");
  const placement = resolveChatPanel({ pageGroup: "home", config: config(), now: NOW, consentGiven: true });
  assert.ok(placement.mode === "panel" && placement.source === "placement" && placement.headline === "คุยกับปั้นทาง LINE");
  if (placement.mode === "panel") {
    assert.deepEqual(placement.topics.map((topic) => topic.id), ["check-existing-policy", "health-plan", "tax-deduction", "type-own"]);
    assert.equal(placement.topics.at(-1)!.label, "พิมพ์คำถามเอง", "type-your-own is always appended last");
    assert.equal(decode(placement.topics[0].href), "อยากให้ช่วยดูประกันที่มีอยู่ ว่าคุ้มครองพอหรือยังครับ (รหัส HM01)");
    assert.equal(decode(placement.topics.at(-1)!.href), "สวัสดีครับ มีเรื่องอยากถาม (รหัส HM00)");
  }
  const fallback = resolveChatPanel({ pageGroup: "category:unknown-topic", config: config(), now: NOW, consentGiven: true });
  assert.ok(fallback.mode === "panel" && fallback.source === "default" && fallback.pageGroup === "blog_category");
});

test("article override, category placement, at most four topics plus type-your-own", () => {
  const cfg = config([], {
    placements: [...LINE_CHAT_DEFAULTS.placements, { key: "article:aia-health-happy-describe", topicIds: ["which-plan-fits"] }],
  });
  const article = resolveChatPanel({ pageGroup: "category:health-insurance", articleSlug: "aia-health-happy-describe", config: cfg, now: NOW, consentGiven: false });
  assert.ok(article.mode === "panel");
  if (article.mode === "panel") {
    assert.deepEqual(article.topics.map((topic) => topic.id), ["which-plan-fits", "type-own"]);
    assert.equal(article.topics[0].refCode, "AR05");
  }
  const category = resolveChatPanel({ pageGroup: "category:health-insurance", articleSlug: "other-article", config: cfg, now: NOW, consentGiven: false });
  assert.ok(category.mode === "panel" && category.topics[0].id === "smart-network-hospital");
  const crowded = resolveChatPanel({ pageGroup: "home", config: config([{ ...smartNetwork, pinnedTopicIds: ["book-a-chat", "ci-plan"] }]), now: NOW, consentGiven: false });
  assert.ok(crowded.mode === "panel");
  if (crowded.mode === "panel") assert.equal(crowded.topics.length, LINE_CHAT_LIMITS.placementTopics + 1);
});

test("campaigns persist across pages only with analytics consent (L3)", () => {
  const cfg = config([bio]);
  const withConsent = resolveChatPanel({ pageGroup: "blog_index", config: cfg, storedUtmCampaign: "bio-facebook", now: NOW, consentGiven: true });
  const withoutConsent = resolveChatPanel({ pageGroup: "blog_index", config: cfg, storedUtmCampaign: "bio-facebook", now: NOW, consentGiven: false });
  assert.ok(withConsent.mode === "panel" && withConsent.campaignCode === "bio-facebook");
  assert.ok(withoutConsent.mode === "panel" && withoutConsent.campaignCode === undefined, "without consent only the landing URL counts");
  const landing = resolveChatPanel({ pageGroup: "blog_index", config: cfg, utmCampaign: "BIO-FACEBOOK", now: NOW, consentGiven: false });
  assert.ok(landing.mode === "panel" && landing.campaignCode === "bio-facebook", "the landing page view still gets its campaign");
  assert.ok(resolveChatPanel({ pageGroup: "home", config: cfg, utmCampaign: "<script>", now: NOW, consentGiven: true }).mode === "panel");
});

test("temporary campaigns revert after their end; evergreen ones never switch off; paused ones are skipped", () => {
  const cfg = config([smartNetwork, bio]);
  const after = resolveChatPanel({ pageGroup: "home", config: cfg, now: new Date("2026-11-18T00:00:01.000Z"), consentGiven: false });
  assert.ok(after.mode === "panel" && after.source === "placement" && after.campaignCode === undefined);
  const overdue = resolveChatPanel({ pageGroup: "home", config: cfg, utmCampaign: "bio-facebook", now: new Date("2027-06-01T00:00:00.000Z"), consentGiven: false });
  assert.ok(overdue.mode === "panel" && overdue.campaignCode === "bio-facebook", "an overdue evergreen campaign keeps working");
  const paused = resolveChatPanel({ pageGroup: "home", config: config([{ ...smartNetwork, paused: true }]), now: NOW, consentGiven: false });
  assert.ok(paused.mode === "panel" && paused.campaignCode === undefined);
  const otherPage = resolveChatPanel({ pageGroup: "tool_ci", config: config([{ ...smartNetwork, pageGroups: ["blog_category", "article"] }]), now: NOW, consentGiven: false });
  assert.ok(otherPage.mode === "panel" && otherPage.campaignCode === undefined, "campaigns apply only to their page groups");
});

test("the destination is hard-coded @ccpun: the kill switch shows the plain LINE button, config cannot carry a link", () => {
  assert.equal(LINE_OA_ID, "@ccpun");
  assert.equal(LINE_OA_CHAT_URL, "https://line.me/R/ti/p/%40ccpun");
  assert.ok(buildLineOaMessageHref("ทดสอบ").startsWith(OA_MESSAGE));
  const off = resolveChatPanel({ pageGroup: "home", config: config([], { enabled: false }), now: NOW, consentGiven: true });
  assert.deepEqual(off, { mode: "plain", href: LINE_OA_CHAT_URL, pageGroup: "home" });
  const on = resolveChatPanel({ pageGroup: "home", config: config([bio]), utmCampaign: "bio-facebook", now: NOW, consentGiven: true });
  assert.ok(on.mode === "panel" && on.topics.every((topic) => topic.href.startsWith(OA_MESSAGE)));
  assert.equal(lineChatConfigSchema.safeParse({ ...LINE_CHAT_DEFAULTS, href: "https://evil.example" }).success, false);
  assert.equal(lineChatConfigSchema.safeParse({ ...LINE_CHAT_DEFAULTS, topics: [{ ...LINE_CHAT_DEFAULTS.topics[0], href: "https://evil.example" }, ...LINE_CHAT_DEFAULTS.topics.slice(1)] }).success, false);
  const schema = read("cms/sanity/schema/documents/line-chat-config.ts");
  assert.doesNotMatch(schema, /name: "(?:href|url|destination|oaId|lineId)"/);
  assert.doesNotMatch(read("lib/line/chat-config.ts") + read("lib/line/chat-panel.ts"), /lin\.ee|line\.me/);
});

test("invalid or unavailable config falls back to the shipped defaults", () => {
  assert.deepEqual(parseLineChatConfig(null), { config: LINE_CHAT_DEFAULTS, source: "default", invalid: false });
  const broken = parseLineChatConfig({ ...LINE_CHAT_DEFAULTS, topics: [{ ...LINE_CHAT_DEFAULTS.topics[0], label: "ฟรี ทุกแผน" }, ...LINE_CHAT_DEFAULTS.topics.slice(1)] });
  assert.equal(broken.source, "default");
  assert.equal(broken.invalid, true);
  assert.equal(broken.config, LINE_CHAT_DEFAULTS);
  assert.equal(parseLineChatConfig({ ...LINE_CHAT_DEFAULTS, placements: LINE_CHAT_DEFAULTS.placements.filter((item) => item.key !== "default") }).invalid, true, "a default placement is required");
  // Sanity round trip through the published projection.
  const fields = lineChatConfigToSanityFields(config([smartNetwork, bio]));
  const projected = {
    _rev: "r1", enabled: fields.enabled,
    topics: fields.topics.map((topic) => ({ id: topic.topicId, ref: topic.ref, label: topic.label, prefill: topic.prefill, journey: topic.journey, enabled: topic.enabled })),
    placements: fields.placements.map((item) => ({ key: item.pageKey, topicIds: item.topicIds })),
    campaigns: fields.campaigns.map((campaign) => ({ ...campaign, type: campaign.campaignType, headline: "headline" in campaign ? campaign.headline : null, _key: undefined, _type: undefined, campaignType: undefined })),
  };
  const roundTrip = parseLineChatConfig(lineChatConfigFromProjection(projected));
  assert.equal(roundTrip.source, "stored", JSON.stringify(roundTrip));
  assert.deepEqual(roundTrip.config.campaigns.map((campaign) => campaign.code), ["smartnetwork-2611", "bio-facebook"]);
  assert.equal(new Set(fields.topics.map((topic) => topic._key)).size, fields.topics.length, "stable unique Sanity keys");
});

test("a disabled topic is skipped, but no page may be left without an enabled topic", () => {
  const disabled = config();
  disabled.topics = disabled.topics.map((topic) => topic.id === "health-plan" ? { ...topic, enabled: false } : topic);
  assert.equal(lineChatConfigSchema.safeParse(disabled).success, true);
  const panel = resolveChatPanel({ pageGroup: "home", config: disabled, now: NOW, consentGiven: false });
  assert.ok(panel.mode === "panel" && !panel.topics.some((topic) => topic.id === "health-plan"));
  const empty = config();
  empty.topics = empty.topics.map((topic) => topic.id === "motor-quote" || topic.id === "check-existing-policy" ? { ...topic, enabled: false } : topic);
  assert.equal(lineChatConfigSchema.safeParse(empty).success, false, "motor category would have no enabled topic");
});

test("the page slice sent to the browser carries only this page's placements, campaigns and topics", () => {
  const slice = selectChatConfigForPage(config([smartNetwork, { ...bio, pageGroups: ["tool_ci"] }, { ...smartNetwork, code: "ended", endsAt: "2026-11-02T00:00:00.000Z" }]), { pageGroup: "home" }, NOW);
  assert.deepEqual(slice.placements.map((item) => item.key), ["home", "default"]);
  assert.deepEqual(slice.campaigns.map((campaign) => campaign.code), ["smartnetwork-2611"]);
  assert.ok(slice.topics.length < LINE_CHAT_DEFAULTS.topics.length);
  assert.deepEqual(resolveChatPanel({ pageGroup: "home", config: slice, now: NOW, consentGiven: false }), resolveChatPanel({ pageGroup: "home", config: config([smartNetwork]), now: NOW, consentGiven: false }));
});

test("page groups come from the physical path", () => {
  assert.deepEqual(chatContextForPath("/"), { pageGroup: "home" });
  assert.deepEqual(chatContextForPath("/blog/"), { pageGroup: "blog_index" });
  assert.deepEqual(chatContextForPath("/blog/health-insurance/"), { pageGroup: "category:health-insurance" });
  assert.deepEqual(chatContextForPath("/blog/health-insurance/aia-health-happy-describe/"), { pageGroup: "category:health-insurance", articleSlug: "aia-health-happy-describe" });
  assert.deepEqual(chatContextForPath("/ci-planning/"), { pageGroup: "tool_ci" });
  assert.deepEqual(chatContextForPath("/tools/financial-health-check/"), { pageGroup: "tool_fhc" });
  assert.deepEqual(chatContextForPath("/play/money-story/"), { pageGroup: "tool_money_story" });
  assert.deepEqual(chatContextForPath("/tools/investment-allocation/"), { pageGroup: "tool_investment_allocation" });
  assert.deepEqual(chatContextForPath("/tools/aia-fund-allocation/"), { pageGroup: "tool_investment_allocation" }, "the AIA fund tool shares the main tool's page group");
  assert.deepEqual(chatContextForPath("/tools/"), { pageGroup: "tools_hub" });
  assert.deepEqual(chatContextForPath("/about/"), { pageGroup: "about" });
  assert.deepEqual(chatContextForPath(undefined), { pageGroup: "default" });
  assert.deepEqual(chatContextForPath("/privacy/"), { pageGroup: "default" });
});

test("topic ids, reference numbers and campaign codes are permanent; revert keeps later ids switched off", () => {
  const saved = config([bio]);
  assert.deepEqual(lineChatImmutabilityIssues(saved, saved), []);
  const removed = { ...saved, topics: saved.topics.filter((topic) => topic.id !== "tax-deduction") };
  assert.deepEqual(lineChatImmutabilityIssues(saved, removed), [{ kind: "topic-removed", id: "tax-deduction" }]);
  const renumbered = { ...saved, topics: saved.topics.map((topic) => topic.id === "tax-deduction" ? { ...topic, ref: 77 } : topic) };
  assert.deepEqual(lineChatImmutabilityIssues(saved, renumbered), [{ kind: "topic-ref-changed", id: "tax-deduction" }]);
  assert.deepEqual(lineChatImmutabilityIssues(saved, { ...saved, campaigns: [] }), [{ kind: "campaign-removed", code: "bio-facebook" }]);
  assert.deepEqual(lineChatImmutabilityIssues(saved, { ...saved, campaigns: [{ ...bio, refCode: "XX" }] }), [{ kind: "campaign-ref-changed", code: "bio-facebook" }]);
  const older = config();
  const merged = lineChatMergeForRevert(saved, older);
  assert.deepEqual(lineChatImmutabilityIssues(saved, merged), []);
  assert.equal(merged.campaigns.find((campaign) => campaign.code === "bio-facebook")!.paused, true);
  assert.equal(lineChatConfigSchema.safeParse(merged).success, true);
});

test("Admin warnings: expiring in 3 days, overdue evergreen (red), running on defaults, topics with no clicks", () => {
  const warnings = lineChatAdminWarnings(config([smartNetwork, { ...bio, reviewAt: "2026-11-01T00:00:00.000Z" }]), new Date("2026-11-16T00:00:00.000Z"), { source: "default", storedInvalid: true, topicClicks30d: { "check-existing-policy": 4 } });
  assert.ok(warnings.some((warning) => warning.kind === "campaign-expiring" && warning.code === "smartnetwork-2611"));
  assert.ok(warnings.some((warning) => warning.kind === "evergreen-overdue" && warning.level === "danger"));
  assert.ok(warnings.some((warning) => warning.kind === "running-defaults" && warning.reason === "invalid-config"));
  assert.ok(warnings.some((warning) => warning.kind === "topic-no-clicks" && warning.id === "health-plan"));
  assert.ok(!warnings.some((warning) => warning.kind === "topic-no-clicks" && warning.id === "check-existing-policy"));
  assert.deepEqual(lineChatAdminWarnings(config([smartNetwork]), NOW, { source: "stored", topicClicks30d: null }), [], "nothing to flag mid-campaign; no click data means no click warnings");
  assert.equal(defaultEvergreenReviewAt(new Date("2026-10-25T00:00:00.000Z")), "2027-01-23T00:00:00.000Z", "default review is +90 days (L7)");
});

test("UTM link builder: Facebook, Instagram, TikTok, LINE broadcast and Google Business Profile", () => {
  assert.equal(buildLineChatCampaignLink("bio-facebook", "facebook", "/"), "https://ccpun.com/?utm_source=facebook&utm_medium=social&utm_campaign=bio-facebook");
  assert.equal(buildLineChatCampaignLink("smartnetwork-2611", "line_broadcast", "/blog/health-insurance/"), "https://ccpun.com/blog/health-insurance/?utm_source=line&utm_medium=broadcast&utm_campaign=smartnetwork-2611");
  assert.match(buildLineChatCampaignLink("gbp", "google_business_profile", "/tools/")!, /utm_source=google&utm_medium=business_profile/);
  assert.match(buildLineChatCampaignLink("ig-bio", "instagram", "/")!, /utm_source=instagram/);
  assert.match(buildLineChatCampaignLink("tt-bio", "tiktok", "/")!, /utm_source=tiktok/);
  for (const bad of ["https://evil.example/", "//evil.example/", "/blog", "/blog/?x=1"]) assert.equal(buildLineChatCampaignLink("bio-facebook", "facebook", bad), null, bad);
  assert.equal(buildLineChatCampaignLink("Bad Code", "facebook", "/"), null);
});

test("LINE continue links read as plain Thai with no journey or entry tokens", () => {
  const link = buildLineContinueLink({ journey: "motor_quote_review", entrypoint: "rich_menu", tool_id: "fhc" });
  assert.ok(link);
  assert.doesNotMatch(link!.prefill, /journey:|entry:|content:|tool:|saved:|\|/);
  assert.equal(link!.prefill, "ลองใช้เครื่องมือบนเว็บแล้ว อยากให้ช่วยดูใบเสนอราคาประกันรถครับ");
  assert.equal(buildLineContinueLink({ journey: "life_health_policy_review" })!.prefill, "อยากให้ช่วยดูกรมธรรม์หรือแผนที่มีอยู่ครับ");
  assert.ok(link!.href.startsWith(OA_MESSAGE));
});

test("QR encoder produces a valid symbol size for the desktop popover link", () => {
  const href = buildLineOaMessageHref("สวัสดีครับ มีเรื่องอยากถาม (รหัส HM00)");
  const qr = encodeQr(href);
  assert.equal((qr.size - 17) % 4, 0);
  assert.ok(qr.size <= 65, `small enough to scan at 168px (size ${qr.size})`);
  assert.equal(qr.modules.length, qr.size);
  assert.equal(qr.modules[0][0] && qr.modules[6][6] && !qr.modules[1][1], true, "finder pattern in place");
});

test("Admin service and endpoint follow the LINE Discovery contract: lane-guarded, published-only, owner-only, same-origin", () => {
  const service = read("lib/admin/line/chat-config.ts");
  assert.match(service, /isAdminReadDataPlaneAllowed/);
  assert.match(service, /isAdminDataPlaneAllowed/);
  assert.match(service, /perspective: "published"/);
  assert.match(service, /ifRevisionId\(current\._rev\)/);
  assert.match(service, /LINE_CHAT_STALE/);
  assert.match(service, /LINE_CHAT_IMMUTABLE/);
  assert.match(service, /lineChatActorDigest\(actor\)/, "updatedBy stores an actor digest, never the raw email");
  assert.match(service, /data\/history\//, "revert uses Sanity document history");
  assert.doesNotMatch(service, /perspective:\s*"drafts"|includeDrafts:\s*true|console\./);
  const route = read("apps/admin/app/api/admin/line/chat/route.ts");
  assert.match(route, /hasAdminPermission\(identity\.role, "settings:read"\)/);
  assert.match(route, /identity\.role !== "owner"/);
  assert.match(route, /isSameOriginAdminMutation/);
  assert.match(route, /payload-too-large/);
  assert.match(route, /stale-revision/);
  assert.match(route, /immutable-key/);
  assert.doesNotMatch(route, /CCPUN_LINE_CHANNEL_ACCESS_TOKEN|line_user_id|customer_id|console\./i);
});

test("Settings > ปุ่มแชท LINE: tabs, phone preview, test link, UTM builder, inline validation and history revert", () => {
  const page = read("apps/admin/app/(control-plane)/settings/line-chat/page.tsx");
  assert.match(page, /requireAdminPermission\("settings:read"\)/);
  assert.match(page, /canEdit=\{access\.role === "owner"\}/);
  assert.match(read("apps/admin/app/(control-plane)/layout.tsx"), /\{ href: "\/settings\/line-chat\/", label: "ปุ่มแชท LINE" \}/);
  const ui = read("features/admin/line/LineChatManager.tsx");
  for (const label of ["คลังหัวข้อ", "หน้าไหนใช้อะไร", "แคมเปญ", "สวิตช์หลัก", "ตัวอย่างบนมือถือ", "ลองเปิดใน LINE", "สร้างลิงก์แคมเปญ", "ยังใช้ได้ (ต่ออีก 90 วัน)", "ย้อนกลับไปเวอร์ชันนี้", "เว็บกำลังใช้ค่าเริ่มต้น"]) {
    assert.ok(ui.includes(label), label);
  }
  assert.match(ui, /lineChatConfigSchema\.safeParse\(draft\)/);
  assert.match(ui, /chatTextIssues/);
  assert.match(ui, /role="tablist"/);
  assert.match(read("cms/sanity/schema/index.ts"), /lineChatConfig,/);
});

test("website: one merged bottom LINE element, panel and QR load on interaction, events only through trackEvent", () => {
  const page = read("components/layout/v5/V5Page.tsx");
  // Coming Soon (owner-approved 2026-10-25) may add one code-fallback topic for its own group; still one dock.
  assert.match(page, /<V5ChatDockServer context=\{chat \?\? chatContextForPath\(current\)\} pageTopic=\{chatTopic\} \/>/);
  assert.equal(page.match(/<V5ChatDockServer\b/g)?.length, 1);
  const dock = read("components/layout/v5/V5ChatDock.tsx");
  assert.match(dock, /lazy\(\(\) => import\("\.\/V5ChatPanel"\)\)/);
  // The dock is a real LINE link without JavaScript; button/dialog semantics apply once it is enhanced.
  assert.match(dock, /aria-haspopup=\{enhanced \? "dialog" : undefined\}/);
  assert.match(dock, /trackEvent\("line_oa_click", \{ contact_channel: "line", cta_location: "chat_button"/);
  // Owner decision 2026-10-25: visible from load; it sits above the cookie notice instead of waiting for it.
  assert.match(dock, /document\.querySelector\(COOKIE_DIALOG\)/, "the bar sits above the cookie notice instead of stacking on it");
  const panel = read("components/layout/v5/V5ChatPanel.tsx");
  assert.match(panel, /role="dialog" aria-modal="true"/);
  assert.match(panel, /event\.key === "Escape"/);
  assert.match(panel, /event\.key !== "Tab"/);
  assert.match(panel, /import\("\.\/qr-code"\)/);
  assert.match(panel, /min-width: 1024px/);
  assert.match(panel, /trackEvent\("line_chat_panel_open"/);
  assert.match(panel, /cta_location: "chat_panel", chat_topic_id: topic\.id, page_group: panel\.pageGroup/);
  assert.match(panel, /getAttribution\(\)\?\.utm_campaign/);
  assert.match(panel, /consentGiven \? getAttribution/);
  for (const source of [dock, panel]) assert.doesNotMatch(source, /\bgtag\s*\(|\bfbq\s*\(|dataLayer|prefill:\s*topic\.prefill/);
  const css = read("components/layout/v5/V5ChatDock.module.css");
  assert.match(css, /min-height: 48px/);
  assert.match(css, /backdrop-filter/);
  assert.doesNotMatch(css.replace(/#ffffff|#000000/gi, ""), /#[0-9a-f]{3,8}\b/i, "v5 tokens only (the QR keeps pure black on white)");
  assert.match(read("lib/content/line-chat-config.ts"), /return \{ config: LINE_CHAT_DEFAULTS, source: "default", invalid: false \}/);
});
