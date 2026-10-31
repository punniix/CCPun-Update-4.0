import { BLOG_TOPIC_HUBS, getBlogTopicHub, type BlogTopicSlug } from "./taxonomy";
import { articleBelongsToPhysicalCategory, listCategoryMenuEntries, type CategoryRegistry } from "./category-registry";
import { isArticleCanonicalAligned } from "./url";
import type { Article } from "./types";

/**
 * Website v5 internal-linking layer (internal-linking plan T01–T11).
 *
 * This file never owns a URL: physical paths still come from `url.ts` and
 * `category-registry.ts`. It only decides which existing, indexable owners are
 * linked from templates (nav, footer, hubs, related cards and next-step CTAs).
 * Article references use the stable Sanity source slug, not the public slug.
 */

export type TopicLink = { slug: string; title: string; href: string; count: number };

/** Cluster pillars (plan §4). A missing or unpublished pillar is skipped, never invented. */
export const TOPIC_CLUSTER_PILLARS: Readonly<Partial<Record<BlogTopicSlug, string>>> = {
  "personal-finance": "financial-pyramid",
  "life-insurance": "pension-insurance-guide",
  "health-insurance": "copayment-vs-deductible-health-insurance",
  "critical-illness-insurance": "critical-illness-insurance",
  "motor-insurance": "car-insurance-types",
};

/** Paired clusters for one bridge card (plan T07 step 4): CI ⇄ Health, Tax ⇄ Life; motor → reserve-fund pillar. */
export const TOPIC_CLUSTER_BRIDGES: Readonly<Partial<Record<BlogTopicSlug, BlogTopicSlug>>> = {
  "critical-illness-insurance": "health-insurance",
  "health-insurance": "critical-illness-insurance",
  "personal-finance": "life-insurance",
  "life-insurance": "personal-finance",
  "motor-insurance": "personal-finance",
};

/** Permanent homepage "core guides" (plan T01): CI owner, Health Happy winner, Tax deduction, Pyramid. */
export const HOME_CORE_GUIDE_SLUGS = [
  "critical-illness-insurance",
  "aia-health-happy-describe",
  "tax-deduction",
  "financial-pyramid",
] as const;

export function isPublicIndexableArticle(article: Article) {
  return article.status === "published" && article.noindex !== true && isArticleCanonicalAligned(article);
}

/**
 * Active physical categories that own at least one indexable article (plan T11),
 * in the editorial hub order. Empty categories stay reachable by URL but are
 * not linked from menus, so listings never point at a thin noindex page.
 */
export function listLinkableTopics(registry: CategoryRegistry, articles: readonly Article[]): TopicLink[] {
  const indexable = articles.filter(isPublicIndexableArticle);
  const entries = listCategoryMenuEntries(registry, false)
    .map((entry) => ({
      slug: entry.slug,
      title: entry.title,
      href: `/blog/${entry.slug}/`,
      count: indexable.filter((article) => articleBelongsToPhysicalCategory(article, entry)).length,
    }))
    .filter((entry) => entry.count > 0);
  const order = new Map<string, number>(BLOG_TOPIC_HUBS.map((hub, index) => [hub.slug, index]));
  return entries.sort((a, b) => (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99) || a.title.localeCompare(b.title, "th"));
}

/** Fallback when the registry is unavailable: indexable hubs from code taxonomy, still filtered by real articles. */
export function listFallbackTopics(articles: readonly Article[]): TopicLink[] {
  const indexable = articles.filter(isPublicIndexableArticle);
  return BLOG_TOPIC_HUBS.filter((hub) => hub.indexable)
    .map((hub) => ({
      slug: hub.slug,
      title: hub.title,
      href: `/blog/${hub.slug}/`,
      count: indexable.filter((article) => articleBelongsToPhysicalCategory(article, { slug: hub.slug })).length,
    }))
    .filter((entry) => entry.count > 0);
}

export function getTopicFeaturedLink(slug: string) {
  const hub = getBlogTopicHub(slug);
  return hub && "featuredLink" in hub ? hub.featuredLink : null;
}

/** /blog/ "เริ่มอ่านที่นี่" fallback until the owner curates it: one pillar per main cluster. */
export const BLOG_START_HERE_SLUGS = [
  "financial-pyramid",
  "critical-illness-insurance",
  "pension-insurance-guide",
  "copayment-vs-deductible-health-insurance",
] as const;

/** FigCraft 02b Version B: a category gets its own /blog/ group only with at least this many articles. */
export const BLOG_GROUP_MIN_ARTICLES = 3;
