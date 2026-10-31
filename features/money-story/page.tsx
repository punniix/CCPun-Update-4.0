import { getPublicCopy } from "@/lib/content/public-copy";
import type { PublicCopyValues } from "@/lib/content/public-copy-registry";
import type { Metadata } from 'next';
import { IS_REVIEW_ENVIRONMENT } from '@/lib/deployment-environment';
import V5MoneyStory from './v5/V5MoneyStory';


const DESCRIPTION =
  'เกมจำลองชีวิตการเงิน 12 เดือน เลือกหรือสุ่มชีวิตสมมติ แล้วลองตัดสินใจเรื่องเงินสด การลงทุน ความคุ้มครอง และการกู้ เมื่อชีวิตมีเรื่องไม่คาดคิดเข้ามา';

export const metadata: Metadata = {
  title: 'Money Story | เกมจำลองชีวิตการเงิน 12 เดือน | CCPun',
  description: DESCRIPTION,
  alternates: { canonical: 'https://ccpun.com/play/money-story/' },
  openGraph: {
    title: 'Money Story | CCPun',
    description: DESCRIPTION,
    url: 'https://ccpun.com/play/money-story/',
    siteName: 'CCPun Financial Advisor',
    locale: 'th_TH',
    type: 'website',
  },
  robots: IS_REVIEW_ENVIRONMENT
    ? { index: false, follow: false, nocache: true }
    : { index: true, follow: true },
};

// Owner-approved v5 presentation; public URL, metadata and game rules retain their existing owners.
export async function renderMoneyStoryPage(copyOverride?: PublicCopyValues, siteCopyOverride?: PublicCopyValues) {
  return <V5MoneyStory copy={copyOverride ?? await getPublicCopy("moneyStory")} siteCopy={siteCopyOverride} />;
}

export default function MoneyStoryPage() { return renderMoneyStoryPage(); }
