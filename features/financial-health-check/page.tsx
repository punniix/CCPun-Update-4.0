import type { Metadata } from 'next';
import ClientFHC from '@/features/financial-health-check/components/ClientFHC';
import { getFhcFaqs } from '@/lib/content/tool-copy-defaults';
import { getPublicCopy } from '@/lib/content/public-copy';
import { publicCopyText, type PublicCopyValues } from '@/lib/content/public-copy-registry';
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







export async function renderFinancialHealthCheckPage(copyOverride?: PublicCopyValues, siteCopyOverride?: PublicCopyValues) {
  const t = publicCopyText(copyOverride ?? await getPublicCopy('fhc'));
const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": t("fhc.breadcrumb.home"), "item": "https://ccpun.com/" },
    { "@type": "ListItem", "position": 2, "name": t("fhc.breadcrumb.tool"), "item": "https://ccpun.com/tools/financial-health-check/" },
  ],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": t("fhc.schema.name"),
  "url": "https://ccpun.com/tools/financial-health-check/",
  "applicationCategory": "FinanceApplication",
  "operatingSystem": "Web",
  "author": {
    "@type": "Organization",
    "name": "CCPun Financial Advisor",
    "url": "https://ccpun.com"
  },
  "description": t("fhc.schema.description")
};
  const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: getFhcFaqs(t).map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: { '@type': 'Answer', text: faq.answer },
  })),
};
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <ClientFHC copy={copyOverride} siteCopy={siteCopyOverride} />
    </>
  );
}

export default function FinancialHealthCheckPage() {
  return renderFinancialHealthCheckPage();
}
