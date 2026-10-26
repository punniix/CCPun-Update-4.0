import { buildLineOaMessageHref, LINE_OA_CHAT_URL } from "./oa-link";

/**
 * LINE chat button system (owner-approved 2026-10-25, decisions L1-L9): the pure, dependency-free
 * half that ships to the browser. Types, shipped defaults and the panel resolver live here;
 * validation (zod) lives in ./chat-config.ts so the public bundle never carries it.
 *
 * The LINE destination is never part of the config: every link is built by ./oa-link.ts for @ccpun.
 */

export const LINE_CHAT_JOURNEYS = ["life_health", "motor", "investment", "human"] as const;
export type LineChatJourney = (typeof LINE_CHAT_JOURNEYS)[number];

/** Page groups with their own placement. Blog categories and articles use `category:<slug>` / `article:<slug>`. */
export const LINE_CHAT_FIXED_PAGE_GROUPS = [
  "home",
  "blog_index",
  "tool_ci",
  "tool_fhc",
  "tool_money_story",
  "tool_investment_allocation",
  "tools_hub",
  "about",
  // Coming Soon pages (owner-approved concept, 2026-10-25): one shared group; each planned page
  // adds its own code-fallback topic, so demand per page shows in its reference code.
  "coming_soon",
  "default",
] as const;
export type LineChatFixedPageGroup = (typeof LINE_CHAT_FIXED_PAGE_GROUPS)[number];

/** Safe analytics token for the page a panel is on (L5: `page_group`). */
export const LINE_CHAT_PAGE_GROUP_TOKENS = [...LINE_CHAT_FIXED_PAGE_GROUPS, "blog_category", "article"] as const;
export type LineChatPageGroupToken = (typeof LINE_CHAT_PAGE_GROUP_TOKENS)[number];

/** Where a campaign may apply: every page, a fixed group, all blog categories or all articles. */
export const LINE_CHAT_CAMPAIGN_TARGETS = ["all", ...LINE_CHAT_PAGE_GROUP_TOKENS] as const;
export type LineChatCampaignTarget = (typeof LINE_CHAT_CAMPAIGN_TARGETS)[number];

// Owner decision 2026-10-26: label up to 32 and message up to 300 visible characters (Thai vowel and
// tone marks do not count). The source sentence is a separate, shorter field.
export const LINE_CHAT_LIMITS = {
  label: 32,
  prefill: 300,
  sourceSentence: 120,
  sourceTitle: 60,
  headline: 60,
  title: 60,
  topics: 40,
  campaigns: 30,
  placementTopics: 4,
  pageOverrides: 200,
  overrideTitle: 200,
} as const;

export const LINE_CHAT_TYPE_OWN = {
  id: "type-own",
  label: "พิมพ์คำถามเอง",
  prefill: "สวัสดีครับ มีเรื่องอยากถาม",
} as const;

export const LINE_CHAT_DEFAULT_HEADLINE = "คุยกับปั้นทาง LINE";
export const LINE_CHAT_RESULT_TOPICS = { ci: "ci-result-chat", fhc: "fhc-result-chat" } as const;
export type LineChatResultTool = keyof typeof LINE_CHAT_RESULT_TOPICS;
export const LINE_CHAT_PANEL_NOTE = "กดแล้วจะเปิดแอป LINE พร้อมข้อความให้ กดส่งได้เลย";
export const LINE_CHAT_QR_LABEL = "สแกนเพื่อเปิด LINE";
export const LINE_CHAT_EVERGREEN_REVIEW_DAYS = 90;

export type LineChatTopic = {
  id: string;
  ref: number;
  label: string;
  prefill: string;
  journey: LineChatJourney;
  enabled: boolean;
};

export type LineChatPlacement = { key: string; topicIds: string[] };

/**
 * Natural "where I came from" sentence (owner decision 2026-10-26, replaces the "(รหัส XX)" suffix).
 * An empty template switches that kind off. Variables: {title} (article), {toolName} (tool page).
 */
export type LineChatSourceTemplates = { article: string; tool: string };
export const LINE_CHAT_SOURCE_VARIABLES: Record<keyof LineChatSourceTemplates, readonly string[]> = { article: ["title"], tool: ["toolName"] };
export const LINE_CHAT_DEFAULT_SOURCE_TEMPLATES: LineChatSourceTemplates = {
  article: "อ่านบทความเรื่อง{title}มาครับ",
  tool: "ใช้เครื่องมือ{toolName}มาครับ",
};

