import type { LocalAiTaskType } from "./contracts";

// Owner decision A7 (2026-10-25): the first Local AI jobs are (1) the daily
// marketing summary and (2) article improvement suggestions.
//
// Both map onto task types that already exist in LOCAL_AI_TASK_TYPES, so no new
// task type, Neon CHECK constraint, worker prompt or encrypted payload contract
// is introduced here:
//   - daily marketing summary  -> "analytics-review"  (already enqueued by the
//     06:00 run through /api/internal/analytics/assessment and reviewed by the
//     owner on the morning report);
//   - article suggestions      -> "content-operations" (public-safe: excerpt,
//     tags and FAQ candidates with reviewRequired=true). The Admin entry point
//     is a scaffold: it stays off until the worker prompt for improvement
//     suggestions is reviewed and the owner enables it.
// Every result is a proposal. Nothing is written, sent or published by the model.

export type LocalAiFirstJob = {
  id: "daily-marketing-summary" | "article-improvement-suggestions";
  label: string;
  taskType: LocalAiTaskType;
  dataClass: "public-safe";
  trigger: string;
  reviewWhere: string;
  state: "active" | "scaffold";
  nextStep: string | null;
};

export const LOCAL_AI_FIRST_JOBS: readonly LocalAiFirstJob[] = Object.freeze([
  {
    id: "daily-marketing-summary",
    label: "สรุปการตลาดรายวัน",
    taskType: "analytics-review",
    dataClass: "public-safe",
    trigger: "รอบเก็บข้อมูล 06:00 ส่งงานให้อัตโนมัติหลังเก็บข้อมูลครบ",
    reviewWhere: "/analytics/",
    state: "active",
    nextStep: null,
  },
  {
    id: "article-improvement-suggestions",
    label: "ข้อเสนอปรับบทความ",
    taskType: "content-operations",
    dataClass: "public-safe",
    trigger: "กดจากหน้ารายละเอียดบทความ (ยังปิดไว้)",
    reviewWhere: "/operations/local-ai/",
    state: "scaffold",
    nextStep: "ตรวจคำสั่งสำหรับข้อเสนอปรับบทความบนเครื่อง AI ภายใน แล้วจึงเปิดปุ่มบนหน้าบทความ",
  },
]);

export const ARTICLE_SUGGESTION_MAX_BODY = 30_000;

/**
 * Builds the existing "content-operations" input for one published article.
 * Only reader-facing public text goes in; never customer data. Returns null when
 * the article cannot be represented within the existing contract limits.
 */
export function buildArticleSuggestionInput(article: { title: string; body: string; canonicalPath?: string; allowedCategories: string[] }) {
  const title = article.title.trim();
  const body = article.body.trim();
  const allowedCategories = [...new Set(article.allowedCategories.map((item) => item.trim()).filter(Boolean))];
  if (!title || title.length > 300 || !body || body.length > ARTICLE_SUGGESTION_MAX_BODY) return null;
  if (!allowedCategories.length || allowedCategories.length > 50 || allowedCategories.some((item) => item.length > 80)) return null;
  if (article.canonicalPath !== undefined && (!article.canonicalPath.startsWith("/") || article.canonicalPath.length > 500)) return null;
  return {
    locale: "th-TH" as const,
    title,
    body,
    ...(article.canonicalPath ? { canonicalPath: article.canonicalPath } : {}),
    allowedCategories,
  };
}
