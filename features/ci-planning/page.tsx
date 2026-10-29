
import { getPublicCopy } from '@/lib/content/public-copy';
import type { PublicCopyValues } from '@/lib/content/public-copy-registry';
import type { Metadata } from 'next';
import V5CiPlanning from '@/features/ci-planning/v5/V5CiPlanning';
import { IS_REVIEW_ENVIRONMENT } from '@/lib/deployment-environment';


export const metadata: Metadata = {
  title: 'วางแผนทุนโรคร้ายแรงจากรายได้และภาระ | CCPun',
  description: 'วางแผนทุนโรคร้ายแรงด้วยเครื่องมือประเมินเบื้องต้น เปรียบเทียบรายได้หรือค่าใช้จ่ายกับเงินก้อนและสินทรัพย์สภาพคล่อง เพื่อเห็นส่วนต่างก่อนทบทวนความคุ้มครอง',
  keywords: ['วางแผนทุนโรคร้ายแรง', 'คำนวณทุนโรคร้ายแรง', 'ทุนประกันโรคร้ายแรง'],
  openGraph: {
    title: 'วางแผนทุนโรคร้ายแรงจากรายได้และภาระ | CCPun',
    description: 'วางแผนทุนโรคร้ายแรงด้วยเครื่องมือประเมินเบื้องต้น เปรียบเทียบรายได้หรือค่าใช้จ่ายกับเงินก้อนและสินทรัพย์สภาพคล่อง เพื่อเห็นส่วนต่างก่อนทบทวนความคุ้มครอง',
    url: 'https://ccpun.com/ci-planning/',
    siteName: 'CCPun Financial Advisor',
    images: [
      {
        url: 'https://ccpun.com/og-image-20260610.webp?v=68ae8d8',
        width: 1200,
        height: 630,
        alt: 'CCPun วางแผนทุนประกันโรคร้ายแรง',
      },
    ],
    locale: 'th_TH',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'วางแผนทุนโรคร้ายแรงจากรายได้และภาระ | CCPun',
    description: 'วางแผนทุนโรคร้ายแรงด้วยเครื่องมือประเมินเบื้องต้น เปรียบเทียบรายได้หรือค่าใช้จ่ายกับเงินก้อนและสินทรัพย์สภาพคล่อง เพื่อเห็นส่วนต่างก่อนทบทวนความคุ้มครอง',
    images: ['https://ccpun.com/og-image-20260610.webp?v=68ae8d8'],
  },
  robots: IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },
  alternates: {
    canonical: 'https://ccpun.com/ci-planning/',
    languages: { 'th-TH': 'https://ccpun.com/ci-planning/', 'x-default': 'https://ccpun.com/ci-planning/' },
  },
};









// Website v5 (UAT prototype): the existing render owner now renders the v5 page (FigCraft 07).
// Metadata above, the route, the copy scope and the calculator are unchanged; the v5 renderer
// carries the same breadcrumb, WebApplication and FAQPage JSON-LD.
export async function renderCiPlanningPage(copyOverride?: PublicCopyValues, siteCopyOverride?: PublicCopyValues) {
  return <V5CiPlanning copy={copyOverride ?? await getPublicCopy('ci')} siteCopy={siteCopyOverride} />;
}

export default function CiPlanningPage() {
  return renderCiPlanningPage();
}