type SourceChoice = { sourceSentence?: string; hideSource?: boolean };

/** One topic of a per-page override: a library topic (by id) or a page-only topic with its own text. */
export type LineChatOverrideTopic =
  | ({ kind: "library"; id: string } & SourceChoice)
  | ({ kind: "custom"; id: string; label: string; prefill: string } & SourceChoice);

/**
 * Per-page override (layer 3): `doc:<logical Sanity article id>` or `page:<route key>`. `title` is the
 * Admin display name only; the website always uses the live article title.
 */
export type LineChatPageOverride = {
  key: string;
  title: string;
  enabled: boolean;
  topics: LineChatOverrideTopic[];
} & SourceChoice;

/** Site pages and tools with a stable route key (per-page overrides and the tool source sentence). */
export const LINE_CHAT_ROUTES = [
  { key: "home", path: "/", group: "home", label: "หน้าแรก" },
  { key: "blog", path: "/blog/", group: "blog_index", label: "หน้ารวมบทความ" },
  { key: "tools", path: "/tools/", group: "tools_hub", label: "หน้ารวมเครื่องมือ" },
  { key: "ci-planning", path: "/ci-planning/", group: "tool_ci", label: "วางแผนเงินก้อนโรคร้ายแรง", toolName: "วางแผนเงินก้อนโรคร้ายแรง" },
  { key: "financial-health-check", path: "/tools/financial-health-check/", group: "tool_fhc", label: "ตรวจสุขภาพการเงิน", toolName: "ตรวจสุขภาพการเงิน" },
  { key: "money-story", path: "/play/money-story/", group: "tool_money_story", label: "Money Story", toolName: "Money Story" },
  { key: "investment-allocation", path: "/tools/investment-allocation/", group: "tool_investment_allocation", label: "วางแผนกองทุน", toolName: "วางแผนกองทุน" },
  // บลจ. เอไอเอ fund tool (2026-10-26): same engine, so the same page group and "tools" surface as the main tool.
  { key: "aia-fund-allocation", path: "/tools/aia-fund-allocation/", group: "tool_investment_allocation", label: "กองทุน บลจ. เอไอเอ", toolName: "วางแผนกองทุน บลจ. เอไอเอ" },
  // The /about/ page (owner-approved new URL 2026-10-25) uses its own shipped "about" placement.
  { key: "about", path: "/about/", group: "about", label: "เกี่ยวกับปั้น" },
] as const satisfies readonly { key: string; path: string; group: LineChatFixedPageGroup; label: string; toolName?: string }[];
export type LineChatRouteKey = (typeof LINE_CHAT_ROUTES)[number]["key"];

export const LINE_CHAT_OVERRIDE_KEY = /^(?:doc:[A-Za-z0-9][A-Za-z0-9._-]{0,127}|page:[a-z0-9][a-z0-9-]{1,39})$/;

/** Logical Sanity document id (no drafts./versions. prefix), or undefined when it is not a usable id. */
export function logicalArticleId(id: string | null | undefined): string | undefined {
  const value = id?.trim().replace(/^drafts\./, "").replace(/^versions\.[^.]+\./, "");
  return value && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) ? value : undefined;
}

export type LineChatCampaign = {
  code: string;
  refCode: string;
  title: string;
  type: "temporary" | "evergreen";
  startsAt?: string;
  endsAt?: string;
  reviewAt?: string;
  pageGroups: LineChatCampaignTarget[];
  pinnedTopicIds: string[];
  headline?: string;
  paused: boolean;
};

export type LineChatConfig = {
  enabled: boolean;
  topics: LineChatTopic[];
  placements: LineChatPlacement[];
  campaigns: LineChatCampaign[];
  /** Added 2026-10-26; a stored config without it uses LINE_CHAT_DEFAULT_SOURCE_TEMPLATES. */
  sourceTemplates?: LineChatSourceTemplates;
  /** Added 2026-10-26 (layer 3, most specific). */
  pageOverrides?: LineChatPageOverride[];
};

