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

export default function CILandingIntro() {
  const landingTrackedRef = useRef(false);
  const storyCarouselRef = useRef<HTMLDivElement>(null);
  const [storyIndex, setStoryIndex] = useState(0);

  const scrollStories = (direction: -1 | 1) => {
    const node = storyCarouselRef.current;
    const cards = node ? Array.from(node.querySelectorAll<HTMLElement>('article')) : [];
    if (!node || cards.length === 0) return;
    const next = Math.max(0, Math.min(cards.length - 1, storyIndex + direction));
    cards[next]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    setStoryIndex(next);
  };

  const syncStoryIndex = () => {
    const node = storyCarouselRef.current;
    const cards = node ? Array.from(node.querySelectorAll<HTMLElement>('article')) : [];
    if (!node || cards.length === 0) return;
    const nearest = cards.reduce((best, card, index) => Math.abs(card.offsetLeft - node.scrollLeft) < Math.abs(cards[best].offsetLeft - node.scrollLeft) ? index : best, 0);
    setStoryIndex(nearest);
  };

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

        <div className={styles.ciStoryCarouselWrap}>
          <div ref={storyCarouselRef} onScroll={syncStoryIndex} className={styles.ciStoryGrid} aria-label="ตัวอย่างภาระทางการเงินเมื่อเจอโรคร้ายแรง">
            {storyBeats.map((beat) => (
              <article className={styles.ciStoryCard} key={beat.title}>
                <Image
                  src={beat.src}
                  alt={beat.alt}
                  width={1200}
                  height={900}
                  sizes="(max-width: 639px) 82vw, (max-width: 1023px) 46vw, 390px"
                />
                <div>
                  <h3>{beat.title}</h3>
                  <p>{beat.description}</p>
                </div>
              </article>
            ))}
          </div>
          <div className={styles.ciStoryCarouselControls} aria-label="เลื่อนการ์ดตัวอย่าง">
            <button type="button" disabled={storyIndex === 0} onClick={() => scrollStories(-1)} aria-label="ดูการ์ดก่อนหน้า"><ChevronLeft aria-hidden="true" /></button>
            <span aria-live="polite">{storyIndex + 1} / {storyBeats.length} · ปัดซ้าย–ขวาได้</span>
            <button type="button" disabled={storyIndex === storyBeats.length - 1} onClick={() => scrollStories(1)} aria-label="ดูการ์ดถัดไป"><ChevronRight aria-hidden="true" /></button>
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
