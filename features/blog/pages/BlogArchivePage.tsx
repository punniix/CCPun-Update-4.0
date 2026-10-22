import { getPublicCopy } from "@/lib/content/public-copy";
import type { PublicCopyValues } from "@/lib/content/public-copy-registry";
import { getPageSeoPage } from "@/lib/content/page-seo-registry";
import Website43Blog from "@/features/blog/website-43/Website43Blog";
import { toWebsite43ArticleItems, toWebsite43ArticleItemsInOrder } from "@/features/blog/website-43/blogData";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { draftMode } from "next/headers";
import { getContentProvider } from "@/lib/content/provider";
import { IS_DRAFT_PREVIEW_ALLOWED } from "@/lib/deployment-environment";
import { listCategoryMenuEntries } from "@/lib/content/category-registry";
import { listCategoryRegistry } from "@/lib/content/category-registry-sanity";
import { listBlogFeaturedArticleIds } from "@/lib/content/blog-featured-sanity";
import { curateFeaturedArticles } from "@/lib/content/featured-articles";
import { serializeJsonLd } from "@/lib/content/structured-data/serialize-json-ld";
import { buildBlogArchiveSchema } from "@/lib/content/structured-data/article-schema";

const PAGE_SEO_DEFAULTS = getPageSeoPage("/blog/")!.defaults;

const BLOG_TITLE = PAGE_SEO_DEFAULTS.seoTitle!;
const BLOG_DESCRIPTION = PAGE_SEO_DEFAULTS.seoDescription!;
const BLOG_URL = "https://ccpun.com/blog/";
const BLOG_IMAGE = PAGE_SEO_DEFAULTS.ogImageUrl!;

export const metadata: Metadata = {
  title: PAGE_SEO_DEFAULTS.seoTitle!,
  description: PAGE_SEO_DEFAULTS.seoDescription!,
  alternates: { canonical: BLOG_URL },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: BLOG_URL,
    title: PAGE_SEO_DEFAULTS.ogTitle!,
    description: PAGE_SEO_DEFAULTS.ogDescription!,
    siteName: "CCPun Financial Advisor",
    images: [{ url: BLOG_IMAGE, alt: "บทความการเงิน ประกัน และการลงทุนจาก CCPun" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_SEO_DEFAULTS.ogTitle!,
    description: PAGE_SEO_DEFAULTS.ogDescription!,
    images: [BLOG_IMAGE],
  },
};

type BlogPageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>>; searchEnhancement?: ReactNode };

export async function renderBlogPage({ searchParams, searchEnhancement }: BlogPageProps = {}, copyOverride?: PublicCopyValues, siteCopyOverride?: PublicCopyValues) {
  const copy = copyOverride ?? await getPublicCopy("blog");
  const filters = await searchParams ?? {};
  const query = typeof filters.q === "string" ? filters.q : "";
  const legacyCategory = typeof filters.category === "string" ? filters.category : "";
  const legacyTag = typeof filters.tag === "string" ? filters.tag : "";
  const { isEnabled } = await draftMode();
  const includeDrafts = IS_DRAFT_PREVIEW_ALLOWED && isEnabled;
  const [cmsArticles, registry, manualFeaturedArticleIds] = await Promise.all([
    getContentProvider().listArticles({ includeDrafts }),
    listCategoryRegistry({ includeDrafts }),
    listBlogFeaturedArticleIds(),
  ]);
  const articles = cmsArticles.filter((article) => includeDrafts || article.status === "published");
  const categories = listCategoryMenuEntries(registry, includeDrafts).map(({ slug, title }) => ({ slug, title }));

  const visibleArticles = articles.filter((article) => (!legacyCategory || legacyCategory === "all" || article.category === legacyCategory)
    && (!legacyTag || legacyTag === "all" || article.tags?.includes(legacyTag)));
  const featuredArticles = manualFeaturedArticleIds === null ? [] : curateFeaturedArticles(articles, manualFeaturedArticleIds);
  const schema = !includeDrafts ? buildBlogArchiveSchema(articles, { title: BLOG_TITLE, description: BLOG_DESCRIPTION }) : null;

  return <>
    {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />}
    <Website43Blog
      copyOverride={copy}
      siteCopyOverride={siteCopyOverride}
      searchEnhancement={searchEnhancement}
      key={`all:${legacyCategory}:${legacyTag}`}
      articles={toWebsite43ArticleItems(visibleArticles, copy)}
      featuredArticles={toWebsite43ArticleItemsInOrder(featuredArticles, copy)}
      initialQuery={query}
      initialPage={typeof filters.page === "string" ? filters.page : "1"}
      categories={categories}
    />
  </>;
}

export default function BlogPage(props: BlogPageProps) { return renderBlogPage(props); }
