import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MotionLab from '@/features/motion-lab/MotionLab';

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };
export const dynamic = 'force-dynamic';

export default function MotionLabPage() {
  if (process.env.VERCEL_ENV !== 'preview' && process.env.NODE_ENV !== 'development') notFound();
  return <MotionLab />;
}
