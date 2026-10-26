// LINE chat topics per page (owner decisions 2026-10-26): no "(รหัส XX)" code in the visible message,
// a natural source sentence instead, and three editable layers (site default, category, per page)
// under campaign pins. Pure resolver, validation, Sanity contract, Admin guards and website wiring.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  chatContextForArticle,
  chatContextForPath,
  chatOverrideKey,
  chatPlacementKeys,
  chatSourceTitle,
  chatTemplateIssues,
  chatTextIssues,
  composeChatMessage,
  fillChatSourceTemplate,
  hasVisibleCode,
  LINE_CHAT_DEFAULT_SOURCE_TEMPLATES,
  LINE_CHAT_DEFAULTS,
  LINE_CHAT_LIMITS,
  LINE_CHAT_ROUTES,
  lineChatConfigFromDocument,
  lineChatConfigFromProjection,
  lineChatConfigSchema,
  lineChatConfigToSanityFields,
  logicalArticleId,
  parseLineChatConfig,
  resolveChatPanel,
  selectChatConfigForPage,
  type ChatPanel,
  type LineChatCampaign,
  type LineChatConfig,
  type LineChatPageOverride,
} from "../../lib/line/chat-config";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const OA_MESSAGE = "https://line.me/R/oaMessage/%40ccpun/?";
const NOW = new Date("2026-11-10T03:00:00.000Z");
const decode = (href: string) => decodeURIComponent(href.slice(OA_MESSAGE.length));

// Annuity article fixture (the owner's example): physical category life-insurance, no semantic hub of its own.
const ANNUITY_PATH = "/blog/life-insurance/annuity-tax-deduction/";
const ANNUITY = { id: "drafts.article-annuity-tax", title: "ลดหย่อนภาษีด้วยประกันบำนาญ: เงื่อนไขและวิธีคิดสิทธิ 2569" };
const annuityContext = chatContextForArticle(ANNUITY_PATH, ANNUITY, "life-insurance");
const annuityOverride: LineChatPageOverride = {
  key: "doc:article-annuity-tax",
  title: ANNUITY.title,
  enabled: true,
  topics: [
    { kind: "custom", id: "page-annuity1", label: "สนใจประกันบำนาญ", prefill: "สนใจประกันบำนาญครับ" },
    { kind: "library", id: "tax-deduction" },
  ],
};

function config(patch: Partial<LineChatConfig> = {}): LineChatConfig {
  return { ...structuredClone(LINE_CHAT_DEFAULTS), ...patch };
}
function panelOf(result: ChatPanel) {
  assert.equal(result.mode, "panel");
  if (result.mode !== "panel") throw new Error("plain");
  return result;
}
const messages = (result: ChatPanel) => panelOf(result).topics.map((topic) => decode(topic.href));

const tax: LineChatCampaign = {
  code: "tax-2611", refCode: "TX", title: "ลดหย่อนภาษีปลายปี", type: "temporary",
  startsAt: "2026-11-01T00:00:00.000Z", endsAt: "2026-12-31T00:00:00.000Z", pageGroups: ["all"], pinnedTopicIds: ["book-a-chat"], paused: false,
};

test("article context: logical document id, live title, semantic topic; tools carry a route key", () => {
  assert.deepEqual(annuityContext, { pageGroup: "category:life-insurance", articleSlug: "annuity-tax-deduction", articleId: "article-annuity-tax", articleTitle: ANNUITY.title, topicSlug: "life-insurance" });
  assert.equal(logicalArticleId("drafts.abc-1"), "abc-1");
  assert.equal(logicalArticleId("versions.r1.abc-1"), "abc-1");
  assert.equal(logicalArticleId("bad id"), undefined);
  assert.equal(chatOverrideKey(annuityContext), "doc:article-annuity-tax");
  assert.equal(chatOverrideKey(chatContextForPath("/ci-planning/")), "page:ci-planning");
  assert.equal(chatOverrideKey({ pageGroup: "coming_soon" }), undefined);
  assert.deepEqual(LINE_CHAT_ROUTES.map((route) => route.path), ["/", "/blog/", "/tools/", "/ci-planning/", "/tools/financial-health-check/", "/play/money-story/", "/tools/investment-allocation/", "/tools/aia-fund-allocation/", "/about/"]);
  // The semantic topic's category is tried before the physical one (lib/content/taxonomy.ts stays the owner).
  assert.deepEqual(chatPlacementKeys({ pageGroup: "category:life-insurance", articleSlug: "aia-health-happy-describe", topicSlug: "health-insurance" }), ["article:aia-health-happy-describe", "category:health-insurance", "category:life-insurance", "default"]);
  assert.deepEqual(chatPlacementKeys(annuityContext), ["article:annuity-tax-deduction", "category:life-insurance", "default"]);
});