/** Shipped defaults (L1: drafted for every page group; the owner edits them later in Admin). */
export const LINE_CHAT_DEFAULTS: LineChatConfig = {
  enabled: true,
  topics: [
    { id: "check-existing-policy", ref: 1, label: "เช็กประกันที่มีอยู่", prefill: "อยากให้ช่วยดูประกันที่มีอยู่ ว่าคุ้มครองพอหรือยังครับ", journey: "life_health", enabled: true },
    { id: "health-plan", ref: 2, label: "วางแผนประกันสุขภาพ", prefill: "อยากวางแผนประกันสุขภาพครับ ช่วยแนะนำหน่อย", journey: "life_health", enabled: true },
    { id: "tax-deduction", ref: 3, label: "ลดหย่อนภาษีปีนี้", prefill: "อยากคุยเรื่องลดหย่อนภาษีปีนี้ครับ", journey: "investment", enabled: true },
    { id: "smart-network-hospital", ref: 4, label: "รพ.นี้อยู่ใน Smart Network ไหม", prefill: "อยากเช็กว่าโรงพยาบาลที่ใช้ประจำอยู่ใน Smart Network ไหมครับ", journey: "life_health", enabled: true },
    { id: "which-plan-fits", ref: 5, label: "แผนไหนเหมาะกับฉัน", prefill: "ช่วยดูหน่อยครับ ว่าแผนประกันสุขภาพแบบไหนเหมาะกับตัวเอง", journey: "life_health", enabled: true },
    { id: "ci-result-chat", ref: 6, label: "ขอคุยเรื่องผลที่คำนวณได้", prefill: "เพิ่งลองคำนวณทุนโรคร้ายแรงบนเว็บ อยากคุยต่อเรื่องผลที่ได้ครับ", journey: "life_health", enabled: true },
    { id: "ci-plan", ref: 7, label: "ขอดูแผนคุ้มครองโรคร้าย", prefill: "อยากดูแผนคุ้มครองโรคร้ายแรงที่เหมาะกับตัวเองครับ", journey: "life_health", enabled: true },
    { id: "book-a-chat", ref: 8, label: "ขอนัดคุยกับปั้น", prefill: "อยากนัดคุยกับปั้นครับ สะดวกช่วงไหนบ้าง", journey: "human", enabled: true },
    { id: "fhc-result-chat", ref: 9, label: "คุยต่อเรื่องผลตรวจการเงิน", prefill: "เพิ่งลองตรวจสุขภาพการเงินบนเว็บ อยากคุยต่อครับ", journey: "life_health", enabled: true },
    { id: "life-cover", ref: 10, label: "ทุนประกันชีวิตพอไหม", prefill: "อยากให้ช่วยดูว่าทุนประกันชีวิตที่มีอยู่พอสำหรับครอบครัวไหมครับ", journey: "life_health", enabled: true },
    { id: "investment-before", ref: 11, label: "ก่อนลงทุนเพิ่ม ขอเช็กก่อน", prefill: "กำลังจะลงทุนเพิ่ม อยากให้ช่วยดูก่อนครับ", journey: "investment", enabled: true },
    { id: "fund-allocation", ref: 12, label: "คุยเรื่องจัดพอร์ตกองทุน", prefill: "ลองจัดพอร์ตกองทุนบนเว็บแล้ว อยากคุยต่อครับ", journey: "investment", enabled: true },
    { id: "motor-quote", ref: 13, label: "ช่วยดูใบเสนอราคาประกันรถ", prefill: "มีใบเสนอราคาประกันรถอยู่ อยากให้ช่วยดูครับ", journey: "motor", enabled: true },
    { id: "money-plan", ref: 14, label: "อยากเริ่มวางแผนการเงิน", prefill: "อยากเริ่มวางแผนการเงินครับ ยังไม่แน่ใจว่าควรเริ่มตรงไหน", journey: "human", enabled: true },
  ],
  placements: [
    { key: "home", topicIds: ["check-existing-policy", "health-plan", "tax-deduction"] },
    { key: "blog_index", topicIds: ["check-existing-policy", "health-plan", "money-plan"] },
    { key: "category:health-insurance", topicIds: ["smart-network-hospital", "which-plan-fits", "check-existing-policy"] },
    { key: "category:life-insurance", topicIds: ["life-cover", "check-existing-policy", "tax-deduction"] },
    { key: "category:critical-illness-insurance", topicIds: ["ci-plan", "check-existing-policy"] },
    { key: "category:investment", topicIds: ["investment-before", "fund-allocation", "tax-deduction"] },
    { key: "category:personal-finance", topicIds: ["money-plan", "tax-deduction", "check-existing-policy"] },
    { key: "category:motor-insurance", topicIds: ["motor-quote", "check-existing-policy"] },
    { key: "tool_ci", topicIds: ["ci-result-chat", "ci-plan"] },
    { key: "tool_fhc", topicIds: ["fhc-result-chat", "life-cover", "check-existing-policy"] },
    { key: "tool_money_story", topicIds: ["money-plan", "check-existing-policy"] },
    { key: "tool_investment_allocation", topicIds: ["fund-allocation", "investment-before"] },
    { key: "tools_hub", topicIds: ["check-existing-policy", "money-plan", "ci-plan"] },
    { key: "about", topicIds: ["book-a-chat", "check-existing-policy"] },
    { key: "default", topicIds: ["check-existing-policy", "health-plan", "book-a-chat"] },
  ],
  campaigns: [],
  sourceTemplates: LINE_CHAT_DEFAULT_SOURCE_TEMPLATES,
  pageOverrides: [],
};

