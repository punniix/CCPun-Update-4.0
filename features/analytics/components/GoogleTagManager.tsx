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

export default function GoogleTagManager({ gtmId }: { gtmId: string }) {
  useEffect(() => {
    const apply = () => {
      const becameReady = loadGTM(gtmId);
      ensureGoogleQueue();
      window.gtag?.('consent', 'update', {
        ...deniedConsent,
        analytics_storage: getConsentData()?.analytics ? 'granted' : 'denied',
      });
      if (becameReady) window.dispatchEvent(new CustomEvent('ccpun:gtm-ready'));
    };

    apply();
    window.addEventListener('ccpun:consent', apply);
    return () => window.removeEventListener('ccpun:consent', apply);
  }, [gtmId]);

  return null;
}
