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

/** Short readable prefix for the reference code appended to every prefill, e.g. "(รหัส HM03)". */
export const LINE_CHAT_REF_PREFIX: Record<LineChatPageGroupToken, string> = {
  home: "HM",
  blog_index: "BL",
  blog_category: "BC",
  article: "AR",
  tool_ci: "CI",
  tool_fhc: "FH",
  tool_money_story: "MS",
  tool_investment_allocation: "IA",
  tools_hub: "TL",
  about: "AB",
  coming_soon: "CS",
  default: "DF",
};

export const LINE_CHAT_LIMITS = {
  label: 28,
  prefill: 120,
  headline: 60,
  title: 60,
  topics: 40,
  campaigns: 30,
  placementTopics: 4,
} as const;

export const LINE_CHAT_TYPE_OWN = {
  id: "type-own",
  label: "พิมพ์คำถามเอง",
  prefill: "สวัสดีครับ มีเรื่องอยากถาม",
} as const;

export const LINE_CHAT_DEFAULT_HEADLINE = "คุยกับปั้นทาง LINE";
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
};

const SLUG = /^[a-z0-9][a-z0-9-]{0,95}$/;
export const LINE_CHAT_PLACEMENT_KEY = /^(?:home|blog_index|tool_ci|tool_fhc|tool_money_story|tool_investment_allocation|tools_hub|about|coming_soon|default|category:[a-z0-9][a-z0-9-]{0,95}|article:[a-z0-9][a-z0-9-]{0,95})$/;

export type ChatPageContext = {
  /** A fixed group, or `category:<slug>` on blog category and article pages. */
  pageGroup: string;
  articleSlug?: string;
};

export function chatPageGroupToken({ pageGroup, articleSlug }: ChatPageContext): LineChatPageGroupToken {
  if (articleSlug) return "article";
  if (pageGroup.startsWith("category:")) return "blog_category";
  return (LINE_CHAT_FIXED_PAGE_GROUPS as readonly string[]).includes(pageGroup) ? pageGroup as LineChatFixedPageGroup : "default";
}

/** Placement lookup order for a page: article override, then its group (or category), then default. */
export function chatPlacementKeys({ pageGroup, articleSlug }: ChatPageContext): string[] {
  const keys: string[] = [];
  if (articleSlug && SLUG.test(articleSlug)) keys.push(`article:${articleSlug}`);
  if (LINE_CHAT_PLACEMENT_KEY.test(pageGroup) && pageGroup !== "default") keys.push(pageGroup);
  keys.push("default");
  return keys;
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
  journey: LineChatJourney | "type_own";
  refCode: string;
  prefill: string;
  href: string;
};

export type ChatPanelSource = "campaign-utm" | "campaign-temporary" | "placement" | "default";

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
    };

/** "(รหัส SN11)": a short code a person can read, so ปั้น sees the campaign or page and the topic. */
export function chatReferenceCode(prefix: string, ref: number): string {
  return `${prefix}${String(ref).padStart(2, "0")}`;
}

function panelTopic(topic: Pick<LineChatTopic, "id" | "label" | "prefill" | "ref"> & { journey: ChatPanelTopic["journey"] }, prefix: string): ChatPanelTopic {
  const refCode = chatReferenceCode(prefix, topic.ref);
  const prefill = `${topic.prefill.trim()} (รหัส ${refCode})`;
  return { id: topic.id, label: topic.label, journey: topic.journey, refCode, prefill, href: buildLineOaMessageHref(prefill) };
}

/**
 * Pure panel resolver. Precedence: (1) the campaign named by utm_campaign, (2) the latest-started
 * active temporary campaign for this page group, (3) the page placement (article override,
 * category, fixed group), (4) the default placement. "พิมพ์คำถามเอง" is always appended.
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

  let placementIds: string[] = [];
  for (const key of chatPlacementKeys(input)) {
    const ids = config.placements.find((placement) => placement.key === key)?.topicIds.filter((id) => topics.has(id)) ?? [];
    if (ids.length) {
      placementIds = ids;
      if (!campaign && key === "default") source = "default";
      break;
    }
  }

  const orderedIds = [...(campaign?.pinnedTopicIds.filter((id) => topics.has(id)) ?? []), ...placementIds];
  let selected = [...new Set(orderedIds)].slice(0, LINE_CHAT_LIMITS.placementTopics).map((id) => topics.get(id)!);
  if (!selected.length) {
    // A config whose every topic is unusable for this page still gets the shipped default set.
    const fallback = new Map(LINE_CHAT_DEFAULTS.topics.map((topic) => [topic.id, topic] as const));
    selected = LINE_CHAT_DEFAULTS.placements.find((placement) => placement.key === "default")!.topicIds.map((id) => fallback.get(id)!);
    source = "default";
    campaign = undefined;
  }

  const prefix = campaign?.refCode ?? LINE_CHAT_REF_PREFIX[token];
  return {
    mode: "panel",
    headline: campaign?.headline?.trim() || LINE_CHAT_DEFAULT_HEADLINE,
    note: LINE_CHAT_PANEL_NOTE,
    topics: [
      ...selected.map((topic) => panelTopic(topic, prefix)),
      panelTopic({ ...LINE_CHAT_TYPE_OWN, ref: 0, journey: "type_own" }, prefix),
    ],
    pageGroup: token,
    ...(campaign ? { campaignCode: campaign.code } : {}),
    source,
  };
}

/**
 * The slice of the config a page needs, so the browser never receives other pages' placements or
 * campaigns that cannot apply there. Ended temporary campaigns are dropped; future ones stay so a
 * cached page still switches on time.
 */
export function selectChatConfigForPage(config: LineChatConfig, context: ChatPageContext, now: Date): LineChatConfig {
  const token = chatPageGroupToken(context);
  const keys = new Set(chatPlacementKeys(context));
  const placements = config.placements.filter((placement) => keys.has(placement.key));
  const campaigns = config.campaigns.filter((campaign) => !campaign.paused && campaignAppliesTo(campaign, token)
    && !(campaign.type === "temporary" && campaign.endsAt && Date.parse(campaign.endsAt) <= now.getTime()));
  const used = new Set([...placements.flatMap((placement) => placement.topicIds), ...campaigns.flatMap((campaign) => campaign.pinnedTopicIds)]);
  return { enabled: config.enabled, topics: config.topics.filter((topic) => topic.enabled && used.has(topic.id)), placements, campaigns };
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

const FIXED_PATH_GROUPS: Record<string, LineChatFixedPageGroup> = {
  "/": "home",
  "/blog/": "blog_index",
  "/ci-planning/": "tool_ci",
  "/tools/financial-health-check/": "tool_fhc",
  "/play/money-story/": "tool_money_story",
  "/tools/investment-allocation/": "tool_investment_allocation",
  "/tools/": "tools_hub",
  // The /about/ page (owner-approved new URL 2026-10-25) uses its own shipped "about" placement.
  "/about/": "about",
};

/** Page group for a v5 page from its physical path (blog categories and articles by URL segment). */
export function chatContextForPath(path: string | undefined): ChatPageContext {
  if (!path) return { pageGroup: "default" };
  const fixed = FIXED_PATH_GROUPS[path];
  if (fixed) return { pageGroup: fixed };
  const blog = /^\/blog\/([a-z0-9][a-z0-9-]{0,95})\/(?:([a-z0-9][a-z0-9-]{0,95})\/)?$/.exec(path);
  if (blog) return blog[2] ? { pageGroup: `category:${blog[1]}`, articleSlug: blog[2] } : { pageGroup: `category:${blog[1]}` };
  return { pageGroup: "default" };
}
