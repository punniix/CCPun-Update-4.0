import { CRITICAL_FOUNDATION_CSS } from "@/components/styles/critical-foundation";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { Kanit } from "next/font/google";
import "./globals.css";
import { ccpunSchemaGraph } from "@/lib/seo/structured-data/site-schema";
import ClientWidgets from "@/features/analytics/components/ClientWidgets";
import { Website43ResponsiveStyles } from "@/components/layout/website-43/Website43ResponsiveStyles";
import { IS_ADMIN_APPLICATION, IS_DRAFT_PREVIEW_ALLOWED, IS_REVIEW_ENVIRONMENT, PRODUCTION_ANALYTICS_ENABLED } from "@/lib/deployment-environment";

const GA_ID = PRODUCTION_ANALYTICS_ENABLED ? (process.env.NEXT_PUBLIC_GA_ID ?? "") : "";
const META_PIXEL_ID = PRODUCTION_ANALYTICS_ENABLED ? (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "") : "";
const GTM_ID = PRODUCTION_ANALYTICS_ENABLED ? "GTM-5DKMGSK3" : "";
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
  metadataBase: new URL(IS_ADMIN_APPLICATION ? "https://admin.ccpun.com" : "https://ccpun.com"),
  title: IS_ADMIN_APPLICATION ? "CCPun Control Plane" : "CCPun | ที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน",
  description: IS_ADMIN_APPLICATION ? "พื้นที่ควบคุมภายในของ CCPun" : "ไม่แน่ใจว่าควรลงทุนหรือทำประกันแบบไหน? CCPun ที่ปรึกษาทางการเงิน ช่วยดูเป้าหมาย ความเสี่ยง และสิ่งที่คุณมี ก่อนค่อยเลือกทางที่เหมาะกับชีวิตคุณ",
  keywords: IS_ADMIN_APPLICATION ? undefined : ["ที่ปรึกษาการเงิน", "กองทุนรวม", "ประกันชีวิต", "วางแผนภาษี", "RMF", "SSF", "ThaiESG", "AIA", "Finnomena", "PhillipCapital"],
  authors: IS_ADMIN_APPLICATION ? undefined : [{ name: "ชนาธิป ชิตประเสริฐ", url: "https://ccpun.com" }],
  openGraph: IS_ADMIN_APPLICATION ? null : {
    title: "ลงทุนหรือทำประกันอะไรดี? เริ่มจากปัญหาที่คุณมีก่อน | CCPun",
    description: "เพราะคำว่า “ดีที่สุด” ของคนอื่น อาจไม่ตอบโจทย์คุณ ลองเริ่มจากเป้าหมาย ความเสี่ยง และสิ่งที่คุณมี แล้วค่อยเลือกลงทุนหรือประกันให้เหมาะกับตัวเอง",
    url: "https://ccpun.com",
    siteName: "CCPun Financial Advisor",
    images: [{ url: "https://ccpun.com/og-image-20260610.webp?v=68ae8d8", width: 1200, height: 630, alt: "CCPun ที่ปรึกษาการเงิน" }],
    locale: "th_TH",
    type: "website",
  },
  twitter: IS_ADMIN_APPLICATION ? null : {
    card: "summary_large_image",
    title: "ลงทุนหรือทำประกันอะไรดี? เริ่มจากปัญหาที่คุณมีก่อน | CCPun",
    description: "เพราะคำว่า “ดีที่สุด” ของคนอื่น อาจไม่ตอบโจทย์คุณ ลองเริ่มจากเป้าหมาย ความเสี่ยง และสิ่งที่คุณมี แล้วค่อยเลือกลงทุนหรือประกันให้เหมาะกับตัวเอง",
    images: ["https://ccpun.com/og-image-20260610.webp?v=68ae8d8"],
  },
  alternates: IS_ADMIN_APPLICATION ? { canonical: null } : {
    canonical: "https://ccpun.com/",
    languages: { "th-TH": "https://ccpun.com/", "x-default": "https://ccpun.com/" },
  },
  robots: IS_ADMIN_APPLICATION || IS_REVIEW_ENVIRONMENT ? { index: false, follow: false, nocache: true } : undefined,
  icons: {
    icon: { url: "/favicon.png", type: "image/png" },
    apple: "/favicon.png",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Public web production does not expose Draft Preview. Avoid touching Draft
  // Mode there so the static public shell stays independent from preview-only
  // request state. Import the entire preview boundary only after the deployment
  // gate passes so its client references never enter the public root graph.
  const isDraftMode = IS_DRAFT_PREVIEW_ALLOWED ? (await draftMode()).isEnabled : false;
  let draftPreviewRuntime: React.ReactNode = null;

  if (IS_DRAFT_PREVIEW_ALLOWED) {
    const { default: DraftPreviewRuntime } = await import("@/components/preview/DraftPreviewRuntime");
    draftPreviewRuntime = (
      <DraftPreviewRuntime enabled={IS_DRAFT_PREVIEW_ALLOWED} isDraftMode={isDraftMode} />
    );
  }

  return (
    <html lang="th" className={`${kanit.variable} ${kanitCritical.variable}`} suppressHydrationWarning>
      <head>
        {IS_REVIEW_ENVIRONMENT ? <meta name="darkreader-lock" /> : null}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <Website43ResponsiveStyles />
        {/* Critical hero CSS — inlined to unblock above-the-fold render */}
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_FOUNDATION_CSS }} />
        {!IS_ADMIN_APPLICATION ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ccpunSchemaGraph) }} /> : null}
      </head>
      <body className="antialiased font-sans">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-2 focus:bg-background focus:text-foreground focus:rounded focus:border focus:border-primary/50">
          ข้ามไปเนื้อหาหลัก
        </a>
        {children}
        {!IS_ADMIN_APPLICATION ? <ClientWidgets gaId={GA_ID} gtmId={GTM_ID} metaPixelId={META_PIXEL_ID} /> : null}
        {draftPreviewRuntime}
      </body>
    </html>
  );
}
