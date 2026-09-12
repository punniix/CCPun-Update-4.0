'use client';

import { useEffect } from 'react';
import { getConsentData } from '@/lib/cookie-consent';

const deniedConsent = {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
} as const;

function ensureGoogleQueue() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    // eslint-disable-next-line prefer-rest-params -- Google command protocol requires Arguments, not an Array.
    window.dataLayer?.push(arguments);
  };
}

function loadGTM(gtmId: string) {
  if (document.getElementById('gtm-script')) return false;
  ensureGoogleQueue();
  window.gtag?.('consent', 'default', { ...deniedConsent, wait_for_update: 500 });
  window.gtag?.('set', 'ads_data_redaction', true);
  window.gtag?.('set', 'url_passthrough', false);
  window.dataLayer?.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const script = document.createElement('script');
  script.id = 'gtm-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
  document.head.appendChild(script);
  return true;
}

type GoogleTagManagerProps = {
  gtmId: string;
  deferUntilLoad?: boolean;
};

export default function GoogleTagManager({ gtmId, deferUntilLoad = false }: GoogleTagManagerProps) {
  useEffect(() => {
    let started = false;
    let idleHandle: number | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const apply = () => {
      const becameReady = loadGTM(gtmId);
      ensureGoogleQueue();
      window.gtag?.('consent', 'update', {
        ...deniedConsent,
        analytics_storage: getConsentData()?.analytics ? 'granted' : 'denied',
      });
      if (becameReady) window.dispatchEvent(new CustomEvent('ccpun:gtm-ready'));
    };

    const onConsent = () => {
      // Before the deferred Home start, the latest choice is already persisted
      // in localStorage. Read it once GTM starts instead of waking the provider
      // during the critical paint window.
      if (started) apply();
    };

    const start = () => {
      if (started) return;
      started = true;
      apply();
    };

    const scheduleAfterLoad = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(start, { timeout: 1000 });
      } else {
        fallbackTimer = setTimeout(start, 200);
      }
    };

    window.addEventListener('ccpun:consent', onConsent);

    if (!deferUntilLoad || document.getElementById('gtm-script')) {
      start();
    } else if (document.readyState === 'complete') {
      scheduleAfterLoad();
    } else {
      window.addEventListener('load', scheduleAfterLoad, { once: true });
    }

    return () => {
      window.removeEventListener('ccpun:consent', onConsent);
      window.removeEventListener('load', scheduleAfterLoad);
      if (idleHandle !== null && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleHandle);
      if (fallbackTimer !== null) clearTimeout(fallbackTimer);
    };
  }, [deferUntilLoad, gtmId]);

  return null;
}
