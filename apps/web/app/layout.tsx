import { CRITICAL_FOUNDATION_CSS } from "@/components/styles/critical-foundation";
import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";
import { ccpunSchemaGraph } from "@/lib/seo/structured-data/site-schema";
import ClientWidgets from "@/features/analytics/components/ClientWidgets";
import { Website43ResponsiveStyles } from "@/components/layout/website-43/Website43ResponsiveStyles";
import { IS_WEB_REVIEW_ENVIRONMENT, PRODUCTION_WEB_ANALYTICS_ENABLED } from "../runtime-environment";

const GA_ID = PRODUCTION_WEB_ANALYTICS_ENABLED ? (process.env.NEXT_PUBLIC_GA_ID ?? "") : "";
const META_PIXEL_ID = PRODUCTION_WEB_ANALYTICS_ENABLED ? (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "") : "";
const GTM_ID = PRODUCTION_WEB_ANALYTICS_ENABLED ? "GTM-5DKMGSK3" : "";
const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "600", "700"],
  variable: "--font-kanit",
  display: "optional",
  preload: false,
});

const kanitCritical = Kanit({
  subsets: ["thai"],
  weight: ["400", "600", "700"],
  variable: "--font-kanit-critical",
  display: "optional",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ccpun.com"),
  title: "CCPun | ที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน",
  description: "ไม่แน่ใจว่าควรลงทุนหรือทำประกันแบบไหน? CCPun ที่ปรึกษาทางการเงิน ช่วยดูเป้าหมาย ความเสี่ยง และสิ่งที่คุณมี ก่อนค่อยเลือกทางที่เหมาะกับชีวิตคุณ",
  keywords: ["ที่ปรึกษาการเงิน", "กองทุนรวม", "ประกันชีวิต", "วางแผนภาษี", "RMF", "SSF", "ThaiESG", "AIA", "Finnomena", "PhillipCapital"],
  authors: [{ name: "ชนาธิป ชิตประเสริฐ", url: "https://ccpun.com" }],
  openGraph: {
    title: "ลงทุนหรือทำประกันอะไรดี? เริ่มจากปัญหาที่คุณมีก่อน | CCPun",
    description: "เพราะคำว่า “ดีที่สุด” ของคนอื่น อาจไม่ตอบโจทย์คุณ ลองเริ่มจากเป้าหมาย ความเสี่ยง และสิ่งที่คุณมี แล้วค่อยเลือกลงทุนหรือประกันให้เหมาะกับตัวเอง",
    url: "https://ccpun.com",
    siteName: "CCPun Financial Advisor",
    images: [{ url: "https://ccpun.com/og-image-20260610.webp?v=68ae8d8", width: 1200, height: 630, alt: "CCPun ที่ปรึกษาการเงิน" }],
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ลงทุนหรือทำประกันอะไรดี? เริ่มจากปัญหาที่คุณมีก่อน | CCPun",
    description: "เพราะคำว่า “ดีที่สุด” ของคนอื่น อาจไม่ตอบโจทย์คุณ ลองเริ่มจากเป้าหมาย ความเสี่ยง และสิ่งที่คุณมี แล้วค่อยเลือกลงทุนหรือประกันให้เหมาะกับตัวเอง",
    images: ["https://ccpun.com/og-image-20260610.webp?v=68ae8d8"],
  },
  alternates: {
    canonical: "https://ccpun.com/",
    languages: { "th-TH": "https://ccpun.com/", "x-default": "https://ccpun.com/" },
  },
  robots: IS_WEB_REVIEW_ENVIRONMENT ? { index: false, follow: false, nocache: true } : undefined,
  icons: {
    icon: { url: "/favicon.png", type: "image/png" },
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${kanit.variable} ${kanitCritical.variable}`} suppressHydrationWarning>
      <head>
        {IS_WEB_REVIEW_ENVIRONMENT ? <meta name="darkreader-lock" /> : null}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <Website43ResponsiveStyles />
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_FOUNDATION_CSS }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ccpunSchemaGraph) }} />
      </head>
      <body className="antialiased font-sans">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-2 focus:bg-background focus:text-foreground focus:rounded focus:border focus:border-primary/50">
          ข้ามไปเนื้อหาหลัก
        </a>
        {children}
        <ClientWidgets gaId={GA_ID} gtmId={GTM_ID} metaPixelId={META_PIXEL_ID} />
      </body>
    </html>
  );
}
