import Website43Blog from "@/features/blog/website-43/Website43Blog";
import { toWebsite43ArticleItems } from "@/features/blog/website-43/blogData";
import type { Metadata } from "next";
import { getContentProvider } from "@/lib/content/provider";

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

export default async function BlogPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = await searchParams ?? {};
  const query = typeof filters.q === "string" ? filters.q : "";
  const legacyCategory = typeof filters.category === "string" ? filters.category : "";
  const legacyTag = typeof filters.tag === "string" ? filters.tag : "";
  const cmsArticles = await getContentProvider().listArticles({ includeDrafts: false });
  const articles = cmsArticles.filter((article) => article.status === "published");

  const visibleArticles = articles.filter((article) => (!legacyCategory || legacyCategory === "all" || article.category === legacyCategory)
    && (!legacyTag || legacyTag === "all" || article.tags?.includes(legacyTag)));
  return <Website43Blog key={`all:${legacyCategory}:${legacyTag}`} articles={toWebsite43ArticleItems(visibleArticles)} initialQuery={query} />;
}
