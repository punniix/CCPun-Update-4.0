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
  const isUat = process.env.NEXT_PUBLIC_CCPUN_APP_ENV === 'web-uat'
    || window.location.hostname === 'test.ccpun.com';
  const cookieDomain = isUat ? 'test.ccpun.com' : '.ccpun.com';
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=', 1)[0]?.trim();
    // Match UAT's GTM cookie_prefix without deleting Production parent cookies.
    if (!name || (isUat
      ? name !== 'ccpun_uat_ga' && !name.startsWith('ccpun_uat_ga_')
      : !name.startsWith('_ga'))) continue;
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    document.cookie = `${name}=; Path=/; Domain=${cookieDomain}; Max-Age=0; SameSite=Lax`;
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
        : path === '/blog' || path.startsWith('/blog/') ? 'blog'
        : path === '/' ? 'homepage'
        // v5 (owner-approved 2026-10-25): the GTM lin.ee click tag is paused, so these pages need
        // their own semantic line_oa_click too.
        : path.startsWith('/play/money-story') ? 'money_story'
        : path === '/tools' || path === '/tools/' || path.startsWith('/tools/investment-allocation') || path.startsWith('/tools/aia-fund-allocation') ? 'tools'
        : null;
      const campaign = link.closest<HTMLElement>('[data-campaign="aia-health-happy-2026"]');
      const placement = campaign?.dataset.campaignPlacement;
      const safePlacement = placement === 'home' || placement === 'blog' || placement === 'article' ? placement : undefined;
      const explicitLocation = link.dataset.analyticsLocation;
      const allowedLocation = explicitLocation === 'navbar' || explicitLocation === 'navbar_mobile' || explicitLocation === 'home_faq' || explicitLocation === 'tools_hub'
        ? explicitLocation : null;
      const location = (campaign && safePlacement) ? 'countdown' : allowedLocation ?? (nav ? (link.closest('#mobile-navigation') ? 'navbar_mobile' : 'navbar')
        : link.closest('#home') ? 'home_hero'
        : link.closest('[data-uat-section="contact"]') ? 'home_contact'
        : surface === 'fhc' ? 'fhc_landing'
        : surface === 'blog' ? 'blog_article'
        : null);
      if (!surface || !location) return;
      trackEvent('line_oa_click', {
        contact_channel: 'line', cta_location: location, surface_group: surface,
        ...(campaign && safePlacement ? { campaign_id: 'aia_health_happy_2026', campaign_placement: safePlacement } : {}),
      });
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
