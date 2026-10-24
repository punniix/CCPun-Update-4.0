import { getPublicCopy } from "@/lib/content/public-copy";
import type { PublicCopyValues } from "@/lib/content/public-copy-registry";
import V5BlogIndex from "@/features/blog/v5/V5BlogIndex";
import { listLinkableTopics, listFallbackTopics } from "@/lib/content/topic-navigation";
import { getPrimaryAuthorProfile } from "@/lib/content/sanity";
import { getPublishedArticles, getPublishedCategoryRegistry } from "@/components/layout/v5/shell-data";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { getContentProvider } from "@/lib/content/provider";
import { IS_DRAFT_PREVIEW_ALLOWED } from "@/lib/deployment-environment";
import { listCategoryRegistry } from "@/lib/content/category-registry-sanity";
import { listBlogFeaturedArticleIds } from "@/lib/content/blog-featured-sanity";
import { curateFeaturedArticles } from "@/lib/content/featured-articles";
import { serializeJsonLd } from "@/lib/content/structured-data/serialize-json-ld";
import { buildBlogArchiveSchema } from "@/lib/content/structured-data/article-schema";


const BLOG_TITLE = "บทความการเงิน การลงทุน และการวางแผนอนาคต | CCPun";
const BLOG_DESCRIPTION = "เคล็ดลับการเงิน การลงทุน ประกัน และการวางแผนอนาคตจาก CCPun Financial Advisor";
const BLOG_URL = "https://ccpun.com/blog/";
const BLOG_IMAGE = "https://ccpun.com/assets/blog-hub-hero-ccpun-v1.webp";

export const metadata: Metadata = {
  title: BLOG_TITLE,
  description: BLOG_DESCRIPTION,
  alternates: { canonical: BLOG_URL },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: BLOG_URL,
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    siteName: "CCPun Financial Advisor",
    images: [{ url: BLOG_IMAGE, alt: "บทความการเงิน ประกัน และการลงทุนจาก CCPun" }],
  },
  twitter: {
    card: "summary_large_image",
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    images: [BLOG_IMAGE],
  },
};

type BlogPageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export async function renderBlogPage({ searchParams }: BlogPageProps = {}, copyOverride?: PublicCopyValues, siteCopyOverride?: PublicCopyValues) {
  const copy = copyOverride ?? await getPublicCopy("blog");
  const filters = await searchParams ?? {};
  const query = typeof filters.q === "string" ? filters.q : "";
  const legacyCategory = typeof filters.category === "string" ? filters.category : "";
  const legacyTag = typeof filters.tag === "string" ? filters.tag : "";
  const { isEnabled } = await draftMode();
  const includeDrafts = IS_DRAFT_PREVIEW_ALLOWED && isEnabled;
  const [cmsArticles, registry, manualFeaturedArticleIds, author] = await Promise.all([
    // Published reads are request-cached and shared with the v5 nav/footer.
    includeDrafts ? getContentProvider().listArticles({ includeDrafts }) : getPublishedArticles(),
    includeDrafts ? listCategoryRegistry({ includeDrafts }) : getPublishedCategoryRegistry(),
    listBlogFeaturedArticleIds(),
    getPrimaryAuthorProfile(),
  ]);
  const articles = cmsArticles.filter((article) => includeDrafts || article.status === "published");
  // Plan T11: only categories with indexable articles are linked from the listing.
  const topics = registry.available ? listLinkableTopics(registry, articles) : listFallbackTopics(articles);

  const visibleArticles = articles.filter((article) => (!legacyCategory || legacyCategory === "all" || article.category === legacyCategory)
    && (!legacyTag || legacyTag === "all" || article.tags?.includes(legacyTag)));
  const featuredArticles = manualFeaturedArticleIds === null ? [] : curateFeaturedArticles(articles, manualFeaturedArticleIds);
  const schema = !includeDrafts ? buildBlogArchiveSchema(articles, { title: BLOG_TITLE, description: BLOG_DESCRIPTION }) : null;

  // Plan T02: every article is in the /blog/ HTML (per-group paging on the same URL, no ?page= owner).
  return <>
    {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />}
    <V5BlogIndex
      key={`all:${legacyCategory}:${legacyTag}`}
      copy={copy}
      siteCopy={siteCopyOverride}
      articles={visibleArticles}
      featured={featuredArticles}
      topics={topics}
      author={author}
      initialQuery={query}
    />
  </>;
}

export default function BlogPage(props: Pick<BlogPageProps, "searchParams">) { return renderBlogPage(props); }
