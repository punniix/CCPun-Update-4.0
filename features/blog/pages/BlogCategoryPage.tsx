import { resolvePageSeoMetadata } from "@/lib/seo/page-seo";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText } from "@/lib/content/public-copy-registry";
import { cache } from "react";
import V5Category from "@/features/blog/v5/V5Category";
import { getPublishedArticles, getPublishedCategoryRegistry } from "@/components/layout/v5/shell-data";
import { listFallbackTopics, listLinkableTopics } from "@/lib/content/topic-navigation";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { getContentProvider } from "@/lib/content/provider";
import { IS_DRAFT_PREVIEW_ALLOWED } from "@/lib/deployment-environment";
import {
  articleBelongsToPhysicalCategory,
  getCategoryCanonical,
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
// Published reads share the request cache with the v5 nav/footer topics.
const getArticlesForRequest = cache((includeDrafts: boolean) =>
  includeDrafts ? getContentProvider().listArticles({ includeDrafts }) : getPublishedArticles(),
);
const getRegistryForRequest = cache((includeDrafts: boolean) =>
  includeDrafts ? listCategoryRegistry({ includeDrafts }) : getPublishedCategoryRegistry(),
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

// Plan T11: sibling-hub chips link only categories that own indexable articles.
function linkableTopics(registry: Awaited<ReturnType<typeof getRegistryForRequest>>, articles: Article[]) {
  return registry.available ? listLinkableTopics(registry, articles) : listFallbackTopics(articles);
}

function physicalCategoryCopy(category: CategoryRegistryEntry, hub: BlogTopicHub | null, copyText: ReturnType<typeof publicCopyText>) {
  return {
    title: category.seoTitle ?? hub?.seoTitle ?? copyText("blog.category.seoTitle").replaceAll("{title}", category.title),
    description: category.seoDescription ?? category.description ?? hub?.description ?? copyText("blog.category.description").replaceAll("{title}", category.title),
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
  const copyText = publicCopyText(await getPublicCopy("blog"));
  const { category: slug } = await params;
  const { isEnabled } = await draftMode();
  const includeDrafts = IS_DRAFT_PREVIEW_ALLOWED && isEnabled;
  const registry = await getRegistryForRequest(includeDrafts);
  const resolution = resolveCategoryRoute(registry, slug, { includeDrafts });
  if (resolution.kind === "unavailable") throw new Error("Category registry unavailable");

  if (resolution.kind === "category") {
    const category = resolution.category;
    const hub = getBlogTopicHub(category.slug);
    const articles = await getArticlesForRequest(includeDrafts);
    const relevantIndexableArticles = articles.filter(
      (article) => articleBelongsToPhysicalCategory(article, category) && isPublicIndexableArticle(article),
    );
    const copy = physicalCategoryCopy(category, hub, copyText);
    const canonical = getCategoryCanonical(category.slug);
    const shouldIndex = !includeDrafts
      && category.status === "active"
      && relevantIndexableArticles.length > 0;

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
      title: copyText("blog.category.fallbackTitle"),
      alternates: { canonical: getCategoryCanonical(resolution.destinationSlug) },
      robots: { index: false, follow: true },
    };
  }
  if (resolution.kind === "hidden") {
    return { title: copyText("blog.category.fallbackTitle"), alternates: { canonical: null }, robots: { index: false, follow: true } };
  }

  // Semantic hubs are intentionally separate from physical categories. This
  // fallback preserves topic-only destinations such as /blog/critical-illness/.
  const hub = getBlogTopicHub(slug);
  if (!hub) return { title: copyText("blog.category.fallbackTitle"), alternates: { canonical: null }, robots: { index: false, follow: true } };

  const articles = await getArticlesForRequest(false);
  const relevantIndexableArticles = articles.filter(
    (article) => articleBelongsToHub(article, hub) && isPublicIndexableArticle(article),
  );
  const shouldIndexHub = !includeDrafts && hub.indexable && relevantIndexableArticles.length > 0;
  const canonical = `${SITE_URL}/blog/${hub.slug}/`;

  return resolvePageSeoMetadata(`/blog/${hub.slug}/`, {
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
  });
}

export default async function BlogCategoryHub({ params }: { params: Promise<{ category: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const copy = await getPublicCopy("blog");
  const { category: slug } = await params;
  const { isEnabled } = await draftMode();
  const includeDrafts = IS_DRAFT_PREVIEW_ALLOWED && isEnabled;
  const registry = await getRegistryForRequest(includeDrafts);
  const resolution = resolveCategoryRoute(registry, slug, { includeDrafts });
  if (resolution.kind === "unavailable") throw new Error("Category registry unavailable");

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
      && relevantIndexableArticles.length > 0;
    const schema = shouldIndex && hub ? buildBlogTopicHubSchema(hub, relevantIndexableArticles) : null;

    return <>
      {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />}
      <V5Category
        slug={category.slug}
        categoryOwner
        title={category.title}
        description={category.description ?? hub?.description}
        hub={hub}
        articles={relevantArticles}
        totalArticleCount={visibleArticles.length}
        topics={linkableTopics(registry, visibleArticles)}
        copy={copy}
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
    <V5Category
      slug={hub.slug}
      title={hub.title}
      description={hub.description}
      hub={hub}
      articles={relevantArticles}
      totalArticleCount={publishedArticles.length}
      topics={linkableTopics(registry, publishedArticles)}
      copy={copy}
    />
  </>;
}
