import { listSitemapArticles } from "@/lib/content/sitemap";
import { articleBelongsToPhysicalCategory, getCategoryCanonical } from "@/lib/content/category-registry";
import { listCategoryRegistry } from "@/lib/content/category-registry-sanity";
import { BLOG_TOPIC_HUBS, getBlogTopicHub, isArticleInSemanticTopic } from "@/lib/content/taxonomy";
import { getArticleCanonical, isArticleCanonicalAligned } from "@/lib/content/url";
import { uniqueSortedSitemapEntries as uniqueSortedEntries } from "@/lib/sitemap/google";
import { renderUrlSet, xmlResponse } from "@/lib/sitemap/xml";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [articles, categoryRegistry] = await Promise.all([
      listSitemapArticles({ includeDrafts: false }),
      listCategoryRegistry({ includeDrafts: false }),
    ]);
    const canonicalArticles = articles.filter(isArticleCanonicalAligned);
    const indexableArticles = canonicalArticles.filter(
      (article) => article.status === "published" && article.noindex !== true,
    );
    const articleEntries = indexableArticles.map((article) => ({
      loc: getArticleCanonical(article),
      lastmod: article.updatedAt,
    }));
    const blogEntry = { loc: "https://ccpun.com/blog/" };

    const physicalCategoryEntries = categoryRegistry.active.flatMap((category) => {
      const hub = getBlogTopicHub(category.slug);
      if (hub && !hub.indexable) return [];
      const relevant = indexableArticles.filter((article) => articleBelongsToPhysicalCategory(article, category));
      if (!relevant.length) return [];
      return [{ loc: getCategoryCanonical(category.slug) }];
    });

    const hubEntries = BLOG_TOPIC_HUBS.flatMap((hub) => {
      if (!hub.indexable) return [];
      const relevant = indexableArticles.filter((article) =>
        isArticleInSemanticTopic(
          {
            articleSlug: article.slug,
            semanticTopic: article.semanticTopic,
            categoryTitle: article.category,
            categorySlug: article.categorySlug,
            tags: article.tags,
          },
          hub.slug,
        ),
      );
      if (!relevant.length) return [];
      return [{ loc: `https://ccpun.com/blog/${hub.slug}/` }];
    });

    return xmlResponse(renderUrlSet(uniqueSortedEntries([blogEntry, ...physicalCategoryEntries, ...hubEntries, ...articleEntries])));
  } catch (error) {
    console.error("BLOG_SITEMAP_GENERATION_FAILED", error instanceof Error ? error.message : "unknown");
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "300",
      },
    });
  }
}
