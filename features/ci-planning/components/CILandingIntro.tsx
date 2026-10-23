"use client";

import { useEffect, useRef } from 'react';
import { usePublicCopy } from '@/components/ui/PublicCopyProvider';
import { CI_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';
import styles from '@/components/layout/website-43/Website43.module.css';
import { trackEvent } from '@/lib/analytics';
import { CI_ASSESSMENT_VERSION } from '@/features/ci-planning/calculator/constants';
import { getConsentData } from '@/lib/cookie-consent';

export default function CILandingIntro() {
  const t = usePublicCopy(CI_COPY_DEFAULTS);
  const landingTrackedRef = useRef(false);
  const storyBeats = [
    { title: t('ci.story.title'), description: t('ci.story.description') },
    { title: t('ci.story.title2'), description: t('ci.story.description2') },
    { title: t('ci.story.title3'), description: t('ci.story.description3') },
  ];

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
        <h2 id="ci-problem-title" className={styles.h2}>{t('ci.story.problemTitle.heading')}</h2>
        <div className={styles.storyCopy}>
          <p>{t('ci.story.description4')}</p>
          <p>{t('ci.story.description5')}</p>
          <p>{t('ci.story.description6')}</p>
        </div>
        {/* ponytail: three static scenarios need no looping images, timers or motion state. */}
        <div className="mt-8 grid gap-6 sm:grid-cols-3" aria-label={t('ci.story.ariaLabel')} data-ui="ci-trust-scenarios">
          {storyBeats.map((beat, index) => (
            <article key={index} className="border-t border-white/15 py-5">
              <span className="text-sm font-medium tabular-nums text-primary" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 text-lg font-medium text-foreground">{beat.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{beat.description}</p>
            </article>
          ))}
        </div>
        <p className={styles.lead}>{t('ci.story.description8')}</p>
      </div>
    </section>
  );
}