const SLUG = /^[a-z0-9][a-z0-9-]{0,95}$/;
export const LINE_CHAT_PLACEMENT_KEY = /^(?:home|blog_index|tool_ci|tool_fhc|tool_money_story|tool_investment_allocation|tools_hub|about|coming_soon|default|category:[a-z0-9][a-z0-9-]{0,95}|article:[a-z0-9][a-z0-9-]{0,95})$/;

export type ChatPageContext = {
  /** A fixed group, or `category:<slug>` (physical URL segment) on blog category and article pages. */
  pageGroup: string;
  articleSlug?: string;
  /** Logical Sanity document id of the article: the per-page override key `doc:<id>`. */
  articleId?: string;
  /** Live article title, used only inside the visitor's LINE message, never in analytics. */
  articleTitle?: string;
  /** Semantic topic slug (lib/content/taxonomy.ts); its category placement is tried before the physical one. */
  topicSlug?: string;
  /** Stable route key of a site page or tool (LINE_CHAT_ROUTES): the per-page override key `page:<key>`. */
  routeKey?: string;
};

export function chatPageGroupToken({ pageGroup, articleSlug }: ChatPageContext): LineChatPageGroupToken {
  if (articleSlug) return "article";
  if (pageGroup.startsWith("category:")) return "blog_category";
  return (LINE_CHAT_FIXED_PAGE_GROUPS as readonly string[]).includes(pageGroup) ? pageGroup as LineChatFixedPageGroup : "default";
}

/**
 * Placement lookup order for a page: an older `article:<slug>` placement, the semantic topic's
 * category, the physical category (or fixed group), then default.
 */
export function chatPlacementKeys({ pageGroup, articleSlug, topicSlug }: ChatPageContext): string[] {
  const keys: string[] = [];
  if (articleSlug && SLUG.test(articleSlug)) keys.push(`article:${articleSlug}`);
  if (topicSlug && SLUG.test(topicSlug) && `category:${topicSlug}` !== pageGroup) keys.push(`category:${topicSlug}`);
  if (LINE_CHAT_PLACEMENT_KEY.test(pageGroup) && pageGroup !== "default") keys.push(pageGroup);
  keys.push("default");
  return keys;
}

/** Per-page override key for this page (`doc:<id>` on articles, `page:<route>` on site pages and tools). */
export function chatOverrideKey({ articleId, routeKey }: ChatPageContext): string | undefined {
  const id = logicalArticleId(articleId);
  const key = id ? `doc:${id}` : routeKey ? `page:${routeKey}` : undefined;
  return key && LINE_CHAT_OVERRIDE_KEY.test(key) ? key : undefined;
}

export function chatPageOverride(config: LineChatConfig, context: ChatPageContext): LineChatPageOverride | undefined {
  const key = chatOverrideKey(context);
  return key ? config.pageOverrides?.find((override) => override.key === key && override.enabled) : undefined;
}

export function isCampaignActive(campaign: LineChatCampaign, now: Date): boolean {
  if (campaign.paused) return false;
  const time = now.getTime();
  const start = campaign.startsAt ? Date.parse(campaign.startsAt) : Number.NEGATIVE_INFINITY;
  if (!(time >= start)) return false;
  if (campaign.type === "temporary") return Boolean(campaign.endsAt) && time < Date.parse(campaign.endsAt!);
  return true;
}

export function campaignAppliesTo(campaign: LineChatCampaign, token: LineChatPageGroupToken): boolean {
  return campaign.pageGroups.includes("all") || campaign.pageGroups.includes(token);
}

const UTM_TOKEN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function normalizeUtmCampaign(value: string | null | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized && UTM_TOKEN.test(normalized) ? normalized : undefined;
}

