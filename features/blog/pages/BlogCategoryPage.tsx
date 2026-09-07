import Website43Blog from "@/features/blog/website-43/Website43Blog";
import { toWebsite43ArticleItems } from "@/features/blog/website-43/blogData";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { getContentProvider } from "@/lib/content/provider";
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

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: slug } = await params;
  const hub = getBlogTopicHub(slug);
  if (!hub) return { title: "บทความ | CCPun", alternates: { canonical: null }, robots: { index: false, follow: true } };

  const { isEnabled } = await draftMode();
  const articles = await getContentProvider().listArticles({ includeDrafts: false });
  const relevantIndexableArticles = articles.filter(
    (article) => articleBelongsToHub(article, hub) && isPublicIndexableArticle(article),
  );
  const shouldIndexHub = hub.indexable && relevantIndexableArticles.length > 0;
  const canonical = `${SITE_URL}/blog/${hub.slug}/`;

  return {
    title: hub.seoTitle,
    description: hub.description,
    alternates: { canonical },
    robots: !isEnabled && shouldIndexHub ? { index: true, follow: true } : { index: false, follow: true },
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
  const hub = getBlogTopicHub(slug);

  if (!hub) {
    const legacyCategoryRedirect = getLegacyCategoryRedirectPath(slug);
    if (legacyCategoryRedirect) permanentRedirect(legacyCategoryRedirect);
    const article = await getContentProvider().getArticleBySlug(slug, { includeDrafts: false });
    if (!article) notFound();
    permanentRedirect(getArticlePath(article));
  }

  const queryParams = await searchParams ?? {};
  const initialQuery = typeof queryParams.q === "string" ? queryParams.q : "";
  const articles = await getContentProvider().listArticles({ includeDrafts: false });
  const relevantArticles = articles.filter((article) => article.status === "published" && articleBelongsToHub(article, hub));
  const relevantIndexableArticles = relevantArticles.filter(isPublicIndexableArticle);
  const shouldIndexHub = hub.indexable && relevantIndexableArticles.length > 0;
  const schema = shouldIndexHub ? buildBlogTopicHubSchema(hub, relevantIndexableArticles) : null;

  return <>
    {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />}
    <Website43Blog
      key={`${hub.slug}:${initialQuery}`}
      articles={toWebsite43ArticleItems(relevantArticles)}
      activeCategorySlug={hub.slug}
      initialQuery={initialQuery}
    />
  </>;
}
