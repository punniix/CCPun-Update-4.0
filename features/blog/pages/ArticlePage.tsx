import { draftMode } from "next/headers";
import { IS_DRAFT_PREVIEW_ALLOWED } from "@/lib/deployment-environment";
import Website43Article from "@/features/blog/website-43/Website43Article";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { serializeJsonLd } from "@/lib/content/structured-data/serialize-json-ld";
import { getContentProvider } from "@/lib/content/provider";
import { buildArticleSchemaGraph } from "@/lib/content/structured-data/article-schema";
import { getArticleCanonical, getArticleCategorySlug, getArticlePath, getMovedArticleRedirectPath, isArticleCanonicalAligned } from "@/lib/content/url";

const DEFAULT_SOCIAL_IMAGE = "/assets/blog-hub-hero-ccpun-v1.webp";

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  const { category, slug } = await params;
  const { isEnabled } = await draftMode();
  const includeDrafts = IS_DRAFT_PREVIEW_ALLOWED && isEnabled;
  const article = await getContentProvider().getArticleBySlug(slug, { includeDrafts });
  if (!article || (!includeDrafts && article.status !== "published")) {
    return {
      title: "ไม่พบหน้า | CCPun",
      alternates: { canonical: null },
      robots: { index: false, follow: true },
    };
  }

  const finalCategory = getArticleCategorySlug(article);
  if (category !== finalCategory) return { robots: { index: false, follow: true } };
  const canonical = getArticleCanonical(article);
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
      url: canonical,
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
  const movedPath = getMovedArticleRedirectPath(category, slug);
  if (movedPath) permanentRedirect(movedPath);
  const { isEnabled } = await draftMode();
  const includeDrafts = IS_DRAFT_PREVIEW_ALLOWED && isEnabled;
  const article = await getContentProvider().getArticleBySlug(slug, { includeDrafts });
  if (!article || (!includeDrafts && article.status !== "published")) notFound();
  if (category !== getArticleCategorySlug(article)) permanentRedirect(getArticlePath(article));

  const schema = isArticleCanonicalAligned(article) ? buildArticleSchemaGraph(article) : null;

  const relatedArticles = (await getContentProvider().listArticles({ includeDrafts: false }))
    .filter((candidate) => candidate.status === "published" && candidate.slug !== article.slug).slice(0, 2);
  return <>
    {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />}
    <Website43Article preview={includeDrafts} article={article} relatedArticles={relatedArticles} />
  </>;
}
