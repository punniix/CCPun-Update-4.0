'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { isAdminPagePath } from '@/lib/admin/routes';

const CookieConsent = dynamic(() => import('@/features/analytics/components/CookieConsent'), { ssr: false });
const GoogleAnalytics = dynamic(() => import('@/features/analytics/components/GoogleAnalytics'), { ssr: false });
const GoogleTagManager = dynamic(() => import('@/features/analytics/components/GoogleTagManager'), { ssr: false });
const MetaPixel = dynamic(() => import('@/features/analytics/components/MetaPixel'), { ssr: false });

export default function ClientWidgets({ gaId, gtmId, metaPixelId }: { gaId: string; gtmId: string; metaPixelId: string }) {
  const pathname = usePathname();
  const isPrivateSurface = isAdminPagePath(pathname)
    || pathname === '/studio'
    || pathname.startsWith('/studio/');
  const isMetaPixelSurface = pathname === '/ci-planning'
    || pathname.startsWith('/ci-planning/')
    || pathname === '/tools/fhc'
    || pathname.startsWith('/tools/fhc/')
    || pathname === '/tools/financial-health-check'
    || pathname.startsWith('/tools/financial-health-check/');

  if (isPrivateSurface) return null;

  return <>
    <CookieConsent />
    {gtmId && <GoogleTagManager gtmId={gtmId} deferUntilLoad={pathname === '/'} />}
    {gaId && <GoogleAnalytics gaId={gaId} />}
    {metaPixelId && isMetaPixelSurface && <MetaPixel pixelId={metaPixelId} />}
  </>;
}
