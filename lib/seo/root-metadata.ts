import { getPageSeoPage } from "@/lib/content/page-seo-registry";
import type { Metadata } from "next";

const PAGE_SEO_DEFAULTS = getPageSeoPage("/")!.defaults;

// Fresh metadata objects: shared public values, explicit root compatibility noindex policy.
export function buildSiteRootMetadata({ admin, review }: { admin: boolean; review: boolean }): Metadata {
  return {
  metadataBase: new URL(admin ? "https://admin.ccpun.com" : "https://ccpun.com"),
  title: admin ? "CCPun Control Plane" : PAGE_SEO_DEFAULTS.seoTitle!,
  description: admin ? "พื้นที่ควบคุมภายในของ CCPun" : PAGE_SEO_DEFAULTS.seoDescription!,
  keywords: admin ? undefined : ["ที่ปรึกษาการเงิน", "กองทุนรวม", "ประกันชีวิต", "วางแผนภาษี", "RMF", "SSF", "ThaiESG", "AIA", "Finnomena", "PhillipCapital"],
  authors: admin ? undefined : [{ name: "ชนาธิป ชิตประเสริฐ", url: "https://ccpun.com" }],
  openGraph: admin ? null : {
    title: PAGE_SEO_DEFAULTS.ogTitle!,
    description: PAGE_SEO_DEFAULTS.ogDescription!,
    url: "https://ccpun.com",
    siteName: "CCPun Financial Advisor",
    images: [{ url: PAGE_SEO_DEFAULTS.ogImageUrl!, width: 1200, height: 630, alt: "CCPun ที่ปรึกษาการเงิน" }],
    locale: "th_TH",
    type: "website",
  },
  twitter: admin ? null : {
    card: "summary_large_image",
    title: PAGE_SEO_DEFAULTS.ogTitle!,
    description: PAGE_SEO_DEFAULTS.ogDescription!,
    images: [PAGE_SEO_DEFAULTS.ogImageUrl!],
  },
  alternates: admin ? { canonical: null } : {
    canonical: "https://ccpun.com/",
    languages: { "th-TH": "https://ccpun.com/", "x-default": "https://ccpun.com/" },
  },
  robots: admin || review ? { index: false, follow: false, nocache: true } : undefined,
  icons: {
    icon: { url: "/favicon.png", type: "image/png" },
    apple: "/favicon.png",
  },
};
}
