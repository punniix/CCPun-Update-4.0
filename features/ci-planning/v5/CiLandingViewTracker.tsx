'use client';

import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';
import { CI_ASSESSMENT_VERSION } from '@/features/ci-planning/calculator/constants';
import { getConsentData } from '@/lib/cookie-consent';

/**
 * v5 CI page: the same `ci_landing_view` contract as the 4.3 CILandingIntro (one event per
 * page view, only with analytics consent, queued until GTM is ready). The 4.3 intro and this
 * tracker never render on the same page, so the event count per view is unchanged.
 */
export default function CiLandingViewTracker() {
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
  return null;
}
