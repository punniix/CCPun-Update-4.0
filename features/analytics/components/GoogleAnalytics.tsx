'use client';

import { useEffect } from 'react';
import { CCPUN_SITE_VERSION, clearPendingAnalyticsEvents, flushPendingAnalyticsEvents, trackEvent } from '@/lib/analytics';
import { getConsentData } from '@/lib/cookie-consent';

function loadGA(gaId: string) {
  if (!document.getElementById('gtm-script') || typeof window.gtag !== 'function') return;
  window.gtag('set', { site_version: CCPUN_SITE_VERSION });
  // GTM owns GA initialization after the semantic cutover; keep the native fallback below.
  if (process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED === 'true' || document.getElementById('ga-script')) {
    return flushPendingAnalyticsEvents('analytics');
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params -- Google command protocol requires Arguments, not an Array.
    window.dataLayer?.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', gaId);
  const script = document.createElement('script');
  script.id = 'ga-script'; script.async = true; script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script);
  flushPendingAnalyticsEvents('analytics');
}

function disableGA() {
  clearPendingAnalyticsEvents('analytics');
  window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
  document.getElementById('ga-script')?.remove();
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=', 1)[0]?.trim();
    if (!name?.startsWith('_ga')) continue;
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    document.cookie = `${name}=; Path=/; Domain=.ccpun.com; Max-Age=0; SameSite=Lax`;
  }
  if (!document.getElementById('gtm-script')) {
    delete window.gtag;
    delete window.dataLayer;
  }
}

export default function GoogleAnalytics({ gaId }: { gaId: string }) {
  useEffect(() => {
    const apply = () => getConsentData()?.analytics ? loadGA(gaId) : disableGA();
    const trackLineClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href^="https://lin.ee/"]');
      if (!link || link.closest('#ci-calculator, #fhc-calculator')) return;

      const path = window.location.pathname;
      if (path.startsWith('/privacy') || path.startsWith('/cookie-policy')) return;

      const nav = link.closest('nav');
      const surface = path.startsWith('/ci-planning') ? 'ci_planning'
        : path.startsWith('/tools/fhc') || path.startsWith('/tools/financial-health-check') ? 'fhc'
        : path.startsWith('/blog/') ? 'blog'
        : path === '/' ? 'homepage'
        : null;
      const explicitLocation = link.dataset.analyticsLocation;
      const allowedLocation = explicitLocation === 'navbar' || explicitLocation === 'navbar_mobile' || explicitLocation === 'home_faq'
        ? explicitLocation : null;
      const location = allowedLocation ?? (nav ? (link.closest('#mobile-navigation') ? 'navbar_mobile' : 'navbar')
        : link.closest('#home') ? 'home_hero'
        : link.closest('[data-uat-section="contact"]') ? 'home_contact'
        : surface === 'fhc' ? 'fhc_landing'
        : surface === 'blog' ? 'blog_article'
        : null);
      if (!surface || !location) return;
      trackEvent('line_oa_click', { contact_channel: 'line', cta_location: location, surface_group: surface });
    };

    apply();
    window.addEventListener('ccpun:consent', apply);
    window.addEventListener('ccpun:gtm-ready', apply);
    document.addEventListener('click', trackLineClick);
    return () => {
      window.removeEventListener('ccpun:consent', apply);
      window.removeEventListener('ccpun:gtm-ready', apply);
      document.removeEventListener('click', trackLineClick);
    };
  }, [gaId]);
  return null;
}
