import { getArticleSemanticTopic } from "@/lib/content/taxonomy";
import { articleBelongsToPhysicalCategory } from "@/lib/content/category-registry";
import { getArticleCategorySlug, getArticlePath } from "@/lib/content/url";
import { TOPIC_CLUSTER_BRIDGES, TOPIC_CLUSTER_PILLARS } from "@/lib/content/topic-navigation";
import type { BlogTopicSlug } from "@/lib/content/taxonomy";
import type { Article } from "@/lib/content/types";

export const RELATED_MAX = 4;

function topicSlug(article: Article): BlogTopicSlug | null {
  return getArticleSemanticTopic({
    articleSlug: article.slug,
    semanticTopic: article.semanticTopic,
    categoryTitle: article.category,
    categorySlug: article.categorySlug,
    tags: article.tags,
  })?.slug ?? null;
}

function time(article: Article) {
  const value = Date.parse(article.publishedAt ?? article.updatedAt);
  return Number.isFinite(value) ? value : 0;
}

function hasValidPath(article: Article) {
  try { getArticlePath(article); return true; } catch { return false; }
}

/**
 * Related articles (internal-linking plan T07), 3–4 cards in this priority:
 *   1. same semantic topic (newest first), excluding the article itself
 *   2. the cluster pillar, if not already chosen
 *   3. the pillar of the paired bridge cluster (CI ⇄ Health, Tax ⇄ Life, Motor → reserve fund)
 *   4. recent articles from the same physical category
 * It never fills with off-topic "newest" articles. A manual `relatedArticles`
 * Sanity field (plan step 0) does not exist yet and needs an approved additive schema change.
 */
export function selectRelatedArticles(article: Article, candidates: readonly Article[], max = RELATED_MAX): Article[] {
  const pool = candidates.filter((candidate) => candidate.status === "published" && candidate.slug !== article.slug && candidate.noindex !== true && hasValidPath(candidate));
  const chosen: Article[] = [];
  const add = (candidate: Article | undefined) => {
    if (candidate && chosen.length < max && !chosen.some((item) => item.slug === candidate.slug)) chosen.push(candidate);
  };
  const topic = topicSlug(article);
  const newest = [...pool].sort((a, b) => time(b) - time(a));

  if (topic) newest.filter((candidate) => topicSlug(candidate) === topic).forEach(add);
  if (topic) add(pool.find((candidate) => candidate.slug === TOPIC_CLUSTER_PILLARS[topic]));
  const bridge = topic ? TOPIC_CLUSTER_BRIDGES[topic] : undefined;
  if (bridge) add(pool.find((candidate) => candidate.slug === TOPIC_CLUSTER_PILLARS[bridge]));
  let physical: string | null = null;
  try { physical = getArticleCategorySlug(article); } catch { physical = null; }
  if (physical) newest.filter((candidate) => articleBelongsToPhysicalCategory(candidate, { slug: physical as string })).forEach(add);
  return chosen;
}
