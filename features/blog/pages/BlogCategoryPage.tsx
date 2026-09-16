import { cache } from "react";
import Website43Blog from "@/features/blog/website-43/Website43Blog";
import { toWebsite43ArticleItems } from "@/features/blog/website-43/blogData";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { getContentProvider } from "@/lib/content/provider";
import { IS_DRAFT_PREVIEW_ALLOWED } from "@/lib/deployment-environment";
import {
  articleBelongsToPhysicalCategory,
  getCategoryCanonical,
  listCategoryMenuEntries,
  resolveCategoryRoute,
  type CategoryRegistryEntry,
} from "@/lib/content/category-registry";
import { listCategoryRegistry } from "@/lib/content/category-registry-sanity";
import { serializeJsonLd } from "@/lib/content/structured-data/serialize-json-ld";
import { buildBlogTopicHubSchema } from "@/lib/content/structured-data/article-schema";
import type { Article } from "@/lib/content/types";
import {
  getBlogTopicHub,
  isArticleInSemanticTopic,
  type BlogTopicHub,
} from "@/lib/content/taxonomy";
import { getArticlePath, getLegacyCategoryRedirectPath, isArticleCanonicalAligned } from "@/lib/content/url";

const SITE_URL = "https://ccpun.com";
const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/assets/blog-hub-hero-ccpun-v1.webp`;
const getArticlesForRequest = cache((includeDrafts: boolean) =>
  getContentProvider().listArticles({ includeDrafts }),
);
const getRegistryForRequest = cache((includeDrafts: boolean) =>
  listCategoryRegistry({ includeDrafts }),
);

function articleBelongsToHub(article: Article, hub: BlogTopicHub) {
  return isArticleInSemanticTopic(
    {
      articleSlug: article.slug,
      semanticTopic: article.semanticTopic,
      categoryTitle: article.category,
      categorySlug: article.categorySlug,
      tags: article.tags,
    },
    hub.slug,
  );
}

function isPublicIndexableArticle(article: Article) {
  return article.status === "published" && article.noindex !== true && isArticleCanonicalAligned(article);
}

function categoryMenu(registry: Awaited<ReturnType<typeof getRegistryForRequest>>, includeDrafts: boolean) {
  return listCategoryMenuEntries(registry, includeDrafts).map(({ slug, title }) => ({ slug, title }));
}

function physicalCategoryCopy(category: CategoryRegistryEntry, hub: BlogTopicHub | null) {
  return {
    title: hub?.seoTitle ?? `${category.title} | บทความและความรู้ | CCPun`,
    description: category.description ?? hub?.description ?? `รวมบทความและความรู้เรื่อง${category.title}จาก CCPun`,
  };
}

function categoryOpenGraph(category: CategoryRegistryEntry, title: string, description: string) {
  const canonical = getCategoryCanonical(category.slug);
  return {
    type: "website" as const,
    locale: "th_TH",
    url: canonical,
    title,
    description,
    siteName: "CCPun Financial Advisor",
    images: [{ url: DEFAULT_SOCIAL_IMAGE, width: 1200, height: 630, alt: category.title }],
  };
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: slug } = await params;
  const { isEnabled } = await draftMode();
  const includeDrafts = IS_DRAFT_PREVIEW_ALLOWED && isEnabled;
  const registry = await getRegistryForRequest(includeDrafts);
  const resolution = resolveCategoryRoute(registry, slug, { includeDrafts });

  if (resolution.kind === "category") {
    const category = resolution.category;
    const hub = getBlogTopicHub(category.slug);
    const articles = await getArticlesForRequest(includeDrafts);
    const relevantIndexableArticles = articles.filter(
      (article) => articleBelongsToPhysicalCategory(article, category) && isPublicIndexableArticle(article),
    );
    const copy = physicalCategoryCopy(category, hub);
    const canonical = getCategoryCanonical(category.slug);
    const shouldIndex = !includeDrafts
      && category.status === "active"
      && relevantIndexableArticles.length > 0
      && (hub?.indexable ?? true);

    return {
      title: copy.title,
      description: copy.description,
      alternates: { canonical },
      robots: shouldIndex ? { index: true, follow: true } : { index: false, follow: true },
      openGraph: categoryOpenGraph(category, copy.title, copy.description),
      twitter: {
        card: "summary_large_image",
        title: copy.title,
        description: copy.description,
        images: [DEFAULT_SOCIAL_IMAGE],
      },
    };
  }

  if (resolution.kind === "redirect") {
    return {
      title: "บทความ | CCPun",
      alternates: { canonical: getCategoryCanonical(resolution.destinationSlug) },
      robots: { index: false, follow: true },
    };
  }
  if (resolution.kind === "hidden") {
    return { title: "บทความ | CCPun", alternates: { canonical: null }, robots: { index: false, follow: true } };
  }

  // Semantic hubs are intentionally separate from physical categories. This
  // fallback preserves topic-only destinations such as /blog/critical-illness/.
  const hub = getBlogTopicHub(slug);
  if (!hub) return { title: "บทความ | CCPun", alternates: { canonical: null }, robots: { index: false, follow: true } };

  const articles = await getArticlesForRequest(false);
  const relevantIndexableArticles = articles.filter(
    (article) => articleBelongsToHub(article, hub) && isPublicIndexableArticle(article),
  );
  const shouldIndexHub = !includeDrafts && hub.indexable && relevantIndexableArticles.length > 0;
  const canonical = `${SITE_URL}/blog/${hub.slug}/`;

  return {
    title: hub.seoTitle,
    description: hub.description,
    alternates: { canonical },
    robots: shouldIndexHub ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: "website",
      locale: "th_TH",
      url: canonical,
      title: hub.seoTitle,
      description: hub.description,
      siteName: "CCPun Financial Advisor",
      images: [{ url: DEFAULT_SOCIAL_IMAGE, width: 1200, height: 630, alt: hub.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: hub.seoTitle,
      description: hub.description,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
  };
}

export default async function BlogCategoryHub({ params, searchParams }: { params: Promise<{ category: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { category: slug } = await params;
  const { isEnabled } = await draftMode();
  const includeDrafts = IS_DRAFT_PREVIEW_ALLOWED && isEnabled;
  const registry = await getRegistryForRequest(includeDrafts);
  const resolution = resolveCategoryRoute(registry, slug, { includeDrafts });
  const queryParams = await searchParams ?? {};
  const initialQuery = typeof queryParams.q === "string" ? queryParams.q : "";

  if (resolution.kind === "redirect") permanentRedirect(`/blog/${resolution.destinationSlug}/`);
  if (resolution.kind === "hidden") notFound();

  if (resolution.kind === "category") {
    const category = resolution.category;
    const articles = await getArticlesForRequest(includeDrafts);
    const visibleArticles = articles.filter((article) => includeDrafts || article.status === "published");
    const relevantArticles = visibleArticles.filter((article) => articleBelongsToPhysicalCategory(article, category));
    const relevantIndexableArticles = relevantArticles.filter(isPublicIndexableArticle);
    const hub = getBlogTopicHub(category.slug);
    const shouldIndex = !includeDrafts
      && category.status === "active"
      && relevantIndexableArticles.length > 0
      && (hub?.indexable ?? true);
    const schema = shouldIndex && hub ? buildBlogTopicHubSchema(hub, relevantIndexableArticles) : null;

    return <>
      {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />}
      <Website43Blog
        key={`${category.slug}:${initialQuery}`}
        articles={toWebsite43ArticleItems(relevantArticles)}
        featuredArticles={toWebsite43ArticleItems(visibleArticles)}
        activeCategorySlug={category.slug}
        initialQuery={initialQuery}
        categories={categoryMenu(registry, includeDrafts)}
      />
    </>;
  }

  const hub = getBlogTopicHub(slug);
  if (!hub) {
    const legacyCategoryRedirect = getLegacyCategoryRedirectPath(slug);
    if (legacyCategoryRedirect) permanentRedirect(legacyCategoryRedirect);
    const article = await getContentProvider().getArticleBySlug(slug, { includeDrafts: false });
    if (!article) notFound();
    permanentRedirect(getArticlePath(article));
  }

  const articles = await getArticlesForRequest(false);
  const publishedArticles = articles.filter((article) => article.status === "published");
  const relevantArticles = publishedArticles.filter((article) => articleBelongsToHub(article, hub));
  const relevantIndexableArticles = relevantArticles.filter(isPublicIndexableArticle);
  const shouldIndexHub = hub.indexable && relevantIndexableArticles.length > 0;
  const schema = shouldIndexHub ? buildBlogTopicHubSchema(hub, relevantIndexableArticles) : null;

  return <>
    {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />}
    <Website43Blog
      key={`${hub.slug}:${initialQuery}`}
      articles={toWebsite43ArticleItems(relevantArticles)}
      featuredArticles={toWebsite43ArticleItems(publishedArticles)}
      activeCategorySlug={hub.slug}
      initialQuery={initialQuery}
      categories={categoryMenu(registry, includeDrafts)}
    />
  </>;
}
