'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Website43ArticleItem } from './blogData';

export type Website43BlogCategoryItem = {
  slug: string | null;
  title: string;
};

export type Website43BlogClientClassNames = {
  articleCard: string;
  articleImage: string;
  articleCardBody: string;
  articleCategory: string;
  articleTitle: string;
  articleExcerpt: string;
  articleMeta: string;
  blogContent: string;
  inner: string;
  eyebrow: string;
  featuredViewport: string;
  featuredScroller: string;
  featuredRail: string;
  featuredCard: string;
  carouselControls: string;
  carouselDotButton: string;
  carouselDotButtonActive: string;
  searchFilters: string;
  searchField: string;
  categoryMenu: string;
  categoryMenuButton: string;
  categoryMenuChevron: string;
  categoryMenuChevronOpen: string;
  categoryMenuPanel: string;
  categoryMenuOption: string;
  categoryMenuOptionActive: string;
  categoryMenuIndicator: string;
  articleListHeading: string;
  h2: string;
  articleGrid: string;
  emptyState: string;
};

const FEATURED_REPEAT_COUNT = 3;

function ArticleCard({ article, classNames }: { article: Website43ArticleItem; classNames: Website43BlogClientClassNames }) {
  return (
    <Link className={classNames.articleCard} href={article.href}>
      <Image className={classNames.articleImage} src={article.image} alt="" width={article.imageWidth} height={article.imageHeight} sizes="(max-width: 639px) calc(100vw - 48px), (max-width: 1023px) 48vw, 380px" loading="lazy" />
      <div className={classNames.articleCardBody}>
        <span className={classNames.articleCategory}>{article.category}</span>
        <h2 className={classNames.articleTitle}>{article.title}</h2>
        <p className={classNames.articleExcerpt}>{article.excerpt}</p>
        <p className={classNames.articleMeta}>{article.meta}</p>
      </div>
    </Link>
  );
}