test("precedence: campaign pin > per-page override > category (semantic, then physical) > site default", () => {
  const withOverride = config({ pageOverrides: [annuityOverride] });
  const page = panelOf(resolveChatPanel({ ...annuityContext, config: withOverride, now: NOW, consentGiven: false }));
  assert.equal(page.layer, "page");
  assert.equal(page.source, "page-override");
  assert.deepEqual(page.topics.map((topic) => topic.id), ["page-annuity1", "tax-deduction", "type-own"]);

  const campaign = panelOf(resolveChatPanel({ ...annuityContext, config: { ...withOverride, campaigns: [tax] }, now: NOW, consentGiven: false }));
  assert.equal(campaign.source, "campaign-temporary");
  assert.equal(campaign.layer, "page", "the campaign pins above the page's own topics");
  assert.deepEqual(campaign.topics.map((topic) => topic.id), ["book-a-chat", "page-annuity1", "tax-deduction", "type-own"]);

  const off = config({ pageOverrides: [{ ...annuityOverride, enabled: false }] });
  const category = panelOf(resolveChatPanel({ ...annuityContext, config: off, now: NOW, consentGiven: false }));
  assert.equal(category.layer, "category");
  assert.deepEqual(category.topics.map((topic) => topic.id), ["life-cover", "check-existing-policy", "tax-deduction", "type-own"]);

  // Semantic topic wins over the physical category when both have placements.
  const semantic = panelOf(resolveChatPanel({ pageGroup: "category:life-insurance", articleSlug: "aia-health-happy-describe", topicSlug: "health-insurance", config: config(), now: NOW, consentGiven: false }));
  assert.equal(semantic.topics[0].id, "smart-network-hospital");

  const fallback = panelOf(resolveChatPanel({ pageGroup: "category:unknown", articleSlug: "x", articleId: "x", config: config(), now: NOW, consentGiven: false }));
  assert.equal(fallback.layer, "default");
  assert.equal(fallback.source, "default");

  // A site page override (route key) replaces that page's group placement only.
  const tool = config({ pageOverrides: [{ key: "page:aia-fund-allocation", title: "กองทุน บลจ. เอไอเอ", enabled: true, topics: [{ kind: "library", id: "investment-before" }] }] });
  assert.deepEqual(panelOf(resolveChatPanel({ ...chatContextForPath("/tools/aia-fund-allocation/"), config: tool, now: NOW, consentGiven: false })).topics.map((topic) => topic.id), ["investment-before", "type-own"]);
  assert.deepEqual(panelOf(resolveChatPanel({ ...chatContextForPath("/tools/investment-allocation/"), config: tool, now: NOW, consentGiven: false })).topics.map((topic) => topic.id), ["fund-allocation", "investment-before", "type-own"]);

  // An override whose library topics are all switched off falls through to the category.
  const disabled = config({ pageOverrides: [{ ...annuityOverride, topics: [{ kind: "library", id: "tax-deduction" }] }] });
  disabled.topics = disabled.topics.map((topic) => topic.id === "tax-deduction" ? { ...topic, enabled: false } : topic);
  assert.equal(panelOf(resolveChatPanel({ ...annuityContext, config: disabled, now: NOW, consentGiven: false })).layer, "category");
});

