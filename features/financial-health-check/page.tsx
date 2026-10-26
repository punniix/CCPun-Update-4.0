import type { Metadata } from 'next';
import V5Fhc from '@/features/financial-health-check/v5/V5Fhc';
import { getPublicCopy } from '@/lib/content/public-copy';
import type { PublicCopyValues } from '@/lib/content/public-copy-registry';
import { IS_REVIEW_ENVIRONMENT } from '@/lib/deployment-environment';


const FHC_DESCRIPTION = 'ตรวจสุขภาพการเงินผ่านโมดูลประเมินทุนประกันชีวิต ซึ่งครอบคลุมเฉพาะความคุ้มครองชีวิต เปรียบเทียบภาระครอบครัว หนี้ การศึกษาบุตร ความคุ้มครอง และสินทรัพย์ที่พร้อมใช้ เพื่อเริ่มทบทวนแผนการเงิน';

export const metadata: Metadata = {
  title: 'ตรวจสุขภาพการเงิน เริ่มจากช่องว่างความคุ้มครอง | CCPun',
  description: FHC_DESCRIPTION,
  keywords: [
    'ตรวจสุขภาพการเงิน',
    'financial health check',
    'วิเคราะห์ประกันชีวิต',
    'ความคุ้มครองที่ควรมี',
    'ที่ปรึกษาการเงิน',
    'CCPun',
    'ทุนประกันชีวิต',
    'คำนวณประกัน',
    'วางแผนการเงิน',
    'ความคุ้มครองที่ขาด',
  ],
  openGraph: {
    title: 'ตรวจสุขภาพการเงิน เริ่มจากช่องว่างความคุ้มครอง | CCPun',
    description: FHC_DESCRIPTION,
    url: 'https://ccpun.com/tools/financial-health-check/',
    siteName: 'CCPun Financial Advisor',
    images: [
      {
        url: 'https://ccpun.com/og-image-20260610.webp?v=68ae8d8',
        width: 1200,
        height: 630,
        alt: 'CCPun Financial Health Check',
      },
    ],
    locale: 'th_TH',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ตรวจสุขภาพการเงิน เริ่มจากช่องว่างความคุ้มครอง | CCPun',
    description: FHC_DESCRIPTION,
    images: ['https://ccpun.com/og-image-20260610.webp?v=68ae8d8'],
  },
  robots: IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },
  alternates: {
    canonical: 'https://ccpun.com/tools/financial-health-check/',
    languages: { "th-TH": "https://ccpun.com/tools/financial-health-check/", "x-default": "https://ccpun.com/tools/financial-health-check/" },
  },
};







// Website v5 (UAT prototype): the existing render owner now renders the v5 page (FigCraft 08),
// which carries the same breadcrumb, WebApplication and FAQPage JSON-LD. Metadata is unchanged.
export async function renderFinancialHealthCheckPage(copyOverride?: PublicCopyValues, siteCopyOverride?: PublicCopyValues) {
  return <V5Fhc copy={copyOverride ?? await getPublicCopy('fhc')} siteCopy={siteCopyOverride} />;
}

export default function FinancialHealthCheckPage() {
  return renderFinancialHealthCheckPage();
}
