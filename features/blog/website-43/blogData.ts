import type { Article } from '@/lib/content/types';
import { getArticleSemanticTopic } from '@/lib/content/taxonomy';
import { getArticlePath } from '@/lib/content/url';
import { WEBSITE43_BASE as BASE } from '@/components/layout/website-43/constants';

export type Website43ArticleItem = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  meta: string;
  publishedAt: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  href: string;
  tags: string[];
};

const thaiDateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Bangkok',
});

export function toWebsite43ArticleItem(article: Article): Website43ArticleItem {
  const semanticTopic = getArticleSemanticTopic({
    articleSlug: article.slug,
    semanticTopic: article.semanticTopic,
    categoryTitle: article.category,
    categorySlug: article.categorySlug,
    tags: article.tags,
  });
  const articlePath = getArticlePath(article);
  const displayDate = article.publishedAt ?? article.updatedAt;
  const date = new Date(displayDate);
  const formattedDate = Number.isFinite(date.getTime()) ? thaiDateFormatter.format(date) : null;

  return {
    slug: article.slug,
    category: semanticTopic?.title ?? article.category,
    title: article.title,
    excerpt: article.excerpt.trim() || article.title,
    meta: formattedDate ? `${article.publishedAt ? 'เผยแพร่' : 'อัปเดต'} ${formattedDate}` : '',
    publishedAt: displayDate,
    image: article.featuredImage?.src ?? '/assets/blog-hub-hero-ccpun-v1.webp',
    imageWidth: article.featuredImage?.width ?? 1774,
    imageHeight: article.featuredImage?.height ?? 887,
    href: `${BASE}${articlePath}`,
    tags: article.tags ?? [],
  };
}

export function toWebsite43ArticleItems(articles: Article[]): Website43ArticleItem[] {
  return articles
    .map(toWebsite43ArticleItem)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}
