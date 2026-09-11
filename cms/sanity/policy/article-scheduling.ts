import { createHash } from "node:crypto";
import { articlePublishBlock, type PublishableArticle } from "./article-publication";

export const ARTICLE_SCHEDULE_STATUSES = ["scheduled", "published", "stale", "cancelled", "failed"] as const;
export type ArticleScheduleStatus = (typeof ARTICLE_SCHEDULE_STATUSES)[number];

export type ArticleScheduleDocument = {
  _id: string;
  _type: "publishSchedule";
  _rev?: string;
  articleId: string;
  draftId: string;
  draftRevision: string;
  scheduledAt: string;
  timezone: "Asia/Bangkok";
  generation: string;
  status: ArticleScheduleStatus;
  createdByRole: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorCode?: string;
};

export function normalizeArticleId(value: string) {
  return value.replace(/^drafts\./, "");
}

export function articleScheduleDocumentId(articleId: string) {
  const logicalId = normalizeArticleId(articleId);
  const digest = createHash("sha256").update(logicalId).digest("hex").slice(0, 32);
  return `drafts.publishSchedule.${digest}`;
}

export function bangkokLocalDateTimeToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+07:00`);
  if (!Number.isFinite(parsed.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  if (
    byType.get("year") !== year ||
    byType.get("month") !== month ||
    byType.get("day") !== day ||
    byType.get("hour") !== hour ||
    byType.get("minute") !== minute
  ) return null;
  return parsed.toISOString();
}

export function getScheduleDelaySeconds(scheduledAt: string, now = Date.now()) {
  const target = Date.parse(scheduledAt);
  if (!Number.isFinite(target)) return null;
  return Math.max(0, Math.ceil((target - now) / 1000));
}

export function articleScheduleBlock(
  draft: PublishableArticle | null,
  published: PublishableArticle | null,
  scheduledAt: string,
  now = Date.now(),
) {
  const publishBlock = articlePublishBlock(draft, published, now);
  if (publishBlock) return publishBlock;
  const target = Date.parse(scheduledAt);
  if (!Number.isFinite(target)) return "วันและเวลาเผยแพร่ไม่ถูกต้อง";
  if (target <= now + 30_000) return "ตั้งเวลาเผยแพร่อย่างน้อย 30 วินาทีล่วงหน้า";
  return null;
}
