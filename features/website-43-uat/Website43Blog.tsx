'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './Website43.module.css';
import { Website43Footer, Website43Navbar } from './Website43Shared';
import type { Website43ArticleItem } from './blogData';

const FEATURED_REPEAT_COUNT = 3;

function ArticleCard({ article }: { article: Website43ArticleItem }) {
  return (
    <Link className={styles.articleCard} href={article.href}>
      <Image className={styles.articleImage} src={article.image} alt="" width={article.imageWidth} height={article.imageHeight} sizes="(max-width: 639px) calc(100vw - 48px), (max-width: 1023px) 48vw, 380px" loading="lazy" />
      <div className={styles.articleCardBody}>
        <span className={styles.articleCategory}>{article.category}</span>
        <h2 className={styles.articleTitle}>{article.title}</h2>
        <p className={styles.articleExcerpt}>{article.excerpt}</p>
        <p className={styles.articleMeta}>{article.meta}</p>
      </div>
    </Link>
  );
}

export default function Website43Blog({ articles, subtleMotion = false }: { articles: Website43ArticleItem[]; subtleMotion?: boolean }) {
  const featuredScrollerRef = useRef<HTMLDivElement>(null);
  const featuredRailRef = useRef<HTMLDivElement>(null);
  const featuredScrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const [activeFeatured, setActiveFeatured] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ทั้งหมด');
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);

  const featuredCount = articles.length;
  const loopedFeaturedArticles = useMemo(
    () => Array.from({ length: FEATURED_REPEAT_COUNT }, () => articles).flat(),
    [articles],
  );

  const categories = useMemo(
    () => ['ทั้งหมด', ...Array.from(new Set(articles.map((article) => article.category)))],
    [articles],
  );

  const filteredArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('th');
    return articles.filter((article) => {
      const matchesCategory = category === 'ทั้งหมด' || article.category === category;
      const searchable = `${article.title} ${article.excerpt} ${article.category}`.toLocaleLowerCase('th');
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [articles, category, query]);

  const centerFeaturedCard = (cardIndex: number, behavior: ScrollBehavior = 'smooth') => {
    const scroller = featuredScrollerRef.current;
    const rail = featuredRailRef.current;
    const card = rail?.children[cardIndex] as HTMLElement | undefined;
    if (!scroller || !card) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const left = scroller.scrollLeft + (cardRect.left - scrollerRect.left) - (scroller.clientWidth - cardRect.width) / 2;
    const reduceMotion = subtleMotion && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ left, behavior: reduceMotion ? 'instant' : behavior });
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      centerFeaturedCard(featuredCount, 'auto');
    });
    const onPointerDown = (event: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) setCategoryMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCategoryMenuOpen(false);
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

  const searchAndCategoryControls = (
    <div className={styles.searchFilters} style={{ marginTop: 0, marginBottom: 32 }}>
      <input
        className={styles.searchField}
        type="search"
        placeholder="ค้นหาบทความ…"
        aria-label="ค้นหาบทความ"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className={styles.categoryMenu} ref={categoryMenuRef}>
        <button
          className={styles.categoryMenuButton}
          type="button"
          aria-haspopup="menu"
          aria-expanded={categoryMenuOpen}
          onClick={() => setCategoryMenuOpen((open) => !open)}
        >
          <span>{category === 'ทั้งหมด' ? 'ทุกหมวดหมู่' : category}</span>
          <span className={`${styles.categoryMenuChevron} ${categoryMenuOpen ? styles.categoryMenuChevronOpen : ''}`} aria-hidden="true">⌄</span>
        </button>
        {categoryMenuOpen ? (
          <div className={styles.categoryMenuPanel} role="menu" aria-label="เลือกหมวดหมู่บทความ">
            {categories.map((item) => {
              const selected = category === item;
              return (
                <button
                  className={`${styles.categoryMenuOption} ${selected ? styles.categoryMenuOptionActive : ''}`}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => { setCategory(item); setCategoryMenuOpen(false); }}
                  key={item}
                >
                  <span className={styles.categoryMenuIndicator} aria-hidden="true">{selected ? '✓' : ''}</span>
                  <span>{item === 'ทั้งหมด' ? 'ทุกหมวดหมู่' : item}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className={styles.root}>
      <main id="main-content">
        <section className={styles.blogHero} aria-labelledby="blog-title">
          <Image className={styles.blogHeroImage} src="/assets/website-43/blog-hero.png" alt="" width={1774} height={887} sizes="(max-width: 639px) 100vw, 56vw" priority />
          <div className={styles.blogHeroGradient} aria-hidden="true" />
          <Website43Navbar overlay />
          <div className={styles.blogHeroCopy}>
            <h1 id="blog-title">บทความ</h1>
            <p>เข้าใจเรื่องการเงิน ประกัน การลงทุนได้ง่าย แม้จะเริ่มจาก 0</p>
          </div>
        </section>

        <section className={styles.blogContent}>
          <div className={styles.inner}>
            {searchAndCategoryControls}
            <p className={styles.eyebrow}>บทความแนะนำ</p>
          </div>
          <div className={styles.featuredViewport} aria-label="บทความแนะนำ">
            <div className={styles.featuredScroller} ref={featuredScrollerRef} onScroll={syncFeaturedDot}>
              <div className={styles.featuredRail} ref={featuredRailRef}>
                {loopedFeaturedArticles.map((article, index) => {
                  const repeatIndex = Math.floor(index / featuredCount);
                  const isPrimarySet = repeatIndex === 1;
                  return (
                    <Link
                      className={styles.featuredCard}
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
            <div className={styles.carouselControls} aria-label="เลือกบทความแนะนำ">
              {articles.map((article, index) => (
                <button
                  className={`${styles.carouselDotButton} ${index === activeFeatured ? styles.carouselDotButtonActive : ''}`}
                  type="button"
                  onClick={() => scrollFeaturedTo(index)}
                  aria-label={`แสดงบทความแนะนำ ${index + 1}: ${article.title}`}
                  aria-current={index === activeFeatured ? 'true' : undefined}
                  key={article.title}
                />
              ))}
            </div>
          </div>

          <div className={styles.inner}>
            <div className={styles.articleListHeading}>
              <h2 className={styles.h2}>บทความทั้งหมด</h2>
            </div>
            {filteredArticles.length ? (
              <div className={styles.articleGrid}>
                {filteredArticles.map((article) => <ArticleCard article={article} key={article.title} />)}
              </div>
            ) : (
              <div className={styles.emptyState}>ไม่พบบทความที่ตรงกับคำค้นหรือหมวดหมู่ที่เลือก</div>
            )}
          </div>
        </section>
      </main>
      <Website43Footer />
    </div>
  );
}
