'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
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
    <section aria-labelledby="ci-problem-title" className="px-4 py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        <h2 id="ci-problem-title" className="text-2xl font-bold leading-snug text-foreground md:text-3xl">
          เพราะคำว่า “พอ” ของแต่ละคนไม่เท่ากัน
        </h2>
        <div className="mt-5 max-w-3xl space-y-4 text-base leading-relaxed text-muted-foreground">
          <p>หลายๆ คน รวมถึงผม พอเริ่มคิดเรื่องทุนประกันโรคร้ายแรง ก็มักติดอยู่กับคำถามเดียวกันว่า “ต้องมีเท่าไรถึงจะพอ?”</p>
          <p>เพราะเราไม่รู้ล่วงหน้าว่าโรคร้ายแรงจะเกิดเมื่อไร ต้องพักรักษาตัวนานแค่ไหน หรือรายได้จะหายไปเท่าไร แต่ค่าบ้าน ค่ารถ หนี้บัตรเครดิต ค่าเทอมลูก และค่าใช้จ่ายในครอบครัวยังเดินต่อ</p>
          <p>ผมจึงลองแยกรายได้และภาระทีละส่วน วางตามช่วงเวลาที่ต้องรับผิดชอบจริง แล้วเทียบกับเงินก้อนจากประกันโรคร้ายแรงและสินทรัพย์ที่พร้อมใช้ เพื่อให้เห็นที่มาของตัวเลขชัดขึ้น</p>
        </div>

        <ul className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {storyBeats.map((beat, index) => (
            <li key={beat.title} className={index === 2 ? 'md:col-span-2 md:mx-auto md:w-[calc(50%-1rem)] lg:col-span-1 lg:mx-0 lg:w-auto' : undefined}>
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <Image src={beat.src} alt={beat.alt} fill loading="lazy" sizes="(max-width: 767px) calc(100vw - 2rem), (max-width: 1023px) 46vw, 320px" className="object-cover" />
                <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(90deg, hsl(var(--background)) 0%, transparent 10%, transparent 90%, hsl(var(--background)) 100%)' }} />
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4" style={{ background: 'linear-gradient(180deg, transparent 0%, hsl(var(--background)) 100%)' }} />
              </div>
              <div className="border-l border-primary/40 pl-4">
                <h3 className="text-lg font-semibold text-foreground">{beat.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{beat.description}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">ภาพประกอบสร้างด้วย Generative AI</p>
        <p className="mt-10 max-w-3xl text-base leading-relaxed text-foreground/90">
          เมื่อแยกทีละส่วน คุณจะเห็นที่มาของตัวเลข ภาระส่วนไหนต้องดูแลอีกนาน และเงินก้อนจากประกันโรคร้ายแรงที่มีอยู่ช่วยรองรับได้เพียงใด
        </p>
        <p className="mt-8 border-t border-border/30 pt-5 text-sm leading-relaxed text-muted-foreground">
          ผลลัพธ์เป็นประมาณการเบื้องต้นจากข้อมูลและสมมติฐานที่คุณกรอก ไม่ใช่คำแนะนำเฉพาะบุคคล
          และไม่ยืนยันว่าจำนวนเงินจะเพียงพอในทุกกรณี โปรดศึกษารายละเอียดความคุ้มครอง เงื่อนไข
          และข้อยกเว้นของกรมธรรม์ก่อนตัดสินใจทำประกันภัย และประกันไม่ใช่เงินฝาก
        </p>
      </div>
    </section>
  );
}