test("message: topic text + natural source sentence, never a code (owner example)", () => {
  const withOverride = config({ pageOverrides: [annuityOverride] });
  assert.deepEqual(messages(resolveChatPanel({ ...annuityContext, config: withOverride, now: NOW, consentGiven: false })), [
    "สนใจประกันบำนาญครับ อ่านบทความเรื่องลดหย่อนภาษีด้วยประกันบำนาญมาครับ",
    "อยากคุยเรื่องลดหย่อนภาษีปีนี้ครับ อ่านบทความเรื่องลดหย่อนภาษีด้วยประกันบำนาญมาครับ",
    "สวัสดีครับ มีเรื่องอยากถาม อ่านบทความเรื่องลดหย่อนภาษีด้วยประกันบำนาญมาครับ",
  ]);
  assert.deepEqual(messages(resolveChatPanel({ ...chatContextForPath("/ci-planning/"), config: config(), now: NOW, consentGiven: false })).slice(0, 1), [
    "เพิ่งลองคำนวณทุนโรคร้ายแรงบนเว็บ อยากคุยต่อเรื่องผลที่ได้ครับ ใช้เครื่องมือวางแผนเงินก้อนโรคร้ายแรงมาครับ",
  ]);
  assert.equal(messages(resolveChatPanel({ ...chatContextForPath("/play/money-story/"), config: config(), now: NOW, consentGiven: false }))[0], "อยากเริ่มวางแผนการเงินครับ ยังไม่แน่ใจว่าควรเริ่มตรงไหน ใช้เครื่องมือ Money Story มาครับ", "a space where Thai meets Latin text");
  for (const pagePath of ["/", "/blog/", "/blog/health-insurance/", "/about/"]) {
    for (const message of messages(resolveChatPanel({ ...chatContextForPath(pagePath), config: config(), now: NOW, consentGiven: true }))) assert.doesNotMatch(message, /มาครับ$|รหัส/, `${pagePath}: no source sentence and no code`);
  }
  // Every page and campaign: no "(รหัส" anywhere in the visible message.
  for (const context of [annuityContext, ...LINE_CHAT_ROUTES.map((route) => chatContextForPath(route.path)), { pageGroup: "coming_soon" }]) {
    for (const message of messages(resolveChatPanel({ ...context, config: config({ campaigns: [tax], pageOverrides: [annuityOverride] }), now: NOW, consentGiven: true }))) assert.doesNotMatch(message, /\(\s*รหัส|รหัส\s*[A-Z]{2}\d/);
  }
});

test("source sentence choices: per-topic beats per-page beats template; hideSource and empty templates switch it off", () => {
  const base = { ...annuityOverride, sourceSentence: "อ่านเรื่องเกษียณมาครับ", topics: [
    { kind: "custom" as const, id: "page-annuity1", label: "สนใจประกันบำนาญ", prefill: "สนใจประกันบำนาญครับ", sourceSentence: "อ่านบทความเรื่องลดหย่อนภาษีด้วยประกันบำนาญมา" },
    { kind: "library" as const, id: "tax-deduction", hideSource: true },
    { kind: "library" as const, id: "book-a-chat" },
  ] };
  assert.deepEqual(messages(resolveChatPanel({ ...annuityContext, config: config({ pageOverrides: [base] }), now: NOW, consentGiven: false })), [
    "สนใจประกันบำนาญครับ อ่านบทความเรื่องลดหย่อนภาษีด้วยประกันบำนาญมา",
    "อยากคุยเรื่องลดหย่อนภาษีปีนี้ครับ",
    "อยากนัดคุยกับปั้นครับ สะดวกช่วงไหนบ้าง อ่านเรื่องเกษียณมาครับ",
    "สวัสดีครับ มีเรื่องอยากถาม อ่านเรื่องเกษียณมาครับ",
  ]);
  const hidden = { ...annuityOverride, hideSource: true };
  assert.equal(messages(resolveChatPanel({ ...annuityContext, config: config({ pageOverrides: [hidden] }), now: NOW, consentGiven: false }))[0], "สนใจประกันบำนาญครับ");
  const noTemplates = config({ sourceTemplates: { article: "", tool: "" } });
  assert.equal(messages(resolveChatPanel({ ...annuityContext, config: noTemplates, now: NOW, consentGiven: false }))[0], "อยากให้ช่วยดูว่าทุนประกันชีวิตที่มีอยู่พอสำหรับครอบครัวไหมครับ");
  const edited = config({ sourceTemplates: { article: "เพิ่งอ่าน{title}ครับ", tool: "ลองใช้หน้า{toolName}แล้วครับ" } });
  assert.match(messages(resolveChatPanel({ ...annuityContext, config: edited, now: NOW, consentGiven: false }))[0], / เพิ่งอ่านลดหย่อนภาษีด้วยประกันบำนาญครับ$/);
  assert.match(messages(resolveChatPanel({ ...chatContextForPath("/tools/financial-health-check/"), config: edited, now: NOW, consentGiven: false }))[0], / ลองใช้หน้าตรวจสุขภาพการเงินแล้วครับ$/);
  // A stored config from before 2026-10-26 (no templates) still gets the default sentence.
  const legacy = config();
  delete legacy.sourceTemplates;
  delete legacy.pageOverrides;
  assert.equal(lineChatConfigSchema.safeParse(legacy).success, true);
  assert.match(messages(resolveChatPanel({ ...annuityContext, config: legacy, now: NOW, consentGiven: false }))[0], /อ่านบทความเรื่องลดหย่อนภาษีด้วยประกันบำนาญมาครับ$/);
});

test("title and template helpers: short readable titles, variables, Thai/Latin spacing", () => {
  assert.equal(chatSourceTitle("AIA Health Happy คืออะไร? แต่ละแผนเหมาะกับใคร อัปเดต 2026"), "AIA Health Happy คืออะไร");
  assert.equal(chatSourceTitle("พีระมิดทางการเงิน คืออะไร? วางรากฐานก่อนลงทุน"), "พีระมิดทางการเงิน คืออะไร");
  assert.equal(chatSourceTitle("แผนเกษียณ | CCPun"), "แผนเกษียณ");
  assert.equal(chatSourceTitle("วางแผนภาษี - ฉบับย่อ"), "วางแผนภาษี");
  assert.equal(chatSourceTitle("ทดสอบ 🙂 <b>หัวข้อ</b> [ใหม่] #1"), "ทดสอบ หัวข้อ ใหม่ 1");
  const long = chatSourceTitle(`${"ประกันบำนาญ ".repeat(10)}ท้าย`);
  assert.ok(long.length > 0 && [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(long)].length <= LINE_CHAT_LIMITS.sourceTitle);
  assert.doesNotMatch(long, /\.\.\.|…/);
  assert.equal(fillChatSourceTemplate("อ่านบทความเรื่อง{title}มาครับ", { title: "AIA Vitality" }), "อ่านบทความเรื่อง AIA Vitality มาครับ");
  assert.equal(fillChatSourceTemplate("อ่านบทความเรื่อง{title}มาครับ", { title: "" }), "", "no value, no sentence");
  assert.equal(fillChatSourceTemplate("อ่าน{unknown}มาครับ", { title: "x" }), "");
  assert.equal(composeChatMessage(" สนใจครับ ", ""), "สนใจครับ");
  assert.equal(composeChatMessage("สนใจครับ", "อ่านมาครับ"), "สนใจครับ อ่านมาครับ");
});

test("validation: per-page overrides, templates and copy rules (label 32, message 300, no codes)", () => {
  const valid = config({ pageOverrides: [annuityOverride] });
  assert.equal(lineChatConfigSchema.safeParse(valid).success, true);
  const issues = (candidate: LineChatConfig) => { const result = lineChatConfigSchema.safeParse(candidate); return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`); };
  const withOverride = (override: Partial<LineChatPageOverride>) => config({ pageOverrides: [{ ...annuityOverride, ...override } as LineChatPageOverride] });
  assert.ok(issues(withOverride({ topics: [{ kind: "library", id: "no-such-topic" }] })).includes("pageOverrides.0.topics.0.id:unknown-topic"));
  assert.ok(issues(withOverride({ topics: [{ kind: "custom", id: "tax-deduction", label: "ก", prefill: "ข" }] })).includes("pageOverrides.0.topics.0.id:duplicate"), "a page topic never reuses a library id");
  assert.ok(issues(withOverride({ topics: [{ kind: "custom", id: "type-own", label: "ก", prefill: "ข" }] })).includes("pageOverrides.0.topics.0.id:duplicate"));
  assert.ok(issues(withOverride({ topics: Array.from({ length: 5 }, (_, index) => ({ kind: "custom" as const, id: `page-x${index}`, label: "ก", prefill: "ข" })) })).length > 0, "at most four topics");
  assert.ok(issues(withOverride({ topics: [] })).length > 0, "at least one topic");
  assert.ok(issues(withOverride({ key: "doc:drafts.article-annuity-tax" })).some((issue) => issue.endsWith("draft-id")));
  assert.ok(issues(withOverride({ key: "category:life-insurance" })).length > 0, "overrides are per page, not per category");
  assert.ok(issues(withOverride({ topics: [{ kind: "custom", id: "page-a", label: "ก".repeat(33), prefill: "ข" }] })).some((issue) => issue.endsWith("too-long")));
  assert.deepEqual(issues(withOverride({ topics: [{ kind: "custom", id: "page-a", label: "ก".repeat(32), prefill: "ข".repeat(300) }] })), []);
  assert.ok(issues(withOverride({ topics: [{ kind: "custom", id: "page-a", label: "ก", prefill: "ข".repeat(301) }] })).some((issue) => issue.endsWith("too-long")));
  assert.ok(issues(withOverride({ topics: [{ kind: "custom", id: "page-a", label: "ก", prefill: "สนใจครับ (รหัส AR05)" }] })).some((issue) => issue.endsWith("code")));
  assert.ok(issues(withOverride({ sourceSentence: "อ่านแล้วฟรีครับ" })).some((issue) => issue.endsWith("banned-word")));
  assert.ok(issues(withOverride({ sourceSentence: "" })).some((issue) => issue.endsWith("empty")), "an empty custom sentence is not saved; use hideSource");
  const twoPages = config({ pageOverrides: [annuityOverride, { ...annuityOverride, key: "doc:other" }] });
  assert.ok(issues(twoPages).includes("pageOverrides.1.topics.0.id:duplicate"), "page topic ids are unique site-wide (analytics chat_topic_id)");
  assert.ok(issues(config({ pageOverrides: [annuityOverride, annuityOverride] })).includes("pageOverrides.1.key:duplicate"));

  assert.deepEqual(chatTemplateIssues(LINE_CHAT_DEFAULT_SOURCE_TEMPLATES.article, "article"), []);
  assert.deepEqual(chatTemplateIssues(LINE_CHAT_DEFAULT_SOURCE_TEMPLATES.tool, "tool"), []);
  assert.deepEqual(chatTemplateIssues("", "article"), [], "empty switches the sentence off");
  assert.ok(chatTemplateIssues("ใช้{toolName}มาครับ", "article").includes("unknown-variable"));
  assert.ok(chatTemplateIssues("อ่าน{title}มาครับ (รหัส AR)", "article").includes("code"));
  assert.ok(chatTemplateIssues("อ่าน{title}มาครับ ดีที่สุด", "article").includes("banned-word"));
  assert.equal(lineChatConfigSchema.safeParse(config({ sourceTemplates: { article: "อ่าน{tool}มาครับ", tool: "" } })).success, false);

  // Every default string written for this change passes the owner copy rules.
  for (const text of [LINE_CHAT_DEFAULT_SOURCE_TEMPLATES.article.replace("{title}", "ก"), LINE_CHAT_DEFAULT_SOURCE_TEMPLATES.tool.replace("{toolName}", "ก"), ...LINE_CHAT_ROUTES.flatMap((route) => "toolName" in route ? [route.toolName] : [])]) {
    assert.deepEqual(chatTextIssues(text, LINE_CHAT_LIMITS.sourceSentence), [], text);
    assert.doesNotMatch(text, /ฟรี|การันตี|ที่สุด|\p{Extended_Pictographic}|\.\.\.|…/u);
  }
});

test("Sanity contract: additive fields only, stable keys, projection and history round trip", () => {
  const schema = read("cms/sanity/schema/documents/line-chat-config.ts");
  // Every persisted name from the 2026-10-25 contract is still there (never renamed or removed).
  for (const name of ["lineChatConfig", "version", "enabled", "topics", "lineChatTopic", "topicId", "ref", "label", "prefill", "journey", "placements", "lineChatPlacement", "pageKey", "topicIds", "campaigns", "lineChatCampaign", "code", "refCode", "title", "campaignType", "startsAt", "endsAt", "reviewAt", "pageGroups", "pinnedTopicIds", "headline", "paused", "updatedAt", "updatedBy"]) {
    assert.match(schema, new RegExp(`name: "${name}"`), name);
  }
  for (const name of ["sourceTemplates", "article", "tool", "pageOverrides", "lineChatPageOverride", "targetKey", "sourceSentence", "hideSource", "lineChatOverrideTopic", "kind"]) assert.match(schema, new RegExp(`name: "${name}"`), name);
  assert.doesNotMatch(schema, /name: "(?:href|url|destination|oaId|lineId)"/);

  const source = config({ pageOverrides: [annuityOverride, { key: "page:ci-planning", title: "CI", enabled: false, hideSource: true, topics: [{ kind: "library", id: "ci-plan", sourceSentence: "ลองคำนวณแล้วครับ" }] }] });
  const fields = lineChatConfigToSanityFields(source);
  assert.equal(fields.sourceTemplates._type, "lineChatSourceTemplates");
  assert.equal(new Set(fields.pageOverrides.map((item) => item._key)).size, 2);
  assert.ok(fields.pageOverrides.every((item) => /^override-[a-z0-9-]+-[0-9a-f]{8}$/i.test(item._key)));
  assert.notEqual(lineChatConfigToSanityFields(config({ pageOverrides: [{ ...annuityOverride, key: "doc:a.b" }] })).pageOverrides[0]._key, lineChatConfigToSanityFields(config({ pageOverrides: [{ ...annuityOverride, key: "doc:a-b" }] })).pageOverrides[0]._key, "keys never collide after sanitizing");
  const defaultsWritten = lineChatConfigToSanityFields({ ...config(), sourceTemplates: undefined, pageOverrides: undefined });
  assert.equal(defaultsWritten.sourceTemplates.article, LINE_CHAT_DEFAULT_SOURCE_TEMPLATES.article, "a save always writes the templates explicitly");
  assert.deepEqual(defaultsWritten.pageOverrides, []);

  // Raw document (history API) -> runtime and the published GROQ projection shape -> runtime.
  const document = { _id: "ccpun-line-chat-v1", ...fields };
  const fromHistory = parseLineChatConfig(lineChatConfigFromDocument(document));
  assert.equal(fromHistory.source, "stored", JSON.stringify(fromHistory));
  assert.deepEqual(fromHistory.config.pageOverrides, source.pageOverrides);
  assert.deepEqual(fromHistory.config.sourceTemplates, LINE_CHAT_DEFAULT_SOURCE_TEMPLATES);
  const projected = {
    _rev: "r1", enabled: true,
    topics: fields.topics.map((topic) => ({ id: topic.topicId, ref: topic.ref, label: topic.label, prefill: topic.prefill, journey: topic.journey, enabled: topic.enabled })),
    placements: fields.placements.map((item) => ({ key: item.pageKey, topicIds: item.topicIds })),
    campaigns: null,
    sourceTemplates: { article: fields.sourceTemplates.article, tool: fields.sourceTemplates.tool },
    pageOverrides: fields.pageOverrides.map((item) => ({ key: item.targetKey, title: item.title, enabled: item.enabled, sourceSentence: "sourceSentence" in item ? item.sourceSentence : null, hideSource: "hideSource" in item ? item.hideSource : null, topics: item.topics.map((topic) => ({ kind: topic.kind, id: topic.topicId, label: "label" in topic ? topic.label : null, prefill: "prefill" in topic ? topic.prefill : null, sourceSentence: "sourceSentence" in topic ? topic.sourceSentence : null, hideSource: null })) })),
  };
  assert.deepEqual(parseLineChatConfig(lineChatConfigFromProjection(projected)).config.pageOverrides, source.pageOverrides);
  // A published document from before this change (no new fields) still parses.
  const before = { _rev: "r0", enabled: true, topics: projected.topics, placements: projected.placements, campaigns: [], sourceTemplates: null, pageOverrides: null };
  assert.equal(parseLineChatConfig(lineChatConfigFromProjection(before)).source, "stored");
  assert.match(read("lib/line/chat-config.ts"), /sourceTemplates\{article,tool\},"pageOverrides":pageOverrides\[\]\{"key":targetKey/);
});

test("Admin: draft then publish, owner-only, lane-guarded; only the UAT/Production lane of the deployment is written", () => {
  const service = read("lib/admin/line/chat-config.ts");
  // Every Sanity client in the service goes through the lane guards; writes need the mutation guard.
  assert.match(service, /function writeClient\(\) \{\n  const token = getAdminSanityWriteToken\(\);\n  if \(!baseClient \|\| !dataset \|\| !token \|\| !isAdminDataPlaneAllowed\(dataset\)\) return null;/);
  assert.match(service, /const allowed = write \? isAdminDataPlaneAllowed : isAdminReadDataPlaneAllowed;/);
  assert.match(service, /if \(!client \|\| !draftClient\) throw new Error\("LINE_CHAT_WRITE_UNAVAILABLE"\);/);
  assert.equal((service.match(/baseClient\.withConfig\(/g) ?? []).length, 3, "read, write and draft clients only");
  assert.doesNotMatch(service, /kyfxgjnq|ccb9lnw5|"production"|"uat"/, "no hard-coded project or dataset: the deployment's lane decides");
  // Save = draft; publish = validated draft -> published + draft delete in one revision-checked transaction.
  assert.match(service, /action: z\.literal\("draft"\)/);
  assert.match(service, /action: z\.literal\("publish"\)/);
  assert.match(service, /action: z\.literal\("discard"\)/);
  assert.doesNotMatch(service, /z\.object\(\{ revision: z\.string\(\)\.min\(1\)\.nullable\(\), config: z\.unknown\(\) \}\)/, "no direct publish that skips the draft");
  assert.match(service, /next = validNext\(lineChatConfigFromProjection\(draft\.runtime\), baseline\);/, "publish re-validates the stored draft");
  assert.match(service, /lineChatImmutabilityIssues\(baseline, next\)/);
  assert.match(service, /updatedBy: lineChatActorDigest\(actor\)/);
  assert.match(service, /"semanticTopic":seo\.semanticTopic/);
  assert.match(service, /chatContextForArticle\(path, \{ id, title: row\.title \}, topic\?\.slug\)/, "Admin preview uses the website's own article context");
  const route = read("apps/admin/app/api/admin/line/chat/route.ts");
  assert.match(route, /identity\.role !== "owner"/);
  assert.match(route, /isSameOriginAdminMutation/);
  assert.match(route, /status: result\.kind/);
  const ui = read("features/admin/line/LineChatManager.tsx");
  assert.match(ui, /put\(\{ action: "draft", revision: model\.revision, draftRevision: model\.draft\?\.revision \?\? null, config: working \}\)/);
  assert.match(ui, /put\(\{ action: "publish", revision: model\.revision, draftRevision \}\)/);
  assert.match(ui, /LINE_CHAT_LIMITS\.placementTopics/);
  assert.match(ui, /↑ ขึ้น/);
});

test("website: the dock for an annuity article fixture shows its per-page topics; analytics params unchanged", () => {
  const published = config({ pageOverrides: [annuityOverride, { ...annuityOverride, key: "doc:another-article", topics: [{ kind: "custom", id: "page-other1", label: "อื่น", prefill: "อื่นครับ" }] }] });
  // V5ChatDockServer: the page slice carries only this page's override and the templates.
  const slice = selectChatConfigForPage(published, annuityContext, NOW);
  assert.deepEqual(slice.pageOverrides?.map((item) => item.key), ["doc:article-annuity-tax"]);
  assert.ok(slice.topics.some((topic) => topic.id === "tax-deduction"));
  assert.deepEqual(slice.sourceTemplates, LINE_CHAT_DEFAULT_SOURCE_TEMPLATES);
  const fromSlice = panelOf(resolveChatPanel({ ...annuityContext, config: slice, now: NOW, consentGiven: false }));
  assert.deepEqual(fromSlice, panelOf(resolveChatPanel({ ...annuityContext, config: published, now: NOW, consentGiven: false })), "the browser resolves the same panel from its slice");
  assert.equal(fromSlice.topics[0].label, "สนใจประกันบำนาญ");
  assert.equal(fromSlice.pageGroup, "article", "analytics page_group stays the coarse token, never the article id or title");
  assert.ok(fromSlice.topics.every((topic) => topic.href.startsWith(OA_MESSAGE)));
  assert.equal(selectChatConfigForPage(published, chatContextForPath("/"), NOW).pageOverrides?.length, 0, "other pages never receive article overrides");

  const article = read("features/blog/v5/V5Article.tsx");
  assert.match(article, /const chatContext = chatContextForArticle\(path, article, topic\?\.slug\);/);
  assert.match(article, /getV5ChatFallbackHref\(chatContext\)/);
  assert.match(article, /<V5Page current=\{path\} chat=\{chatContext\}>/);
  // Analytics: same events and params; the message text and title never reach trackEvent.
  const panel = read("components/layout/v5/V5ChatPanel.tsx");
  assert.match(panel, /contact_channel: "line", cta_location: "chat_panel", chat_topic_id: topic\.id, page_group: panel\.pageGroup,/);
  assert.doesNotMatch(panel, /articleTitle|prefill:|topic\.prefill/);
  assert.match(read("lib/analytics.ts"), /chat_topic_id: \/\^\[a-z0-9\]\[a-z0-9-\]\{1,39\}\$\//, "page-only topic ids fit the existing chat_topic_id allowlist");
  assert.match("page-annuity1", /^[a-z0-9][a-z0-9-]{1,39}$/);
});

test("owner clarification 2026-10-26: the customer-visible message never contains anything code-like", () => {
  for (const sample of ["สนใจครับ (รหัส HM01)", "สนใจครับ รหัส AR05", "สนใจครับ HM01", "สนใจครับ ref: home", "สนใจครับ REF=1", "สนใจครับ #annuity", "สนใจครับ [AR05]", "สนใจครับ page-annuity1", "สนใจครับ chat_topic_id", "สนใจครับ id: 12", "สนใจ CS12 ครับ"]) {
    assert.equal(hasVisibleCode(sample), true, sample);
    assert.ok(chatTextIssues(sample, 300).includes("code"), sample);
  }
  for (const sample of ["สนใจประกันบำนาญครับ อ่านบทความเรื่องลดหย่อนภาษีด้วยประกันบำนาญมาครับ", "รพ.นี้อยู่ใน Smart Network ไหม", "ใช้เครื่องมือ Money Story มาครับ", "อ่านบทความเรื่อง AIA Health Happy คืออะไรมาครับ", "ลดหย่อนภาษี 2569 มีอะไรบ้าง", "ใช้เครื่องมือวางแผนกองทุน บลจ. เอไอเอ มาครับ"]) {
    assert.equal(hasVisibleCode(sample), false, sample);
  }
  // A template variable can never smuggle a code into the message: a code-like title drops the sentence.
  const codeTitle = chatContextForArticle("/blog/life-insurance/x/", { id: "x", title: "[อัปเดต] แผน HM01 ref: 2" }, null);
  assert.equal(messages(resolveChatPanel({ ...codeTitle, config: config(), now: NOW, consentGiven: false }))[0], "อยากให้ช่วยดูว่าทุนประกันชีวิตที่มีอยู่พอสำหรับครอบครัวไหมครับ");
  assert.equal(composeChatMessage("สนใจครับ", "อ่านเรื่องแผน AR05 มาครับ"), "สนใจครับ");
  assert.equal(composeChatMessage("สนใจครับ", "อ่านเรื่อง COVID-19 มาครับ"), "สนใจครับ อ่านเรื่อง COVID-19 มาครับ", "ordinary words with numbers stay");
  assert.equal(composeChatMessage("สนใจครับ (รหัส HM01)", ""), "สวัสดีครับ มีเรื่องอยากถาม", "even an unvalidated topic text cannot show a code");
  // Exhaustive: every route, the annuity article, Coming Soon, with and without a campaign.
  const everything = config({ campaigns: [tax], pageOverrides: [annuityOverride] });
  for (const context of [annuityContext, ...LINE_CHAT_ROUTES.map((route) => chatContextForPath(route.path)), { pageGroup: "coming_soon" }, { pageGroup: "category:health-insurance" }]) {
    for (const utmCampaign of [null, "tax-2611"]) {
      for (const message of messages(resolveChatPanel({ ...context, config: everything, utmCampaign, now: NOW, consentGiven: true }))) assert.equal(hasVisibleCode(message), false, message);
    }
  }
  // Defaults (topics, labels, templates, tool names) pass the same rule.
  for (const topic of LINE_CHAT_DEFAULTS.topics) assert.equal(hasVisibleCode(`${topic.label} ${topic.prefill}`), false, topic.id);
  const ui = read("features/admin/line/LineChatManager.tsx");
  assert.ok(ui.includes("ประโยคบอกที่มา (ไม่บังคับ)"));
  assert.ok(ui.includes("ข้อความที่ลูกค้าจะเห็นและส่งใน LINE"));
  assert.match(ui, /hasVisibleCode\(topic\.prefill\)/, "the preview checks the final customer-visible text");
});
