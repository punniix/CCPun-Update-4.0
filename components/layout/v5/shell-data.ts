// Server composition only: it reads through the content provider, whose Sanity fetch is itself
// server-only, so a client import still fails at build time.
import { cache } from "react";
import { getContentProvider } from "@/lib/content/provider";
import { listCategoryRegistry } from "@/lib/content/category-registry-sanity";
import { listFallbackTopics, listLinkableTopics, type TopicLink } from "@/lib/content/topic-navigation";
import type { Article } from "@/lib/content/types";

/**
 * One published article read per request, shared by the shell (nav/footer topics) and the page.
 * It rejects like the provider does, so a CMS outage still fails the page instead of rendering an empty listing.
 */
export const getPublishedArticles = cache(async (): Promise<Article[]> => {
  const articles = await getContentProvider().listArticles({ includeDrafts: false });
  return articles.filter((article) => article.status === "published");
});

export const getPublishedCategoryRegistry = cache(() => listCategoryRegistry({ includeDrafts: false }));

/** Server-rendered topic hubs for nav and footer (plan T04/T05/T11). Never throws: the shell must render. */
export const getShellTopics = cache(async (): Promise<TopicLink[]> => {
  try {
    const [registry, articles] = await Promise.all([getPublishedCategoryRegistry(), getPublishedArticles()]);
    return registry.available ? listLinkableTopics(registry, articles) : listFallbackTopics(articles);
  } catch {
    return [];
  }
});
