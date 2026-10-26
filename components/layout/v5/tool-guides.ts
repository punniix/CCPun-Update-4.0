import { TOPIC_CLUSTER_PILLARS, isPublicIndexableArticle } from "@/lib/content/topic-navigation";
import type { BlogTopicSlug } from "@/lib/content/taxonomy";
import type { Article } from "@/lib/content/types";
import { articleTopic, newestFirst } from "./article-card-data";
import type { V5ToolId } from "./constants";

/**
 * Tool page -> owner guides (reverse of the article next-step CTA, plan T08).
 * Only existing indexable articles are linked; the topic comes from the same
 * semantic taxonomy as the article template, so AIA Health CI Hero (a health
 * product) is never listed under the CI-planning tool.
 */
export const TOOL_GUIDE_TOPICS: Readonly<Record<V5ToolId, readonly BlogTopicSlug[]>> = {
  ci: ["critical-illness-insurance"],
  fhc: ["life-insurance", "personal-finance"],
  moneyStory: ["personal-finance"],
};

export const TOOL_GUIDE_HUB: Readonly<Record<V5ToolId, BlogTopicSlug>> = {
  ci: "critical-illness-insurance",
  fhc: "life-insurance",
  moneyStory: "personal-finance",
};

/** Pillars first (in topic order), then the newest remaining articles of the same topics. */
export function listToolGuides(tool: V5ToolId, articles: readonly Article[], limit = 3): Article[] {
  const topics = TOOL_GUIDE_TOPICS[tool];
  const pool = newestFirst(articles.filter(isPublicIndexableArticle))
    .filter((article) => topics.includes(articleTopic(article)?.slug as BlogTopicSlug));
  const pillars = topics
    .map((topic) => TOPIC_CLUSTER_PILLARS[topic])
    .map((slug) => pool.find((article) => article.slug === slug))
    .filter((article): article is Article => Boolean(article));
  const rest = pool.filter((article) => !pillars.includes(article));
  return [...pillars, ...rest].slice(0, limit);
}