export type ResolveChatPanelInput = ChatPageContext & {
  config?: LineChatConfig;
  /** A result CTA passes a bounded tool token only, never calculator answers or result values. */
  resultTool?: LineChatResultTool;
  /** utm_campaign on the current URL (this page view only). */
  utmCampaign?: string | null;
  /** First-touch utm_campaign from lib/acquisition.ts; only used when analytics consent is given (L3). */
  storedUtmCampaign?: string | null;
  now: Date;
  consentGiven: boolean;
};

export type ChatPanelTopic = {
  id: string;
  label: string;
  journey: LineChatJourney | "type_own" | "page";
  /** The whole message LINE puts in the chat box: the topic text plus the natural source sentence. */
  prefill: string;
  href: string;
};

export type ChatPanelSource = "campaign-utm" | "campaign-temporary" | "page-override" | "placement" | "default";
/** Which layer supplied the page's own topics (a campaign may still pin topics above them). */
export type ChatPanelLayer = "page" | "category" | "group" | "default";

export type ChatPanel =
  | { mode: "plain"; href: string; pageGroup: LineChatPageGroupToken }
  | {
      mode: "panel";
      headline: string;
      note: string;
      topics: ChatPanelTopic[];
      pageGroup: LineChatPageGroupToken;
      campaignCode?: string;
      source: ChatPanelSource;
      layer: ChatPanelLayer;
    };

/** Visible character count; Thai vowel and tone marks do not count as extra characters. */
export function countChatCharacters(value: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    let count = 0;
    for (const _ of new Intl.Segmenter("th", { granularity: "grapheme" }).segment(value)) count += 1;
    return count;
  }
  return Array.from(value).length;
}

function graphemes(value: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) return Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(value), (part) => part.segment);
  return Array.from(value);
}

const THAI = /[\u0E00-\u0E7F]/;
const LATIN_OR_DIGIT = /[A-Za-z0-9]/;

/** A space between Thai and Latin/digit text where two pieces meet ("ใช้เครื่องมือ Money Story มาครับ"). */
function joinNatural(before: string, value: string): string {
  const a = before.slice(-1), b = value.slice(0, 1);
  if (!a || !b || /\s/.test(a) || /\s/.test(b)) return before + value;
  const mixed = (THAI.test(a) && LATIN_OR_DIGIT.test(b)) || (LATIN_OR_DIGIT.test(a) && THAI.test(b));
  return mixed ? `${before} ${value}` : before + value;
}

/**
 * Article title as it reads inside the visitor's message: the part before "?", ":", "|" or a dash,
 * at most 60 visible characters cut at a space, no ellipsis, no emoji or markup characters.
 */
