'use client';

import Image from 'next/image';
import { usePublicCopy } from '@/components/ui/PublicCopyProvider';
import { CI_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import styles from '@/components/layout/website-43/Website43.module.css';
import { trackEvent } from '@/lib/analytics';
import { CI_ASSESSMENT_VERSION } from '@/features/ci-planning/calculator/constants';
import { getConsentData } from '@/lib/cookie-consent';


function centerStory(node: HTMLDivElement, index: number, behavior: ScrollBehavior) {
  const card = node.querySelectorAll<HTMLElement>('article')[index];
  if (card) node.scrollTo({ left: card.offsetLeft - (node.clientWidth - card.clientWidth) / 2, behavior });
}

export default function CILandingIntro() {
  const t = usePublicCopy(CI_COPY_DEFAULTS);
const storyBeats = [
  {
    title: t("ci.story.title"),
    description: t("ci.story.description"),
    src: '/assets/ci-story-income-v6.webp',
    alt: t("ci.story.alt"),
  },
  {
    title: t("ci.story.title2"),
    description: t("ci.story.description2"),
    src: '/assets/ci-story-debt-v6.webp',
    alt: t("ci.story.alt2"),
  },
  {
    title: t("ci.story.title3"),
    description: t("ci.story.description3"),
    src: '/assets/ci-story-coverage-v6.webp',
    alt: t("ci.story.alt3"),
  },
] as const;

const loopedStories = Array.from({ length: 9 }, (_, index) => storyBeats[index % storyBeats.length]);


  const landingTrackedRef = useRef(false);
  const storyCarouselRef = useRef<HTMLDivElement>(null);
  const storyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [storyIndex, setStoryIndex] = useState(3);
  const [isMobile, setIsMobile] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isPageHidden, setIsPageHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const scrollStories = (direction: -1 | 1) => {
    const node = storyCarouselRef.current;
    if (!node) return;
    setHasInteracted(true);
    const next = Math.max(1, Math.min(loopedStories.length - 2, storyIndex + direction));
    centerStory(node, next, reducedMotion ? 'auto' : 'smooth');
    setStoryIndex(next);
  };

  const syncStoryIndex = () => {
    const node = storyCarouselRef.current;
    if (!node || !isMobile) return;
    const cards = Array.from(node.querySelectorAll<HTMLElement>('article'));
    const center = node.scrollLeft + node.clientWidth / 2;
    const nearest = cards.reduce((best, card, index) => Math.abs(card.offsetLeft + card.clientWidth / 2 - center) < Math.abs(cards[best].offsetLeft + cards[best].clientWidth / 2 - center) ? index : best, 0);
    setStoryIndex(nearest);
    if (storyResetTimerRef.current) clearTimeout(storyResetTimerRef.current);
    if (nearest < 3 || nearest > 5) {
      // ponytail: three repeated sets make wrap-around seamless; recenter after scrolling settles.
      storyResetTimerRef.current = setTimeout(() => {
        centerStory(node, nearest < 3 ? nearest + 3 : nearest - 3, 'auto');
      }, 650);
    }
  };

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 639px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMedia = () => {
      setIsMobile(mobile.matches);
      setReducedMotion(motion.matches);
    };
    const syncVisibility = () => setIsPageHidden(document.hidden);
    syncMedia();
    syncVisibility();
    mobile.addEventListener('change', syncMedia);
    motion.addEventListener('change', syncMedia);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      mobile.removeEventListener('change', syncMedia);
      motion.removeEventListener('change', syncMedia);
      document.removeEventListener('visibilitychange', syncVisibility);
      if (storyResetTimerRef.current) clearTimeout(storyResetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isMobile && storyCarouselRef.current) centerStory(storyCarouselRef.current, 3, 'auto');
  }, [isMobile, loopedStories.length]);

  useEffect(() => {
    if (!isMobile || isHovered || isFocused || hasInteracted || isPageHidden || reducedMotion) return;
    const timer = setTimeout(() => {
      const node = storyCarouselRef.current;
      if (!node) return;
      const next = Math.min(loopedStories.length - 2, storyIndex + 1);
      centerStory(node, next, 'smooth');
      setStoryIndex(next);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isMobile, isHovered, isFocused, hasInteracted, isPageHidden, reducedMotion, storyIndex, loopedStories.length]);

  useEffect(() => {
    const trackLanding = () => {
      if (landingTrackedRef.current || !getConsentData()?.analytics) return;
      if (process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED === 'true' && !document.getElementById('gtm-script')) return;
      landingTrackedRef.current = true;
      trackEvent('ci_landing_view', {
        tool_name: 'ci_planning',
        cta_location: 'ci_landing',
        calculator_version: CI_ASSESSMENT_VERSION,
      });
    };
    const queueLanding = () => queueMicrotask(trackLanding);
    queueLanding();
    window.addEventListener('ccpun:consent', queueLanding);
    window.addEventListener('ccpun:gtm-ready', queueLanding);
    return () => {
      window.removeEventListener('ccpun:consent', queueLanding);
      window.removeEventListener('ccpun:gtm-ready', queueLanding);
    };
  }, []);

  return (
    <section aria-labelledby="ci-problem-title" className={styles.toolStorySection}>
      <div className={styles.inner}>
        <h2 id="ci-problem-title" className={styles.h2}>{t.node("ci.story.problemTitle.heading")}</h2>
        <div className={styles.storyCopy}>
          <p>{t.node("ci.story.description4")}</p>
          <p>{t.node("ci.story.description5")}</p>
          <p>{t.node("ci.story.description6")}</p>
        </div>

        <div
          className={styles.ciStoryCarouselWrap}
          onPointerEnter={(event) => { if (event.pointerType === 'mouse') setIsHovered(true); }}
          onPointerLeave={(event) => { if (event.pointerType === 'mouse') setIsHovered(false); }}
          onFocusCapture={() => setIsFocused(true)}
          onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false); }}
        >
          <div className={styles.ciStoryViewport}>
            <div ref={storyCarouselRef} onScroll={syncStoryIndex} onPointerDown={() => setHasInteracted(true)} onWheel={(event) => { if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) setHasInteracted(true); }} onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') setHasInteracted(true); }} tabIndex={isMobile ? 0 : -1} className={styles.ciStoryGrid} aria-label={t("ci.story.ariaLabel")}>
            {loopedStories.map((beat, index) => (
              <article className={styles.ciStoryCard} key={`${beat.title}-${index}`} aria-hidden={isMobile ? index !== storyIndex : index >= storyBeats.length}>
                <Image
                  src={beat.src}
                  alt={beat.alt}
                  width={1200}
                  height={900}
                  sizes="(max-width: 639px) 78vw, (max-width: 1023px) 46vw, 390px"
                />
                <div>
                  <h3>{beat.title}</h3>
                  <p>{beat.description}</p>
                </div>
              </article>
            ))}
            </div>
            <div className={styles.ciStoryCarouselControls} aria-label={t("ci.story.ariaLabel2")}>
              <button data-ci-story-arrow type="button" onClick={() => scrollStories(-1)} aria-label={t("ci.story.ariaLabel3")}><ChevronLeft aria-hidden="true" /></button>
              <button data-ci-story-arrow type="button" onClick={() => scrollStories(1)} aria-label={t("ci.story.ariaLabel4")}><ChevronRight aria-hidden="true" /></button>
            </div>
          </div>
        </div>
        <p className={styles.eyebrow} style={{ marginTop: 20 }}>{t.node("ci.story.description7")}</p>
        <p className={styles.lead}>
          เมื่อแยกทีละส่วน คุณจะเห็นที่มาของตัวเลข ภาระส่วนไหนต้องดูแลอีกนาน และเงินก้อนจากประกันโรคร้ายแรงที่มีอยู่ช่วยรองรับได้เพียงใด
        </p>
      </div>
    </section>
  );
}
