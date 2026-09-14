import type { Article } from "./types";
import { LEGACY_CATEGORY_TOPICS, normalizeArticleTaxonomy } from "./taxonomy";

// Foundation cutover before UX/UI 4.2. These two winner pages now have one
// approved physical/canonical owner under /health-insurance/. Keep this override
// until every published Sanity article reference has naturally converged on the
// Health Insurance category; leaving it in place afterwards is harmless and
// protects against an accidental category regression.
const ARTICLE_CANONICAL_CATEGORY_OVERRIDES: Record<string, string> = {
  "aia-health-happy-describe": "health-insurance",
  "aia-health-ci-hero-guide": "health-insurance",
};

// Historical/interim CCPun article paths redirect directly to the final owner.
// Do not add an intermediate hop.
const MOVED_ARTICLE_PATHS: Record<string, string> = {
  "life-insurance/aia-health-happy-describe": "/blog/health-insurance/aia-health-happy-describe/",
  "life-insurance/aia-health-ci-hero-guide": "/blog/health-insurance/aia-health-ci-hero-guide/",
  "critical-illness/critical-illness-insurance": "/blog/life-insurance/critical-illness-insurance/",
};

type ArticleCategoryInput = Pick<Article, "category" | "categorySlug"> & Partial<Pick<Article, "slug">>;

const PREVIEW_CATEGORY_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getArticleCategorySlug(article: ArticleCategoryInput) {
  const protectedCategory = article.slug ? ARTICLE_CANONICAL_CATEGORY_OVERRIDES[article.slug] : undefined;
  if (protectedCategory) return protectedCategory;

  const slug = normalizeArticleTaxonomy({
    categoryTitle: article.category,
    categorySlug: article.categorySlug,
  }).categorySlug;
  if (!slug) throw new Error("Unsupported article category");
  return slug;
}

export function getArticlePreviewCategorySlug(article: ArticleCategoryInput) {
  const canonicalCategory = normalizeArticleTaxonomy({
    categoryTitle: article.category,
    categorySlug: article.categorySlug,
  }).categorySlug;
  if (canonicalCategory) return canonicalCategory;

  const rawCategory = article.categorySlug?.trim().toLowerCase() ?? "";
  if (PREVIEW_CATEGORY_SEGMENT.test(rawCategory)) return rawCategory;
  throw new Error("Unsupported article preview category");
}

export function getArticlePath(article: Pick<Article, "slug" | "category" | "categorySlug">) {
  return `/blog/${getArticleCategorySlug(article)}/${article.slug}/`;
}

export function getArticlePreviewPath(article: Pick<Article, "slug" | "category" | "categorySlug">) {
  return `/blog/${getArticlePreviewCategorySlug(article)}/${article.slug}/`;
}

export function getArticleCanonical(article: Pick<Article, "slug" | "category" | "categorySlug" | "canonical">) {
  if (ARTICLE_CANONICAL_CATEGORY_OVERRIDES[article.slug]) {
    return `https://ccpun.com${getArticlePath(article)}`;
  }
  return article.canonical ?? `https://ccpun.com${getArticlePath(article)}`;
}

export function isArticleCanonicalAligned(article: Pick<Article, "slug" | "category" | "categorySlug" | "canonical">) {
  try {
    const canonical = new URL(getArticleCanonical(article));
    return canonical.origin === "https://ccpun.com"
      && canonical.pathname === getArticlePath(article)
      && !canonical.username
      && !canonical.password
      && !canonical.search
      && !canonical.hash;
  } catch {
    return false;
  }
}

export function getLegacyCategoryRedirectPath(segment: string) {
  const topic = LEGACY_CATEGORY_TOPICS[segment as keyof typeof LEGACY_CATEGORY_TOPICS];
  return topic ? `/blog/?tag=${encodeURIComponent(topic)}` : null;
}

export function getMovedArticleRedirectPath(category: string, slug: string) {
  return MOVED_ARTICLE_PATHS[`${category}/${slug}`] ?? null;
}
