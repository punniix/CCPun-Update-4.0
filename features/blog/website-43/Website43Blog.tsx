import { PublicCopyProvider } from "@/components/ui/PublicCopyProvider";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import { isHealthHappyCampaignAvailable } from "@/components/ui/health-happy/availability";
import Image from 'next/image';
import type { ReactNode } from 'react';
import styles from '@/components/layout/website-43/Website43.module.css';
import { Website43Footer, Website43Navbar } from '@/components/layout/website-43/Website43Shared';
import type { Website43ArticleItem } from './blogData';
import HealthHappyCountdown from '@/components/ui/health-happy/HealthHappyCountdown';
import Website43BlogInteractive, {
  type Website43BlogCategoryItem,
  type Website43BlogClientClassNames,
} from './Website43BlogInteractive';

const BLOG_CLIENT_CLASS_NAMES = {
  articleCard: styles.articleCard,
  articleImage: styles.articleImage,
  articleCardBody: styles.articleCardBody,
  articleCategory: styles.articleCategory,
  articleTitle: styles.articleTitle,
  articleExcerpt: styles.articleExcerpt,
  articleMeta: styles.articleMeta,
  blogContent: styles.blogContent,
  inner: styles.inner,
  eyebrow: styles.eyebrow,
  featuredViewport: styles.featuredViewport,
  featuredScroller: styles.featuredScroller,
  featuredRail: styles.featuredRail,
  featuredCard: styles.featuredCard,
  carouselControls: styles.carouselControls,
  carouselDotButton: styles.carouselDotButton,
  carouselDotButtonActive: styles.carouselDotButtonActive,
  searchFilters: styles.searchFilters,
  searchField: styles.searchField,
  categoryMenu: styles.categoryMenu,
  categoryMenuButton: styles.categoryMenuButton,
  categoryMenuChevron: styles.categoryMenuChevron,
  categoryMenuChevronOpen: styles.categoryMenuChevronOpen,
  categoryMenuPanel: styles.categoryMenuPanel,
  categoryMenuOption: styles.categoryMenuOption,
  categoryMenuOptionActive: styles.categoryMenuOptionActive,
  categoryMenuIndicator: styles.categoryMenuIndicator,
  articleListHeading: styles.articleListHeading,
  h2: styles.h2,
  articleGrid: styles.articleGrid,
  emptyState: styles.emptyState,
  pagination: styles.pagination,
} satisfies Website43BlogClientClassNames;

export async function renderWebsite43Blog({ articles, featuredArticles, activeCategorySlug = null, activeCategoryTitle, heroDescription, initialQuery = '', initialPage = '1', categories = [], topicContent, topicNavigation, siteCopyOverride, searchEnhancement }: {
  articles: Website43ArticleItem[];
  featuredArticles?: Website43ArticleItem[];
  activeCategorySlug?: string | null;
  activeCategoryTitle?: string;
  heroDescription?: string;
  initialQuery?: string;
  initialPage?: string;
  categories?: Website43BlogCategoryItem[];
  topicContent?: ReactNode;
  topicNavigation?: ReactNode;
  copyOverride?: PublicCopyValues;
  siteCopyOverride?: PublicCopyValues;
  searchEnhancement?: ReactNode;
}, copyOverride?: PublicCopyValues) {
  const copy = copyOverride ?? await getPublicCopy("blog");
  const copyText = publicCopyText(copy);


  const campaignAvailable = await isHealthHappyCampaignAvailable();
  const blogCategories: Website43BlogCategoryItem[] = [{ slug: null, title: copyText("blog.blogCategoriesText") }, ...categories];
  const activeCategory = blogCategories.find((item) => item.slug === activeCategorySlug) ?? (activeCategorySlug ? { slug: activeCategorySlug, title: activeCategoryTitle ?? copyText("blog.activeCategoryText") } : blogCategories[0]);

  return (<PublicCopyProvider values={copy}><div className={styles.root}>
      <main>
        <section className={styles.blogHero} aria-labelledby="blog-title">
          <Image
            className={styles.blogHeroImage}
            src="/assets/website-43/blog-hero.png"
            alt=""
            width={1774}
            height={887}
            sizes="(max-width: 639px) 100vw, 60vw"
            loading="eager"
            fetchPriority="high"
          />
          <div className={styles.blogHeroGradient} aria-hidden="true" />
          <Website43Navbar overlay />
          <div id="main-content" tabIndex={-1} className={styles.blogHeroCopy}>
            <h1 id="blog-title">{activeCategorySlug ? activeCategoryTitle ?? activeCategory.title : copyText("blog.activeCategoryText")}</h1>
            <p>{heroDescription ?? copyText("blog.website43BlogText")}</p>
          </div>
        </section>

        {!activeCategory.slug && campaignAvailable && <HealthHappyCountdown placement="blog" />}
        {topicContent}
        {searchEnhancement && <div className={styles.inner}>{searchEnhancement}</div>}
        <Website43BlogInteractive
          articles={articles}
          featuredArticles={featuredArticles}
          activeCategorySlug={activeCategorySlug}
          initialQuery={initialQuery}
          initialPage={initialPage}
          categories={blogCategories}
          classNames={BLOG_CLIENT_CLASS_NAMES}
        />
        {topicNavigation}
      </main>
      <Website43Footer flushBottom copy={siteCopyOverride} />
    </div></PublicCopyProvider>);
}

export default function Website43Blog(props: Parameters<typeof renderWebsite43Blog>[0]) { return renderWebsite43Blog(props, props.copyOverride); }
