import Website43Blog from "@/features/blog/website-43/Website43Blog";
import { toWebsite43ArticleItems } from "@/features/blog/website-43/blogData";
import styles from "@/components/layout/website-43/Website43.module.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getContentProvider } from "@/lib/content/provider";
import { BLOG_TOPIC_HUBS, isArticleInSemanticTopic } from "@/lib/content/taxonomy";
import { isArticleCanonicalAligned } from "@/lib/content/url";

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
  const publishedIndexableArticles = articles.filter(
    (article) => article.status === "published" && article.noindex !== true && isArticleCanonicalAligned(article),
  );
  const navigableHubs = BLOG_TOPIC_HUBS.filter(
    (hub) => hub.indexable && publishedIndexableArticles.some((article) => isArticleInSemanticTopic({
      articleSlug: article.slug,
      semanticTopic: article.semanticTopic,
      categoryTitle: article.category,
      categorySlug: article.categorySlug,
      tags: article.tags,
    }, hub.slug)),
  );

  const visibleArticles = articles.filter((article) => (!legacyCategory || legacyCategory === 'all' || article.category === legacyCategory)
    && (!legacyTag || legacyTag === 'all' || article.tags?.includes(legacyTag)));
  return <Website43Blog key={`all:${query}:${legacyCategory}:${legacyTag}`} articles={toWebsite43ArticleItems(visibleArticles)} initialQuery={query}
    topicNavigation={navigableHubs.length > 0 ? <nav className={styles.section} aria-label="หัวข้อบทความหลัก"><div className={styles.inner}>
      <h2 className={styles.h2}>เลือกหัวข้อที่ต้องการอ่าน</h2><div className={styles.heroActions} style={{ flexWrap: "wrap" }}>{navigableHubs.map((hub) => <Link className={styles.outlineButton} key={hub.slug} href={`/blog/${hub.slug}/`}>{hub.title}</Link>)}</div>
    </div></nav> : undefined}
  />;
}