export default function Website43BlogInteractive({
  articles,
  featuredArticles,
  activeCategorySlug = null,
  initialQuery = '',
  categories,
  classNames,
}: {
  articles: Website43ArticleItem[];
  featuredArticles?: Website43ArticleItem[];
  activeCategorySlug?: string | null;
  initialQuery?: string;
  categories: Website43BlogCategoryItem[];
  classNames: Website43BlogClientClassNames;
}) {
  const router = useRouter();
  const featuredScrollerRef = useRef<HTMLDivElement>(null);
  const featuredRailRef = useRef<HTMLDivElement>(null);
  const featuredScrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const categoryButtonRef = useRef<HTMLButtonElement>(null);
  const [activeFeatured, setActiveFeatured] = useState(0);
  const [query, setQuery] = useState(initialQuery);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);

  const featuredSource = featuredArticles ?? articles;
  const featuredCount = featuredSource.length;
  const loopedFeaturedArticles = useMemo(
    () => Array.from({ length: FEATURED_REPEAT_COUNT }, () => featuredSource).flat(),
    [featuredSource],
  );

  const activeCategory = categories.find((item) => item.slug === activeCategorySlug) ?? categories[0];

  const filteredArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('th');
    return articles.filter((article) => {
      const searchable = `${article.title} ${article.excerpt} ${article.category} ${article.tags.join(" ")}`.toLocaleLowerCase('th');
      return !normalizedQuery || searchable.includes(normalizedQuery);
    });
  }, [articles, query]);

  useEffect(() => {
    const syncQuery = () => setQuery(new URLSearchParams(window.location.search).get('q') ?? '');
    // A cached App Router entry can remount after popstate has already fired.
    // Read the restored URL once on mount as well as on subsequent history changes.
    syncQuery();
    window.addEventListener('popstate', syncQuery);
    return () => window.removeEventListener('popstate', syncQuery);
  }, []);

  const centerFeaturedCard = (cardIndex: number, behavior: ScrollBehavior = 'smooth') => {
    const scroller = featuredScrollerRef.current;
    const rail = featuredRailRef.current;
    const card = rail?.children[cardIndex] as HTMLElement | undefined;
    if (!scroller || !card) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const left = scroller.scrollLeft + (cardRect.left - scrollerRect.left) - (scroller.clientWidth - cardRect.width) / 2;
    scroller.scrollTo({ left, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : behavior });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      centerFeaturedCard(featuredCount, 'auto');
    });
    const onPointerDown = (event: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) setCategoryMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && categoryMenuRef.current?.contains(document.activeElement)) {
        setCategoryMenuOpen(false);
        categoryButtonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      if (featuredScrollEndTimerRef.current) clearTimeout(featuredScrollEndTimerRef.current);
    };
  }, [featuredCount]);

  const scrollFeaturedTo = (index: number) => {
    centerFeaturedCard(featuredCount + index, 'smooth');
    setActiveFeatured(index);
  };

  const syncFeaturedDot = () => {
    const scroller = featuredScrollerRef.current;
    const rail = featuredRailRef.current;
    if (!scroller || !rail || featuredCount === 0) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const center = scrollerRect.left + scrollerRect.width / 2;
    const cards = Array.from(rail.children) as HTMLElement[];
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const logicalIndex = nearestIndex % featuredCount;
    setActiveFeatured(logicalIndex);

    if (featuredScrollEndTimerRef.current) clearTimeout(featuredScrollEndTimerRef.current);
    featuredScrollEndTimerRef.current = setTimeout(() => {
      if (nearestIndex < featuredCount || nearestIndex >= featuredCount * 2) {
        centerFeaturedCard(featuredCount + logicalIndex, 'auto');
      }
    }, 120);
  };

  return (
    <section className={classNames.blogContent}>
      <div className={classNames.inner}>
        <p className={classNames.eyebrow}>บทความแนะนำ</p>
      </div>
      {featuredCount > 0 ? <div className={classNames.featuredViewport} aria-label="บทความแนะนำ">
        <div className={classNames.featuredScroller} ref={featuredScrollerRef} onScroll={syncFeaturedDot}>
          <div className={classNames.featuredRail} ref={featuredRailRef}>
            {loopedFeaturedArticles.map((article, index) => {
              const repeatIndex = Math.floor(index / featuredCount);
              const isPrimarySet = repeatIndex === 1;
              return (
                <Link
                  className={classNames.featuredCard}
                  href={article.href}
                  key={`${repeatIndex}-${article.href}`}
                  aria-label={isPrimarySet ? article.title : undefined}
                  aria-hidden={isPrimarySet ? undefined : true}
                  tabIndex={isPrimarySet ? undefined : -1}
                >
                  <Image src={article.image} alt="" width={article.imageWidth} height={article.imageHeight} sizes="(max-width: 639px) 274px, (max-width: 1023px) 300px, 480px" loading={isPrimarySet ? undefined : 'lazy'} />
                </Link>
              );
            })}
          </div>
        </div>
        <div className={classNames.carouselControls} aria-label="เลือกบทความแนะนำ">
          {featuredSource.map((article, index) => (
            <button
              className={`${classNames.carouselDotButton} ${index === activeFeatured ? classNames.carouselDotButtonActive : ''}`}
              type="button"
              onClick={() => scrollFeaturedTo(index)}
              aria-label={`แสดงบทความแนะนำ ${index + 1}: ${article.title}`}
              aria-current={index === activeFeatured ? 'true' : undefined}
              key={article.href}
            />
          ))}
        </div>
      </div> : null}
      <div className={classNames.inner}>
        <div className={classNames.searchFilters}>
          <input
            className={classNames.searchField}
            type="search"
            placeholder="ค้นหาบทความ…"
            aria-label="ค้นหาบทความ"
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              const url = new URL(window.location.href);
              if (value.trim()) url.searchParams.set('q', value); else url.searchParams.delete('q');
              try {
                router.replace(url.pathname + url.search, { scroll: false });
              } catch {
                const nativeReplaceState = Object.getPrototypeOf(window.history).replaceState as History['replaceState'];
                nativeReplaceState.call(window.history, window.history.state, '', url.pathname + url.search);
              }
            }}
          />
          <div className={classNames.categoryMenu} ref={categoryMenuRef} onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCategoryMenuOpen(false);
          }}>
            <button
              ref={categoryButtonRef}
              className={classNames.categoryMenuButton}
              type="button"
              aria-controls="blog-category-options"
              aria-expanded={categoryMenuOpen}
              onClick={() => setCategoryMenuOpen((open) => !open)}
            >
              <span>{activeCategory.title}</span>
              <span className={`${classNames.categoryMenuChevron} ${categoryMenuOpen ? classNames.categoryMenuChevronOpen : ''}`} aria-hidden="true">⌄</span>
            </button>
            {categoryMenuOpen ? (
              <nav id="blog-category-options" className={classNames.categoryMenuPanel} aria-label="เลือกหมวดหมู่บทความ">
                {categories.map((item) => {
                  const selected = activeCategory.slug === item.slug;
                  return (
                    <Link
                      className={`${classNames.categoryMenuOption} ${selected ? classNames.categoryMenuOptionActive : ''}`}
                      href={item.slug ? `/blog/${item.slug}/` : '/blog/'}
                      aria-current={selected ? 'page' : undefined}
                      onClick={() => setCategoryMenuOpen(false)}
                      key={item.title}
                    >
                      <span className={classNames.categoryMenuIndicator} aria-hidden="true">{selected ? '✓' : ''}</span>
                      <span>{item.title}</span>
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </div>
        </div>
        <div className={classNames.articleListHeading}>
          <h2 className={classNames.h2}>{activeCategory.slug ? `บทความ${activeCategory.title}` : 'บทความทั้งหมด'}</h2>
        </div>
        {filteredArticles.length ? (
          <div className={classNames.articleGrid}>
            {filteredArticles.map((article) => <ArticleCard article={article} classNames={classNames} key={article.href} />)}
          </div>
        ) : (
          <div className={classNames.emptyState}>ไม่พบบทความที่ตรงกับคำค้นหรือหมวดหมู่ที่เลือก</div>
        )}
      </div>
    </section>
  );
}
