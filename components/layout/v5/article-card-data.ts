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

/** Maps a Sanity article to a v5 card. Invalid taxonomy returns null so one record never breaks a listing. */
export function toV5Card(article: Article, copy: PublicCopyValues = {}): V5CardArticle | null {
  const text = publicCopyText(copy);
  try {
    const href = getArticlePath(article);
    const date = new Date(article.publishedAt ?? article.updatedAt);
    const label = article.publishedAt ? text("blog.date.published") : text("blog.date.updated");
    return {
      id: article.id,
      href,
      title: article.title,
      topic: articleTopic(article)?.title ?? article.category,
      excerpt: article.excerpt.trim() || article.title,
      meta: Number.isFinite(date.getTime()) ? `${label} ${thaiDate.format(date)}` : undefined,
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
