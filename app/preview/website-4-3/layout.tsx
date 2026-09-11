import type { Metadata } from 'next';
import Script from 'next/script';
import Website43MotionBoundary from '@/features/website-43-uat/Website43MotionBoundary';

export const metadata: Metadata = {
  title: 'Website 4.3 UAT · CCPun',
  robots: { index: false, follow: false, nocache: true },
};

export default function Website43PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://mcp.figma.com/mcp/html-to-design/capture.js" strategy="afterInteractive" />
      <Website43MotionBoundary>{children}</Website43MotionBoundary>
    </>
  );
}
