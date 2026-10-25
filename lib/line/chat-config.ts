import { z } from "zod";
import {
  LINE_CHAT_CAMPAIGN_TARGETS,
  LINE_CHAT_DEFAULTS,
  LINE_CHAT_EVERGREEN_REVIEW_DAYS,
  LINE_CHAT_JOURNEYS,
  LINE_CHAT_LIMITS,
  LINE_CHAT_PLACEMENT_KEY,
  type LineChatConfig,
} from "./chat-panel";

export * from "./chat-panel";

/**
 * LINE chat button system (owner-approved 2026-10-25, decisions L1-L9): validation half.
 *
 * One Sanity singleton (`lineChatConfig`) holds the owner's topic library, per-page placements
 * and campaigns. The website and Admin share this schema and validation; any invalid or missing
 * config falls back to LINE_CHAT_DEFAULTS so the chat button can never break. The LINE
 * destination is never part of the config (see oa-link.ts). Pure resolver: ./chat-panel.ts.
 */

export const LINE_CHAT_BANNED_WORDS = ["ฟรี", "การันตี", "รับประกันผลตอบแทน", "ดีที่สุด", "100%"] as const;

const TOPIC_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const CAMPAIGN_CODE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const CAMPAIGN_REF = /^[A-Z]{2,4}$/;

const URL_PATTERN = /(?:https?:\/\/|www\.|lin\.ee|line\.me|\b[a-z0-9-]+\.(?:com|net|org|co|th|me|ly|io|app|link)\b)/i;
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_PATTERN = /(?:\+?66|0)[\s.-]?\d(?:[\s.-]?\d){7,8}|\d{9,}/;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;
const ELLIPSIS_PATTERN = /\.\.\.|…/;
const MARKUP_PATTERN = /[<>{}]/;

/** Visible character count; Thai vowel and tone marks do not count as extra characters. */
export function countChatCharacters(value: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    let count = 0;
    for (const _ of new Intl.Segmenter("th", { granularity: "grapheme" }).segment(value)) count += 1;
    return count;
  }
  return Array.from(value).length;
}

export type ChatTextIssue = "empty" | "too-long" | "url" | "email" | "phone" | "banned-word" | "emoji" | "ellipsis" | "markup";

/** Owner copy rules for every chat string (คปภ. wording, no contact data, no links). */
export function chatTextIssues(value: string, max: number): ChatTextIssue[] {
  const text = value.trim();
  const issues: ChatTextIssue[] = [];
  if (!text) return ["empty"];
  if (countChatCharacters(text) > max) issues.push("too-long");
  if (URL_PATTERN.test(text)) issues.push("url");
  if (EMAIL_PATTERN.test(text)) issues.push("email");
  if (PHONE_PATTERN.test(text)) issues.push("phone");
  if (LINE_CHAT_BANNED_WORDS.some((word) => text.includes(word))) issues.push("banned-word");
  if (EMOJI_PATTERN.test(text)) issues.push("emoji");
  if (ELLIPSIS_PATTERN.test(text)) issues.push("ellipsis");
  if (MARKUP_PATTERN.test(text)) issues.push("markup");
  return issues;
}

export const CHAT_TEXT_ISSUE_LABEL: Record<ChatTextIssue, string> = {
  empty: "ยังไม่ได้ใส่ข้อความ",
  "too-long": "ยาวเกินกำหนด",
  url: "ห้ามใส่ลิงก์",
  email: "ห้ามใส่อีเมล",
  phone: "ห้ามใส่เบอร์โทร",
  "banned-word": "มีคำต้องห้าม (ฟรี, การันตี, รับประกันผลตอบแทน, ดีที่สุด, 100%)",
  emoji: "ห้ามใส่อีโมจิ",
  ellipsis: "ห้ามใช้จุดไข่ปลา",
  markup: "ห้ามใช้เครื่องหมาย < > { }",
};

const chatText = (max: number) => z.string().trim().superRefine((value, ctx) => {
  for (const issue of chatTextIssues(value, max)) ctx.addIssue({ code: "custom", message: issue });
});

const isoDate = z.string().datetime({ offset: true });

export const lineChatTopicSchema = z.object({
  id: z.string().regex(TOPIC_ID),
  ref: z.number().int().min(1).max(99),
  label: chatText(LINE_CHAT_LIMITS.label),
  prefill: chatText(LINE_CHAT_LIMITS.prefill),
  journey: z.enum(LINE_CHAT_JOURNEYS),
  enabled: z.boolean(),
}).strict();

