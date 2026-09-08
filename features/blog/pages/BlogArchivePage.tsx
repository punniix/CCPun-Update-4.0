import Website43Blog from "@/features/blog/website-43/Website43Blog";
import { toWebsite43ArticleItems } from "@/features/blog/website-43/blogData";
import type { Metadata } from "next";
import { getContentProvider } from "@/lib/content/provider";

export const metadata: Metadata = {
  title: "บทความการเงิน การลงทุน และการวางแผนอนาคต | CCPun",
  description: "เคล็ดลับการเงิน การลงทุน ประกัน และการวางแผนอนาคตจาก CCPun Financial Advisor",
  alternates: { canonical: "https://ccpun.com/blog/" },
};

export default async function BlogPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = await searchParams ?? {};
  const query = typeof filters.q === 'string' ? filters.q : '';
  const legacyCategory = typeof filters.category === 'string' ? filters.category : '';
  const legacyTag = typeof filters.tag === 'string' ? filters.tag : '';
  const cmsArticles = await getContentProvider().listArticles({ includeDrafts: false });
  const articles = cmsArticles.filter((article) => article.status === "published");

  const visibleArticles = articles.filter((article) => (!legacyCategory || legacyCategory === 'all' || article.category === legacyCategory)
    && (!legacyTag || legacyTag === 'all' || article.tags?.includes(legacyTag)));
  return <Website43Blog key={`all:${query}:${legacyCategory}:${legacyTag}`} articles={toWebsite43ArticleItems(visibleArticles)} initialQuery={query} />;
}