export function chatSourceTitle(title: string | null | undefined): string {
  let text = (title ?? "").replace(/<[^>]*>/g, " ").replace(/\p{Extended_Pictographic}/gu, "").replace(/[<>{}#[\]]/g, " ").replace(/\s+/g, " ").trim();
  const cut = text.search(/\s*(?:[?:|？]|\s[–—-]\s)/);
  if (cut > 0) text = text.slice(0, cut).trim();
  const parts = graphemes(text);
  if (parts.length > LINE_CHAT_LIMITS.sourceTitle) {
    let head = parts.slice(0, LINE_CHAT_LIMITS.sourceTitle).join("");
    const space = head.lastIndexOf(" ");
    if (space >= 20) head = head.slice(0, space);
    text = head.trim();
  }
  return text;
}

/** Fills a source template; unknown variables or an empty value give no sentence. */
export function fillChatSourceTemplate(template: string, values: Record<string, string | undefined>): string {
  const pieces = template.trim().split(/(\{[A-Za-z]+\})/);
  let out = "";
  for (const piece of pieces) {
    const variable = /^\{([A-Za-z]+)\}$/.exec(piece)?.[1];
    if (!variable) { out = joinNatural(out, piece); continue; }
    const value = values[variable]?.trim();
    if (!value) return "";
    out = joinNatural(out, value);
  }
  return out.replace(/\s+/g, " ").trim();
}

function routeFor(key: string | undefined) {
  return key ? LINE_CHAT_ROUTES.find((route) => route.key === key) : undefined;
}

/** The page's own source sentence from the owner's template (articles and tools only). */
export function chatTemplateSentence(context: ChatPageContext, templates: LineChatSourceTemplates = LINE_CHAT_DEFAULT_SOURCE_TEMPLATES): string {
  if (context.articleSlug || context.articleId) {
    const title = chatSourceTitle(context.articleTitle);
    return title ? fillChatSourceTemplate(templates.article, { title }) : "";
  }
  const route = routeFor(context.routeKey);
  const toolName = route && "toolName" in route ? route.toolName : undefined;
  return toolName ? fillChatSourceTemplate(templates.tool, { toolName }) : "";
}

/** Topic choice, then page choice, then the template: a custom sentence replaces it, hideSource drops it. */
export function chatSourceSentence(templateSentence: string, page?: SourceChoice, topic?: SourceChoice): string {
  for (const choice of [topic, page]) {
    if (!choice) continue;
    if (choice.hideSource) return "";
    if (choice.sourceSentence?.trim()) return choice.sourceSentence.trim();
  }
  return templateSentence;
}

/**
 * Owner decision 2026-10-26: the message the customer sends must contain nothing that reads like a
 * code ("(รหัส HM01)", "HM01", "ref:", "#", "[...]", ids such as "page-annuity1" or "chat_topic_id").
 * Topic, page and campaign attribution stays in the consent-gated analytics params only.
 */
export const LINE_CHAT_VISIBLE_CODE_PATTERNS: readonly RegExp[] = [
  /\(\s*รหัส/,
  /รหัส\s*[A-Za-z]{1,4}\s*-?\d/,
  /(?<![A-Za-z])[A-Z]{1,4}-?\d{1,4}(?!\d)/,
  /\b(?:ref|id|code|utm|topic|campaign)\s*[:=#]/i,
  /[#[\]]/,
  /\b(?=[a-z0-9_-]*[a-z])[a-z0-9]+(?:[-_][a-z0-9]+)+\b/,
];

export function hasVisibleCode(text: string): boolean {
  return LINE_CHAT_VISIBLE_CODE_PATTERNS.some((pattern) => pattern.test(text));
}

/** Last resort when even a topic's own text would show a code (it cannot pass Admin validation). */
const SAFE_MESSAGE = "สวัสดีครับ มีเรื่องอยากถาม";

/**
 * The message LINE pre-fills: topic text, then the natural source sentence. A sentence that would
 * put anything code-like in the message (for example from an article title) is dropped, so the
 * final text never shows a code.
 */
export function composeChatMessage(prefill: string, sourceSentence: string): string {
  const text = prefill.trim();
  const sentence = sourceSentence.trim();
  const composed = sentence ? `${text} ${sentence}` : text;
  if (!hasVisibleCode(composed)) return composed;
  return hasVisibleCode(text) ? SAFE_MESSAGE : text;
}

type BaseTopic = { id: string; label: string; prefill: string; journey: ChatPanelTopic["journey"]; source?: SourceChoice };

function panelTopic(topic: BaseTopic, templateSentence: string, page?: SourceChoice): ChatPanelTopic {
  const prefill = composeChatMessage(topic.prefill, chatSourceSentence(templateSentence, page, topic.source));
  return { id: topic.id, label: topic.label, journey: topic.journey, prefill, href: buildLineOaMessageHref(prefill) };
}

function layerOfKey(key: string): ChatPanelLayer {
  if (key === "default") return "default";
  if (key.startsWith("article:")) return "page";
  if (key.startsWith("category:")) return "category";
  return "group";
}

/**
 * Pure panel resolver (owner decision 2026-10-26, most specific wins):
 *   campaign pin > per-page override > category (semantic topic, then physical) > site default.
 * A campaign (named by utm_campaign, else the latest-started active temporary one for this page
 * group) only pins its topics above the page's own list. The page's own list comes from its
 * per-page override, else its placements (category, fixed group), else the default placement.
 * "พิมพ์คำถามเอง" is always appended. Every message is the topic text plus one natural source
 * sentence; no codes are ever shown (topic, page group and campaign stay in analytics params only).
 * A campaign follows the visitor to later pages only when analytics consent is given (L3).
 */
export function resolveChatPanel(input: ResolveChatPanelInput): ChatPanel {
  const config = input.config ?? LINE_CHAT_DEFAULTS;
  const token = chatPageGroupToken(input);
  if (!config.enabled) return { mode: "plain", href: LINE_OA_CHAT_URL, pageGroup: token };

  const topics = new Map(config.topics.filter((topic) => topic.enabled).map((topic) => [topic.id, topic] as const));
  const campaignCode = normalizeUtmCampaign(input.utmCampaign) ?? (input.consentGiven ? normalizeUtmCampaign(input.storedUtmCampaign) : undefined);
  const live = config.campaigns.filter((campaign) => isCampaignActive(campaign, input.now) && campaignAppliesTo(campaign, token));
  let campaign = campaignCode ? live.find((candidate) => candidate.code === campaignCode) : undefined;
  let source: ChatPanelSource = campaign ? "campaign-utm" : "placement";
  if (!campaign) {
    campaign = live
      .filter((candidate) => candidate.type === "temporary")
      .sort((a, b) => Date.parse(b.startsAt ?? "") - Date.parse(a.startsAt ?? ""))[0];
    if (campaign) source = "campaign-temporary";
  }

  const fromLibrary = (id: string, choice?: SourceChoice): BaseTopic | undefined => {
    const topic = topics.get(id);
    return topic ? { id: topic.id, label: topic.label, prefill: topic.prefill, journey: topic.journey, source: choice } : undefined;
  };

  let layer: ChatPanelLayer = "default";
  let base: BaseTopic[] = [];
  const override = chatPageOverride(config, input);
  if (override) {
    base = override.topics.flatMap((item) => {
      if (item.kind === "library") return fromLibrary(item.id, item) ?? [];
      return [{ id: item.id, label: item.label, prefill: item.prefill, journey: "page" as const, source: item }];
    });
    if (base.length) {
      layer = "page";
      if (!campaign) source = "page-override";
    }
  }
  if (!base.length) {
    for (const key of chatPlacementKeys(input)) {
      const ids = config.placements.find((placement) => placement.key === key)?.topicIds.filter((id) => topics.has(id)) ?? [];
      if (ids.length) {
        base = ids.map((id) => fromLibrary(id)!);
        layer = layerOfKey(key);
        if (!campaign && key === "default") source = "default";
        break;
      }
    }
  }

  const resultId = input.resultTool === "ci" && token === "tool_ci" ? LINE_CHAT_RESULT_TOPICS.ci
    : input.resultTool === "fhc" && token === "tool_fhc" ? LINE_CHAT_RESULT_TOPICS.fhc : undefined;
  const resultTopic = resultId ? fromLibrary(resultId) : undefined;
  const pinned = campaign?.pinnedTopicIds.flatMap((id) => fromLibrary(id) ?? []) ?? [];
  const seen = new Set<string>();
  let selected = [...(resultTopic ? [resultTopic] : []), ...pinned, ...base].filter((topic) => !seen.has(topic.id) && Boolean(seen.add(topic.id))).slice(0, LINE_CHAT_LIMITS.placementTopics);
  if (!selected.length) {
    // A config whose every topic is unusable for this page still gets the shipped default set.
    const fallback = new Map(LINE_CHAT_DEFAULTS.topics.map((topic) => [topic.id, topic] as const));
    selected = LINE_CHAT_DEFAULTS.placements.find((placement) => placement.key === "default")!.topicIds.map((id) => fallback.get(id)!);
    source = "default";
    layer = "default";
    campaign = undefined;
  }

  const templateSentence = chatTemplateSentence(input, config.sourceTemplates ?? LINE_CHAT_DEFAULT_SOURCE_TEMPLATES);
  // Result CTAs require their tool origin even when a generic page choice hides the source sentence.
  const resultSource = resultTopic ? templateSentence || chatTemplateSentence(input) : templateSentence;
  const pageChoice = layer === "page" ? override : undefined;
  return {
    mode: "panel",
    headline: campaign?.headline?.trim() || LINE_CHAT_DEFAULT_HEADLINE,
    note: LINE_CHAT_PANEL_NOTE,
    topics: [
      ...selected.map((topic) => topic.id === resultTopic?.id ? panelTopic(topic, resultSource) : panelTopic(topic, templateSentence, pageChoice)),
      panelTopic({ ...LINE_CHAT_TYPE_OWN, journey: "type_own" }, templateSentence, pageChoice),
    ],
    pageGroup: token,
    ...(campaign ? { campaignCode: campaign.code } : {}),
    source,
    layer,
  };
}

/**
 * The slice of the config a page needs, so the browser never receives other pages' placements,
 * overrides or campaigns that cannot apply there. Ended temporary campaigns are dropped; future
 * ones stay so a cached page still switches on time.
 */
export function selectChatConfigForPage(config: LineChatConfig, context: ChatPageContext, now: Date): LineChatConfig {
  const token = chatPageGroupToken(context);
  const keys = new Set(chatPlacementKeys(context));
  const placements = config.placements.filter((placement) => keys.has(placement.key));
  const override = chatPageOverride(config, context);
  const campaigns = config.campaigns.filter((campaign) => !campaign.paused && campaignAppliesTo(campaign, token)
    && !(campaign.type === "temporary" && campaign.endsAt && Date.parse(campaign.endsAt) <= now.getTime()));
  const used = new Set([
    ...(token === "tool_ci" ? [LINE_CHAT_RESULT_TOPICS.ci] : token === "tool_fhc" ? [LINE_CHAT_RESULT_TOPICS.fhc] : []),
    ...placements.flatMap((placement) => placement.topicIds),
    ...campaigns.flatMap((campaign) => campaign.pinnedTopicIds),
    ...(override?.topics.flatMap((item) => item.kind === "library" ? [item.id] : []) ?? []),
  ]);
  return {
    enabled: config.enabled,
    topics: config.topics.filter((topic) => topic.enabled && used.has(topic.id)),
    placements,
    campaigns,
    sourceTemplates: config.sourceTemplates ?? LINE_CHAT_DEFAULT_SOURCE_TEMPLATES,
    pageOverrides: override ? [override] : [],
  };
}

/**
 * Code fallback for one page-specific topic (Coming Soon, 2026-10-25; Sanity is never written).
 * The owner's published config stays authoritative: an owner topic with the same id wins (and
 * stays disabled if the owner disabled it), and an owner placement for `placementKey` keeps its
 * topics after this one. Without an owner placement the page offers this topic plus "book-a-chat".
 */
export function withPageTopic(config: LineChatConfig, placementKey: string, topic: LineChatTopic): LineChatConfig {
  if (!config.enabled || !LINE_CHAT_PLACEMENT_KEY.test(placementKey)) return config;
  const topics = config.topics.some((candidate) => candidate.id === topic.id) ? config.topics : [...config.topics, topic];
  const base = config.placements.find((placement) => placement.key === placementKey)?.topicIds ?? ["book-a-chat"];
  const topicIds = [topic.id, ...base.filter((id) => id !== topic.id)].slice(0, LINE_CHAT_LIMITS.placementTopics);
  return { ...config, topics, placements: [...config.placements.filter((placement) => placement.key !== placementKey), { key: placementKey, topicIds }] };
}

/** Safe surface_group for line_oa_click, only where an approved value already exists. */
export function chatSurfaceGroup(token: LineChatPageGroupToken): string | undefined {
  switch (token) {
    case "home": return "homepage";
    case "blog_index": case "blog_category": case "article": return "blog";
    case "tool_ci": return "ci_planning";
    case "tool_fhc": return "fhc";
    case "tool_money_story": return "money_story";
    case "tool_investment_allocation": case "tools_hub": return "tools";
    default: return undefined;
  }
}

const ROUTE_BY_PATH = new Map<string, (typeof LINE_CHAT_ROUTES)[number]>(LINE_CHAT_ROUTES.map((route) => [route.path, route] as const));

/** Page group (and route key) for a v5 page from its physical path (blog categories and articles by URL segment). */
export function chatContextForPath(path: string | undefined): ChatPageContext {
  if (!path) return { pageGroup: "default" };
  const route = ROUTE_BY_PATH.get(path);
  if (route) return { pageGroup: route.group, routeKey: route.key };
  const blog = /^\/blog\/([a-z0-9][a-z0-9-]{0,95})\/(?:([a-z0-9][a-z0-9-]{0,95})\/)?$/.exec(path);
  if (blog) return blog[2] ? { pageGroup: `category:${blog[1]}`, articleSlug: blog[2] } : { pageGroup: `category:${blog[1]}` };
  return { pageGroup: "default" };
}

/** SSR/not-yet-hydrated result fallback: approved generic intent and tool origin, never user values. */
export function resultChatHref(tool: LineChatResultTool): string {
  const context = chatContextForPath(tool === "ci" ? "/ci-planning/" : "/tools/financial-health-check/");
  const topic = LINE_CHAT_DEFAULTS.topics.find(topic => topic.id === LINE_CHAT_RESULT_TOPICS[tool])!;
  return buildLineOaMessageHref(composeChatMessage(topic.prefill, chatTemplateSentence(context)));
}

/** Full chat context of an article page: its path groups plus id, live title and semantic topic. */
export function chatContextForArticle(path: string, article: { id?: string | null; title?: string | null }, topicSlug?: string | null): ChatPageContext {
  const id = logicalArticleId(article.id);
  return {
    ...chatContextForPath(path),
    ...(id ? { articleId: id } : {}),
    ...(article.title?.trim() ? { articleTitle: article.title.trim() } : {}),
    ...(topicSlug ? { topicSlug } : {}),
  };
}