export const lineChatPlacementSchema = z.object({
  key: z.string().regex(LINE_CHAT_PLACEMENT_KEY),
  topicIds: z.array(z.string().regex(TOPIC_ID)).min(1).max(LINE_CHAT_LIMITS.placementTopics),
}).strict();

export const lineChatCampaignSchema = z.object({
  code: z.string().regex(CAMPAIGN_CODE),
  refCode: z.string().regex(CAMPAIGN_REF),
  title: chatText(LINE_CHAT_LIMITS.title),
  type: z.enum(["temporary", "evergreen"]),
  startsAt: isoDate.optional(),
  endsAt: isoDate.optional(),
  reviewAt: isoDate.optional(),
  pageGroups: z.array(z.enum(LINE_CHAT_CAMPAIGN_TARGETS)).min(1).max(LINE_CHAT_CAMPAIGN_TARGETS.length),
  pinnedTopicIds: z.array(z.string().regex(TOPIC_ID)).min(1).max(LINE_CHAT_LIMITS.placementTopics),
  headline: chatText(LINE_CHAT_LIMITS.headline).optional(),
  paused: z.boolean(),
}).strict().superRefine((campaign, ctx) => {
  if (campaign.type === "temporary") {
    if (!campaign.startsAt) ctx.addIssue({ code: "custom", path: ["startsAt"], message: "required" });
    if (!campaign.endsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "required" });
    if (campaign.startsAt && campaign.endsAt && Date.parse(campaign.endsAt) <= Date.parse(campaign.startsAt)) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "ends-before-start" });
    }
  } else {
    if (campaign.endsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "evergreen-has-no-end" });
    if (!campaign.reviewAt) ctx.addIssue({ code: "custom", path: ["reviewAt"], message: "required" });
  }
});

export const lineChatConfigSchema = z.object({
  enabled: z.boolean(),
  topics: z.array(lineChatTopicSchema).min(1).max(LINE_CHAT_LIMITS.topics),
  placements: z.array(lineChatPlacementSchema).min(1).max(80),
  campaigns: z.array(lineChatCampaignSchema).max(LINE_CHAT_LIMITS.campaigns),
}).strict().superRefine((config, ctx) => {
  const topicById = new Map<string, z.infer<typeof lineChatTopicSchema>>();
  const refs = new Set<number>();
  config.topics.forEach((topic, index) => {
    if (topicById.has(topic.id)) ctx.addIssue({ code: "custom", path: ["topics", index, "id"], message: "duplicate" });
    if (refs.has(topic.ref)) ctx.addIssue({ code: "custom", path: ["topics", index, "ref"], message: "duplicate" });
    topicById.set(topic.id, topic);
    refs.add(topic.ref);
  });
  const keys = new Set<string>();
  config.placements.forEach((placement, index) => {
    if (keys.has(placement.key)) ctx.addIssue({ code: "custom", path: ["placements", index, "key"], message: "duplicate" });
    keys.add(placement.key);
    if (new Set(placement.topicIds).size !== placement.topicIds.length) ctx.addIssue({ code: "custom", path: ["placements", index, "topicIds"], message: "duplicate" });
    placement.topicIds.forEach((id, topicIndex) => {
      if (!topicById.has(id)) ctx.addIssue({ code: "custom", path: ["placements", index, "topicIds", topicIndex], message: "unknown-topic" });
    });
    // A switched-off topic is skipped on the site, but no page may be left with none.
    if (!placement.topicIds.some((id) => topicById.get(id)?.enabled)) ctx.addIssue({ code: "custom", path: ["placements", index, "topicIds"], message: "no-enabled-topic" });
  });
  if (!keys.has("default")) ctx.addIssue({ code: "custom", path: ["placements"], message: "missing-default" });
  const codes = new Set<string>();
  config.campaigns.forEach((campaign, index) => {
    if (codes.has(campaign.code)) ctx.addIssue({ code: "custom", path: ["campaigns", index, "code"], message: "duplicate" });
    codes.add(campaign.code);
    campaign.pinnedTopicIds.forEach((id, topicIndex) => {
      if (!topicById.has(id)) ctx.addIssue({ code: "custom", path: ["campaigns", index, "pinnedTopicIds", topicIndex], message: "unknown-topic" });
    });
    if (!campaign.pinnedTopicIds.some((id) => topicById.get(id)?.enabled)) ctx.addIssue({ code: "custom", path: ["campaigns", index, "pinnedTopicIds"], message: "no-enabled-topic" });
  });
});

