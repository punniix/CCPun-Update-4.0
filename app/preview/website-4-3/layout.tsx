import type { Metadata } from 'next';
import Website43MotionBoundary from '@/features/website-43-uat/Website43MotionBoundary';

export const metadata: Metadata = {
  title: 'Website 4.3 UAT · CCPun',
  robots: { index: false, follow: false, nocache: true },
};

export default function Website43PreviewLayout({ children }: { children: React.ReactNode }) {
  return <Website43MotionBoundary>{children}</Website43MotionBoundary>;
}
