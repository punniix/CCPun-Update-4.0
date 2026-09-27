import type { Article } from "./types";

export const DEFAULT_FEATURED_ARTICLE_COUNT = 6;
export const MAX_FEATURED_ARTICLE_COUNT = 8;

export function parseBlogFeaturedArticleIds(value: unknown): string[] | null {
  if (value == null) return [];
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const ids = (value as { featuredArticleIds?: unknown }).featuredArticleIds;
  if (ids == null) return [];
  return Array.isArray(ids) && ids.every((id) => typeof id === "string" && id.trim().length > 0) ? ids : null;
}

function normalizeDocumentId(id: string) {
  return id.replace(/^drafts\./, "");
}

function articleTimestamp(article: Article) {
  const value = article.publishedAt ?? article.updatedAt;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function curateFeaturedArticles(
  candidates: readonly Article[],
  manualArticleIds: readonly string[] = [],
): Article[] {
  const published = candidates.filter((article) => article.status === "published");
  const byId = new Map(published.map((article) => [normalizeDocumentId(article.id), article]));
  const selected: Article[] = [];
  const seen = new Set<string>();

  for (const rawId of manualArticleIds) {
    const id = normalizeDocumentId(rawId);
    const article = byId.get(id);
    if (!article || seen.has(id)) continue;
    selected.push(article);
    seen.add(id);
    if (selected.length >= MAX_FEATURED_ARTICLE_COUNT) return selected;
  }

  const fallback = [...published].sort((left, right) => articleTimestamp(right) - articleTimestamp(left));
  const targetCount = Math.min(
    MAX_FEATURED_ARTICLE_COUNT,
    Math.max(DEFAULT_FEATURED_ARTICLE_COUNT, selected.length),
  );

  for (const article of fallback) {
    const id = normalizeDocumentId(article.id);
    if (seen.has(id)) continue;
    selected.push(article);
    seen.add(id);
    if (selected.length >= targetCount) break;
  }

  return selected;
}