export type LineChatConfigRead = { config: LineChatConfig; source: "stored" | "default"; invalid: boolean };

/** Any published value passes the same validation the Admin save used; anything else falls back to DEFAULTS. */
export function parseLineChatConfig(raw: unknown): LineChatConfigRead {
  if (raw === null || raw === undefined) return { config: LINE_CHAT_DEFAULTS, source: "default", invalid: false };
  const parsed = lineChatConfigSchema.safeParse(raw);
  return parsed.success
    ? { config: parsed.data as LineChatConfig, source: "stored", invalid: false }
    : { config: LINE_CHAT_DEFAULTS, source: "default", invalid: true };
}

export function defaultEvergreenReviewAt(from: Date): string {
  return new Date(from.getTime() + LINE_CHAT_EVERGREEN_REVIEW_DAYS * 86_400_000).toISOString();
}

/** GROQ projection of the published singleton into the runtime shape (same for Web and Admin). */
export const LINE_CHAT_CONFIG_ID = "ccpun-line-chat-v1";
export const LINE_CHAT_CONFIG_PROJECTION = '{_rev,enabled,"topics":topics[]{"id":topicId,ref,label,prefill,journey,enabled},"placements":placements[]{"key":pageKey,topicIds},"campaigns":campaigns[]{code,refCode,title,"type":campaignType,startsAt,endsAt,reviewAt,pageGroups,pinnedTopicIds,headline,paused}}';

function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, nested]) => nested !== null && nested !== undefined).map(([key, nested]) => [key, withoutNulls(nested)]));
  }
  return value;
}

/** Projected Sanity document -> runtime config candidate (validation happens in parseLineChatConfig). */
export function lineChatConfigFromProjection(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return null;
  const { _rev: _ignored, ...rest } = withoutNulls(raw) as Record<string, unknown>;
  void _ignored;
  return { campaigns: [], ...rest };
}

const sanityKey = (prefix: string, value: string) => `${prefix}-${value.replace(/[^a-z0-9-]/gi, "-").slice(0, 60)}`;

/** Runtime config -> Sanity fields with stable `_key`s (topic id, page key and campaign code never change). */
export function lineChatConfigToSanityFields(config: LineChatConfig) {
  return {
    version: 1,
    enabled: config.enabled,
    topics: config.topics.map((topic) => ({ _type: "lineChatTopic", _key: sanityKey("topic", topic.id), topicId: topic.id, ref: topic.ref, label: topic.label, prefill: topic.prefill, journey: topic.journey, enabled: topic.enabled })),
    placements: config.placements.map((placement) => ({ _type: "lineChatPlacement", _key: sanityKey("page", placement.key), pageKey: placement.key, topicIds: placement.topicIds })),
    campaigns: config.campaigns.map((campaign) => ({
      _type: "lineChatCampaign",
      _key: sanityKey("campaign", campaign.code),
      code: campaign.code,
      refCode: campaign.refCode,
      title: campaign.title,
      campaignType: campaign.type,
      ...(campaign.startsAt ? { startsAt: campaign.startsAt } : {}),
      ...(campaign.endsAt ? { endsAt: campaign.endsAt } : {}),
      ...(campaign.reviewAt ? { reviewAt: campaign.reviewAt } : {}),
      pageGroups: campaign.pageGroups,
      pinnedTopicIds: campaign.pinnedTopicIds,
      ...(campaign.headline ? { headline: campaign.headline } : {}),
      paused: campaign.paused,
    })),
  };
}

export type LineChatImmutabilityIssue =
  | { kind: "topic-removed"; id: string }
  | { kind: "topic-ref-changed"; id: string }
  | { kind: "campaign-removed"; code: string }
  | { kind: "campaign-ref-changed"; code: string };

/**
 * Topic ids, their reference numbers and campaign codes are permanent keys (they appear in
 * analytics, in "(รหัส ...)" chat references and in utm_campaign links already shared). They can
 * be switched off or paused, never renamed or deleted.
 */
export function lineChatImmutabilityIssues(previous: LineChatConfig, next: LineChatConfig): LineChatImmutabilityIssue[] {
  const issues: LineChatImmutabilityIssue[] = [];
  const nextTopics = new Map(next.topics.map((topic) => [topic.id, topic] as const));
  for (const topic of previous.topics) {
    const kept = nextTopics.get(topic.id);
    if (!kept) issues.push({ kind: "topic-removed", id: topic.id });
    else if (kept.ref !== topic.ref) issues.push({ kind: "topic-ref-changed", id: topic.id });
  }
  const nextCampaigns = new Map(next.campaigns.map((campaign) => [campaign.code, campaign] as const));
  for (const campaign of previous.campaigns) {
    const kept = nextCampaigns.get(campaign.code);
    if (!kept) issues.push({ kind: "campaign-removed", code: campaign.code });
    else if (kept.refCode !== campaign.refCode) issues.push({ kind: "campaign-ref-changed", code: campaign.code });
  }
  return issues;
}

