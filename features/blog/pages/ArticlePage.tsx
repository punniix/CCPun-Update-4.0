import { cache } from "react";
import { draftMode } from "next/headers";
import { IS_DRAFT_PREVIEW_ALLOWED } from "@/lib/deployment-environment";
import Website43Article from "@/features/blog/website-43/Website43Article";
import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { serializeJsonLd } from "@/lib/content/structured-data/serialize-json-ld";
import { getContentProvider } from "@/lib/content/provider";
import { buildArticleSchemaGraph } from "@/lib/content/structured-data/article-schema";
import {
  getArticleCanonical,
  getArticleCategorySlug,
  getArticlePath,
  getArticlePreviewCategorySlug,
  getArticlePreviewPath,
  getArticleSourceSlugForRoute,
  getMovedArticleRedirectPath,
  isArticleCanonicalAligned,
} from "@/lib/content/url";

const DEFAULT_SOCIAL_IMAGE = "/assets/blog-hub-hero-ccpun-v1.webp";

const getArticleBySlugForRequest = cache((slug: string, includeDrafts: boolean) =>
  getContentProvider().getArticleBySlug(slug, { includeDrafts }),
);

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  const { category, slug } = await params;
  const { isEnabled } = await draftMode();
  const includeDrafts = IS_DRAFT_PREVIEW_ALLOWED && isEnabled;
  const sourceSlug = getArticleSourceSlugForRoute(slug);
  const article = await getArticleBySlugForRequest(sourceSlug, includeDrafts);
  if (!article || (!includeDrafts && article.status !== "published")) {
    return {
      title: "ไม่พบหน้า | CCPun",
      alternates: { canonical: null },
      robots: { index: false, follow: true },
    };
  }

  const finalCategory = includeDrafts ? getArticlePreviewCategorySlug(article) : getArticleCategorySlug(article);
  const finalPath = includeDrafts ? getArticlePreviewPath(article) : getArticlePath(article);
  const finalSlug = finalPath.split("/").filter(Boolean).at(-1);
  if (category !== finalCategory || slug !== finalSlug) return { robots: { index: false, follow: true } };
  const canonical = includeDrafts ? null : getArticleCanonical(article);
  const isDraft = includeDrafts || article.status !== "published";
  const noindex = isDraft || article.noindex === true || !isArticleCanonicalAligned(article);

  return {
    title: article.seoTitle,
    description: article.seoDescription,
    alternates: { canonical },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: "article",
      locale: "th_TH",
      ...(canonical ? { url: canonical } : {}),
      title: article.ogTitle || article.seoTitle,
      description: article.ogDescription || article.seoDescription,
      siteName: "CCPun Financial Advisor",
      images: [{ url: article.ogImage?.src ?? article.featuredImage?.src ?? DEFAULT_SOCIAL_IMAGE, alt: article.ogImage?.alt ?? article.featuredImage?.alt ?? "CCPun บทความวางแผนการเงิน" }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.ogTitle || article.seoTitle,
      description: article.ogDescription || article.seoDescription,
      images: [article.ogImage?.src ?? article.featuredImage?.src ?? DEFAULT_SOCIAL_IMAGE],
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  const { isEnabled } = await draftMode();
  const includeDrafts = IS_DRAFT_PREVIEW_ALLOWED && isEnabled;
  const movedPath = getMovedArticleRedirectPath(category, slug);

  // A moved URL redirects only after the final owner resolves to a published
  // source article. Public route aliases can point at an existing Sanity slug,
  // which lets URL ownership move without publishing unrelated draft content.
  if (movedPath && !includeDrafts) {
    const movedTargetSlug = movedPath.split("/").filter(Boolean).at(-1);
    const movedTargetSourceSlug = movedTargetSlug ? getArticleSourceSlugForRoute(movedTargetSlug) : null;
    const movedTargetArticle = movedTargetSourceSlug
      ? await getArticleBySlugForRequest(movedTargetSourceSlug, false)
      : null;
    if (movedTargetArticle?.status === "published") permanentRedirect(movedPath);
  }

  const provider = getContentProvider();
  const relatedArticlesPromise = provider.listArticles({ includeDrafts: false });
  const sourceSlug = getArticleSourceSlugForRoute(slug);
  const article = await getArticleBySlugForRequest(sourceSlug, includeDrafts);
  if (!article || (!includeDrafts && article.status !== "published")) notFound();
  const routeCategory = includeDrafts ? getArticlePreviewCategorySlug(article) : getArticleCategorySlug(article);
  const routePath = includeDrafts ? getArticlePreviewPath(article) : getArticlePath(article);
  const routeSlug = routePath.split("/").filter(Boolean).at(-1);
  if (category !== routeCategory || slug !== routeSlug) {
    if (includeDrafts) redirect(getArticlePreviewPath(article));
    permanentRedirect(getArticlePath(article));
  }

  const schema = isArticleCanonicalAligned(article) ? buildArticleSchemaGraph(article) : null;

  let relatedArticles = [] as Awaited<ReturnType<ReturnType<typeof getContentProvider>["listArticles"]>>;
  try {
    const candidates = (await relatedArticlesPromise)
      .filter((candidate) => candidate.status === "published" && candidate.slug !== article.slug)
      .filter((candidate) => {
        try {
          getArticlePath(candidate);
          return true;
        } catch (error) {
          console.error("[blog-related] skipping article with invalid taxonomy", {
            slug: candidate.slug,
            category: candidate.category,
            categorySlug: candidate.categorySlug,
            error: error instanceof Error ? error.message : String(error),
          });
          return false;
        }
      });
    relatedArticles = candidates
      .sort((a, b) => {
        const aScore = (a.categorySlug === article.categorySlug ? 2 : 0) + (a.semanticTopic && a.semanticTopic === article.semanticTopic ? 3 : 0);
        const bScore = (b.categorySlug === article.categorySlug ? 2 : 0) + (b.semanticTopic && b.semanticTopic === article.semanticTopic ? 3 : 0);
        return bScore - aScore;
      })
      .slice(0, 2);
  } catch (error) {
    console.error("[blog-related] related articles unavailable", { type: error instanceof Error ? error.name : "unknown" });
  }

  return <>
    {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />}
    <Website43Article preview={includeDrafts} article={article} relatedArticles={relatedArticles} />
  </>;
}
