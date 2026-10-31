'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { isAdminPagePath } from '@/lib/routing/private-surfaces';

const CookieConsent = dynamic(() => import('@/features/analytics/components/CookieConsent'), { ssr: false });
const GoogleAnalytics = dynamic(() => import('@/features/analytics/components/GoogleAnalytics'), { ssr: false });
const GoogleTagManager = dynamic(() => import('@/features/analytics/components/GoogleTagManager'), { ssr: false });

export default function ClientWidgets({ gaId, gtmId, metaPixelId }: { gaId: string; gtmId: string; metaPixelId: string }) {
  // Legacy prop remains only for the existing server layout contract; no Facebook SDK is mounted.
  void metaPixelId;
  const pathname = usePathname();
  const isPrivateSurface = isAdminPagePath(pathname)
    || pathname === '/studio'
    || pathname.startsWith('/studio/');

  if (isPrivateSurface) return null;

  return <>
    <CookieConsent />
    {gtmId && <GoogleTagManager gtmId={gtmId} deferUntilLoad={pathname === '/'} />}
    {gaId && <GoogleAnalytics gaId={gaId} />}
  </>;
}