export type LineChatWarning =
  | { kind: "running-defaults"; level: "warning"; reason: "no-config" | "invalid-config" }
  | { kind: "campaign-expiring"; level: "warning"; code: string; endsAt: string }
  | { kind: "evergreen-overdue"; level: "danger"; code: string; reviewAt: string }
  | { kind: "topic-no-clicks"; level: "info"; id: string };

const DAY_MS = 86_400_000;

/** Admin warnings (design doc "การดูแลรักษา"): nothing here ever switches a campaign off by itself. */
export function lineChatAdminWarnings(config: LineChatConfig, now: Date, options: { source: "stored" | "default"; storedInvalid?: boolean; topicClicks30d?: Record<string, number> | null } = { source: "stored" }): LineChatWarning[] {
  const warnings: LineChatWarning[] = [];
  if (options.source === "default") warnings.push({ kind: "running-defaults", level: "warning", reason: options.storedInvalid ? "invalid-config" : "no-config" });
  const time = now.getTime();
  for (const campaign of config.campaigns) {
    if (campaign.paused) continue;
    if (campaign.type === "temporary" && campaign.endsAt) {
      const end = Date.parse(campaign.endsAt);
      if (end > time && end - time <= 3 * DAY_MS) warnings.push({ kind: "campaign-expiring", level: "warning", code: campaign.code, endsAt: campaign.endsAt });
    }
    if (campaign.type === "evergreen" && campaign.reviewAt && Date.parse(campaign.reviewAt) <= time) {
      warnings.push({ kind: "evergreen-overdue", level: "danger", code: campaign.code, reviewAt: campaign.reviewAt });
    }
  }
  if (options.topicClicks30d) {
    for (const topic of config.topics) if (topic.enabled && !options.topicClicks30d[topic.id]) warnings.push({ kind: "topic-no-clicks", level: "info", id: topic.id });
  }
  return warnings;
}

export const LINE_CHAT_LINK_CHANNELS = {
  facebook: { label: "Facebook", source: "facebook", medium: "social" },
  instagram: { label: "Instagram", source: "instagram", medium: "social" },
  tiktok: { label: "TikTok", source: "tiktok", medium: "social" },
  line_broadcast: { label: "LINE broadcast", source: "line", medium: "broadcast" },
  google_business_profile: { label: "Google Business Profile", source: "google", medium: "business_profile" },
} as const;
export type LineChatLinkChannel = keyof typeof LINE_CHAT_LINK_CHANNELS;

const DESTINATION_PATH = /^\/(?:[a-z0-9-]+\/)*$/;

/** Campaign link for Facebook, Instagram, TikTok, LINE broadcast or Google Business Profile posts. */
export function buildLineChatCampaignLink(code: string, channel: LineChatLinkChannel, path: string): string | null {
  if (!CAMPAIGN_CODE.test(code) || !Object.hasOwn(LINE_CHAT_LINK_CHANNELS, channel) || !DESTINATION_PATH.test(path)) return null;
  const { source, medium } = LINE_CHAT_LINK_CHANNELS[channel];
  const url = new URL(path, "https://ccpun.com");
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", code);
  return url.toString();
}

/**
 * Reverting to an older revision restores its wording, placements and switches. Topics and
 * campaigns created after that revision are kept (switched off / paused), because their ids are
 * permanent keys.
 */
export function lineChatMergeForRevert(current: LineChatConfig, reverted: LineChatConfig): LineChatConfig {
  const topicIds = new Set(reverted.topics.map((topic) => topic.id));
  const campaignCodes = new Set(reverted.campaigns.map((campaign) => campaign.code));
  return {
    ...reverted,
    topics: [...reverted.topics, ...current.topics.filter((topic) => !topicIds.has(topic.id)).map((topic) => ({ ...topic, enabled: false }))],
    campaigns: [...reverted.campaigns, ...current.campaigns.filter((campaign) => !campaignCodes.has(campaign.code)).map((campaign) => ({ ...campaign, paused: true }))],
  };
}
