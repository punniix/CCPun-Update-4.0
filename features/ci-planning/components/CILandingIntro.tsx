'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import styles from '@/components/layout/website-43/Website43.module.css';
import { trackEvent } from '@/lib/analytics';
import { CI_ASSESSMENT_VERSION } from '@/features/ci-planning/calculator/constants';
import { getConsentData } from '@/lib/cookie-consent';

const storyBeats = [
  {
    title: 'รายได้ที่หายไป',
    description: 'ถ้าต้องพักรักษาตัวไม่กี่วัน ก็อาจขาดรายได้ไม่กี่วัน แต่ถ้าต้องรักษาตัวหลายเดือน รายได้ที่เคยมีก็อาจหายจนเหลือศูนย์',
    src: '/assets/ci-story-income-v6.webp',
    alt: 'ภาพประกอบผู้รับการรักษาด้วยคีโมกำลังทบทวนค่าใช้จ่ายกับคู่ชีวิต ขณะที่งานและรายได้อาจหยุดลง',
  },
  {
    title: 'ค่าบ้าน รถ และภาระค่าใช้จ่ายอื่นๆ',
    description: 'ถ้าเสาหลักต้องหยุดรักษาตัว ค่าบ้าน รถ บัตรเครดิต และสินเชื่อส่วนบุคคลอาจกลายเป็นภาระที่ครอบครัวต้องช่วยกันรับต่อ',
    src: '/assets/ci-story-debt-v6.webp',
    alt: 'ภาพประกอบครอบครัวกำลังทบทวนค่างวดบ้าน รถ และค่าใช้จ่ายที่ยังต้องดูแล',
  },
  {
    title: 'ทุนประกันโรคร้ายแรงที่มีอยู่ และสินทรัพย์',
    description: 'ผมจึงเทียบภาระกับทุนประกันโรคร้ายแรง รวมถึงสินทรัพย์ที่พร้อมเปลี่ยนเป็นเงินสดได้เร็ว',
    src: '/assets/ci-story-coverage-v6.webp',
    alt: 'ภาพประกอบครอบครัวหลายวัยกำลังทบทวนเงินก้อนจากประกันโรคร้ายแรงและสินทรัพย์ที่พร้อมใช้',
  },
] as const;

const loopedStories = Array.from({ length: 9 }, (_, index) => storyBeats[index % storyBeats.length]);

function centerStory(node: HTMLDivElement, index: number, behavior: ScrollBehavior) {
  const card = node.querySelectorAll<HTMLElement>('article')[index];
  if (card) node.scrollTo({ left: card.offsetLeft - (node.clientWidth - card.clientWidth) / 2, behavior });
}

export default function CILandingIntro() {
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
  }, [isMobile]);

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
  }, [isMobile, isHovered, isFocused, hasInteracted, isPageHidden, reducedMotion, storyIndex]);

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
        <h2 id="ci-problem-title" className={styles.h2}>เพราะคำว่า “พอ” ของแต่ละคนไม่เท่ากัน</h2>
        <div className={styles.storyCopy}>
          <p>หลายๆ คน รวมถึงผม พอเริ่มคิดเรื่องทุนประกันโรคร้ายแรง ก็มักติดอยู่กับคำถามเดียวกันว่า “ต้องมีเท่าไรถึงจะพอ?”</p>
          <p>เพราะเราไม่รู้ล่วงหน้าว่าโรคร้ายแรงจะเกิดเมื่อไร ต้องพักรักษาตัวนานแค่ไหน หรือรายได้จะหายไปเท่าไร แต่ค่าบ้าน ค่ารถ หนี้บัตรเครดิต ค่าเทอมลูก และค่าใช้จ่ายในครอบครัวยังเดินต่อ</p>
          <p>ผมจึงลองแยกรายได้และภาระทีละส่วน วางตามช่วงเวลาที่ต้องรับผิดชอบจริง แล้วเทียบกับเงินก้อนจากประกันโรคร้ายแรงและสินทรัพย์ที่พร้อมใช้ เพื่อให้เห็นที่มาของตัวเลขชัดขึ้น</p>
        </div>

        <div
          className={styles.ciStoryCarouselWrap}
          onPointerEnter={(event) => { if (event.pointerType === 'mouse') setIsHovered(true); }}
          onPointerLeave={(event) => { if (event.pointerType === 'mouse') setIsHovered(false); }}
          onFocusCapture={() => setIsFocused(true)}
          onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false); }}
        >
          <div className={styles.ciStoryViewport}>
            <div ref={storyCarouselRef} onScroll={syncStoryIndex} onPointerDown={() => setHasInteracted(true)} onWheel={(event) => { if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) setHasInteracted(true); }} onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') setHasInteracted(true); }} tabIndex={isMobile ? 0 : -1} className={styles.ciStoryGrid} aria-label="ตัวอย่างภาระทางการเงินเมื่อเจอโรคร้ายแรง">
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
            <div className={styles.ciStoryCarouselControls} aria-label="เลื่อนการ์ดตัวอย่าง">
              <button data-ci-story-arrow type="button" onClick={() => scrollStories(-1)} aria-label="ดูการ์ดก่อนหน้า"><ChevronLeft aria-hidden="true" /></button>
              <button data-ci-story-arrow type="button" onClick={() => scrollStories(1)} aria-label="ดูการ์ดถัดไป"><ChevronRight aria-hidden="true" /></button>
            </div>
          </div>
        </div>
        <p className={styles.eyebrow} style={{ marginTop: 20 }}>ภาพประกอบสร้างด้วย Generative AI</p>
        <p className={styles.lead}>
          เมื่อแยกทีละส่วน คุณจะเห็นที่มาของตัวเลข ภาระส่วนไหนต้องดูแลอีกนาน และเงินก้อนจากประกันโรคร้ายแรงที่มีอยู่ช่วยรองรับได้เพียงใด
        </p>
      </div>
    </section>
  );
}
