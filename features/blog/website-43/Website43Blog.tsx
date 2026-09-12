import Image from 'next/image';
import type { ReactNode } from 'react';
import styles from '@/components/layout/website-43/Website43.module.css';
import { Website43Footer, Website43Navbar } from '@/components/layout/website-43/Website43Shared';
import type { Website43ArticleItem } from './blogData';
import { BLOG_TOPIC_HUBS } from '@/lib/content/taxonomy';
import Website43BlogInteractive, {
  type Website43BlogCategoryItem,
  type Website43BlogClientClassNames,
} from './Website43BlogInteractive';

const BLOG_CATEGORIES: Website43BlogCategoryItem[] = [
  { slug: null, title: 'ทุกหมวดหมู่' },
  ...BLOG_TOPIC_HUBS.map(({ slug, title }) => ({ slug, title })),
];

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
} satisfies Website43BlogClientClassNames;

export default function Website43Blog({ articles, featuredArticles, activeCategorySlug = null, initialQuery = '', topicContent, topicNavigation }: {
  articles: Website43ArticleItem[];
  featuredArticles?: Website43ArticleItem[];
  activeCategorySlug?: string | null;
  initialQuery?: string;
  topicContent?: ReactNode;
  topicNavigation?: ReactNode;
}) {
  const activeCategory = BLOG_CATEGORIES.find((item) => item.slug === activeCategorySlug) ?? BLOG_CATEGORIES[0];

  return (
    <div className={styles.root}>
      <main id="main-content" tabIndex={-1}>
        <section className={styles.blogHero} aria-labelledby="blog-title">
          <Image className={styles.blogHeroImage} src="/assets/website-43/blog-hero.png" alt="" width={1774} height={887} sizes="(max-width: 639px) 100vw, 56vw" priority />
          <div className={styles.blogHeroGradient} aria-hidden="true" />
          <Website43Navbar overlay />
          <div className={styles.blogHeroCopy}>
            <h1 id="blog-title">{activeCategory.slug ? activeCategory.title : 'บทความ'}</h1>
            <p>เข้าใจเรื่องการเงิน ประกัน การลงทุนได้ง่าย แม้จะเริ่มจาก 0</p>
          </div>
        </section>

        {topicContent}
        <Website43BlogInteractive
          articles={articles}
          featuredArticles={featuredArticles}
          activeCategorySlug={activeCategorySlug}
          initialQuery={initialQuery}
          categories={BLOG_CATEGORIES}
          classNames={BLOG_CLIENT_CLASS_NAMES}
        />
        {topicNavigation}
      </main>
      <Website43Footer />
    </div>
  );
}
