import { getPublicCopy } from "@/lib/content/public-copy";
import type { PublicCopyValues } from "@/lib/content/public-copy-registry";
import { resolvePageSeoMetadata } from "@/lib/seo/page-seo";
import type { Metadata, ResolvingMetadata } from "next";
import V5CookiePolicy from "@/features/legal/v5/V5CookiePolicy";

const metadata: Metadata = {
  title: "นโยบายคุกกี้ | CCPun ที่ปรึกษาทางการเงิน",
  description: "CCPun ใช้ Google Analytics และ Meta Pixel ตามตัวเลือกความยินยอม อ่านรายละเอียดผู้ให้บริการ วัตถุประสงค์ ขอบเขต และวิธีถอนความยินยอม",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://ccpun.com/cookie-policy/" },
  openGraph: {
    title: "นโยบายคุกกี้ | CCPun ที่ปรึกษาทางการเงิน",
    description: "CCPun ใช้ Google Analytics และ Meta Pixel ตามตัวเลือกความยินยอม อ่านรายละเอียดผู้ให้บริการ วัตถุประสงค์ ขอบเขต และวิธีถอนความยินยอม",
    url: "https://ccpun.com/cookie-policy/",
  },
  twitter: {
    title: "นโยบายคุกกี้ | CCPun ที่ปรึกษาทางการเงิน",
    description: "CCPun ใช้ Google Analytics และ Meta Pixel ตามตัวเลือกความยินยอม อ่านรายละเอียดผู้ให้บริการ วัตถุประสงค์ ขอบเขต และวิธีถอนความยินยอม",
  },
};

// Website v5 (UAT prototype): the existing render owner now renders the v5 legal page
// (FigCraft 10/11) with the same copy scope; metadata below is unchanged.
export async function renderCookiePolicyPage(copyOverride?: PublicCopyValues, siteCopyOverride?: PublicCopyValues) {
  return <V5CookiePolicy copy={copyOverride ?? await getPublicCopy("cookies")} siteCopy={siteCopyOverride} />;
}

export function generateMetadata(props: unknown, parent: ResolvingMetadata) {
  void props;
  return resolvePageSeoMetadata("/cookie-policy/", metadata, parent);
}

export default function CookiePolicyPage() { return renderCookiePolicyPage(); }
