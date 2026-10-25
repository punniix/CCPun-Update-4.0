import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import { getArticleSemanticTopic } from "@/lib/content/taxonomy";
import { getArticlePath } from "@/lib/content/url";
import type { Article } from "@/lib/content/types";
import type { V5CardArticle } from "./V5Primitives";

const thaiDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });

export function articleTopic(article: Article) {
  return getArticleSemanticTopic({
    articleSlug: article.slug,
    semanticTopic: article.semanticTopic,
    categoryTitle: article.category,
    categorySlug: article.categorySlug,
    tags: article.tags,
  });
}

/**
 * Card date (owner decision 2026-10-25): an explicit content optimisation (Sanity contentOptimizedAt)
 * shows "อัปเดต <date>"; otherwise the publish date shows "เผยแพร่ <date>". `updatedAt` is never
 * shown, because any edit or migration touches it. List order is decided elsewhere and is unchanged.
 */
export function cardDate(article: Pick<Article, "optimizedAt" | "publishedAt">): { key: "blog.date.updated" | "blog.date.published"; at: Date } | null {
  for (const [key, value] of [["blog.date.updated", article.optimizedAt], ["blog.date.published", article.publishedAt]] as const) {
    const time = value ? Date.parse(value) : NaN;
    if (Number.isFinite(time)) return { key, at: new Date(time) };
  }
  return null;
}

/** Maps a Sanity article to a v5 card. Invalid taxonomy returns null so one record never breaks a listing. */
export function toV5Card(article: Article, copy: PublicCopyValues = {}): V5CardArticle | null {
  const text = publicCopyText(copy);
  try {
    const href = getArticlePath(article);
    const date = cardDate(article);
    return {
      id: article.id,
      href,
      title: article.title,
      topic: articleTopic(article)?.title ?? article.category,
      excerpt: article.excerpt.trim() || article.title,
      meta: date ? `${date.key === "blog.date.updated" ? text("blog.date.updated") : text("blog.date.published")} ${thaiDate.format(date.at)}` : undefined,
      image: article.featuredImage
        ? { src: article.featuredImage.src, width: article.featuredImage.width, height: article.featuredImage.height }
        : { src: "/assets/blog-hub-hero-ccpun-v1.webp", width: 1774, height: 887 },
    };
  } catch (error) {
    console.error("[v5-card] skipping article with invalid taxonomy", { slug: article.slug, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export function toV5Cards(articles: readonly Article[], copy: PublicCopyValues = {}) {
  return articles.map((article) => toV5Card(article, copy)).filter((card): card is V5CardArticle => card !== null);
}

export function newestFirst(articles: readonly Article[]) {
  const time = (article: Article) => { const value = Date.parse(article.publishedAt ?? article.updatedAt); return Number.isFinite(value) ? value : 0; };
  return [...articles].sort((a, b) => time(b) - time(a));
}
