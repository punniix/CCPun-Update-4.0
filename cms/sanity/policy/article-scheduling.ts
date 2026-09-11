import { articlePublishBlock, type PublishableArticle } from "./article-publication";
import { isReservedArticleSlug } from "../../../lib/content/taxonomy";

export function normalizeArticleId(value: string) { return value.replace(/^drafts\./, ""); }

export function bangkokLocalDateTimeToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+07:00`);
  if (!Number.isFinite(parsed.getTime())) return null;
  const parts = new Map(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(parsed).map((part) => [part.type, part.value]));
  if (parts.get("year") !== year || parts.get("month") !== month || parts.get("day") !== day || parts.get("hour") !== hour || parts.get("minute") !== minute) return null;
  return parsed.toISOString();
}

export function getScheduleDelaySeconds(scheduledAt: string, now = Date.now()) {
  const target = Date.parse(scheduledAt);
  return Number.isFinite(target) ? Math.max(0, Math.ceil((target - now) / 1000)) : null;
}

export function scheduledArticleReadinessBlock(draft: PublishableArticle | null, published: PublishableArticle | null, now = Date.now()) {
  const blocked = articlePublishBlock(draft, published, now);
  if (blocked || !draft) return blocked || "ไม่มีฉบับร่าง";
  const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  const author = draft.author as { _ref?: string } | undefined;
  const seo = draft.seo as { canonical?: string; noindex?: boolean } | undefined;
  const liveSeo = published?.seo as { canonical?: string; noindex?: boolean } | undefined;
  if (!text(draft.title) || !text(draft.excerpt) || String(draft.excerpt).length > 240 || !text(draft.slug?.current)
    || isReservedArticleSlug(draft.slug?.current) || !text(draft.category?._ref) || !text(author?._ref)
    || !Array.isArray(draft.body) || draft.body.length === 0 || !seo) return "ตรวจข้อมูลบทความที่จำเป็นให้ครบก่อนตั้งเวลา";
  // Scheduled updates cannot silently change protected indexing or canonical controls.
  if (published && (seo.canonical !== liveSeo?.canonical || Boolean(seo.noindex) !== Boolean(liveSeo?.noindex))) return "การเปลี่ยน Canonical หรือ Noindex ต้องผ่านการตรวจ SEO แยกต่างหาก";
  return null;
}

export function articleScheduleBlock(draft: PublishableArticle | null, published: PublishableArticle | null, scheduledAt: string, now = Date.now()) {
  const blocked = scheduledArticleReadinessBlock(draft, published, now);
  if (blocked) return blocked;
  const target = Date.parse(scheduledAt);
  if (!Number.isFinite(target)) return "วันและเวลาเผยแพร่ไม่ถูกต้อง";
  if (target <= now + 30_000) return "ตั้งเวลาเผยแพร่อย่างน้อย 30 วินาทีล่วงหน้า";
  if (target > now + 90 * 86_400_000) return "ตั้งเวลาได้ไม่เกิน 90 วันล่วงหน้า";
  return null;
}
