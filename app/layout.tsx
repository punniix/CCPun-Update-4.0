import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { Kanit } from "next/font/google";
import "./globals.css";
import { ccpunSchemaGraph } from "@/lib/seo/structured-data/site-schema";
import ClientWidgets from "@/features/analytics/components/ClientWidgets";
import { Website43FinalPolishStyles } from "@/components/layout/website-43/Website43FinalPolishStyles";
import { Website43TransitionStyles } from "@/components/layout/website-43/Website43TransitionStyles";
import { IS_ADMIN_APPLICATION, IS_DRAFT_PREVIEW_ALLOWED, IS_REVIEW_ENVIRONMENT, PRODUCTION_ANALYTICS_ENABLED } from "@/lib/deployment-environment";

const GA_ID = PRODUCTION_ANALYTICS_ENABLED ? (process.env.NEXT_PUBLIC_GA_ID ?? "") : "";
const META_PIXEL_ID = PRODUCTION_ANALYTICS_ENABLED ? (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "") : "";
const GTM_ID = PRODUCTION_ANALYTICS_ENABLED ? "GTM-5DKMGSK3" : "";
const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "600", "700"],
  variable: "--font-kanit",
  display: "optional",
  // Website 4.3 can paint with its system fallback immediately. Loading all
  // Thai + Latin weight files at highest priority competes with the Home LCP
  // image on cold mobile visits, so let the browser fetch the same self-hosted
  // Kanit files only when its CSS actually needs them.
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(IS_ADMIN_APPLICATION ? "https://admin.ccpun.com" : "https://ccpun.com"),
  title: IS_ADMIN_APPLICATION ? "CCPun Control Plane" : "CCPun | ที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน",
  description: IS_ADMIN_APPLICATION ? "พื้นที่ควบคุมภายในของ CCPun" : "ไม่แน่ใจว่าควรลงทุนหรือทำประกันแบบไหน? CCPun ที่ปรึกษาทางการเงิน ช่วยดูเป้าหมาย ความเสี่ยง และสิ่งที่คุณมี ก่อนค่อยเลือกทางที่เหมาะกับชีวิตคุณ",
  keywords: IS_ADMIN_APPLICATION ? undefined : ["ที่ปรึกษาการเงิน", "กองทุนรวม", "ประกันชีวิต", "วางแผนภาษี", "RMF", "SSF", "ThaiESG", "AIA", "Finnomena", "PhillipCapital"],
  authors: IS_ADMIN_APPLICATION ? undefined : [{ name: "ปั้น (CCPun)", url: "https://ccpun.com" }],
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
    <html lang="th" className={kanit.variable} suppressHydrationWarning>
      <head>
        {IS_REVIEW_ENVIRONMENT ? <meta name="darkreader-lock" /> : null}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <Website43TransitionStyles />
        <Website43FinalPolishStyles />
        {/* Critical hero CSS — inlined to unblock above-the-fold render */}
        <style dangerouslySetInnerHTML={{ __html: `
          :root{color-scheme:dark;--background:0 15% 18%;--foreground:0 10% 98%;--primary:45 60% 70%;--primary-foreground:0 15% 12%;--muted-foreground:0 10% 70%;--border:0 12% 32%;--radius:1rem;}
          body{background-color:hsl(0 15% 18%);color:hsl(0 10% 98%);font-family:'Kanit',system-ui,sans-serif;font-weight:300;-webkit-font-smoothing:antialiased;}
          .hero-dark-overlay{background:linear-gradient(180deg,rgba(15,20,30,.45) 0%,rgba(20,25,35,.40) 50%,rgba(15,20,30,.50) 100%);}
          .hero-gold-accent{background:radial-gradient(ellipse at 30% 20%,rgba(220,190,130,.08) 0%,transparent 50%),radial-gradient(ellipse at 70% 80%,rgba(220,190,130,.05) 0%,transparent 50%);}
          .hero-grid-pattern{background-image:radial-gradient(circle at 1px 1px,rgba(255,255,255,.3) 1px,transparent 0);background-size:40px 40px;}
          .glass-card{position:relative;overflow:hidden;border-radius:1rem;background:linear-gradient(135deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.06) 50%,rgba(255,255,255,.03) 100%);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);border:1px solid rgba(255,255,255,.15);box-shadow:0 8px 32px rgba(0,0,0,.25),inset 0 1px 1px rgba(255,255,255,.15);}
          .gold-button{position:relative;overflow:hidden;border-radius:9999px;padding:.75rem 1.25rem;font-weight:600;transition:all .3s;color:hsl(0 15% 12%);background:linear-gradient(135deg,hsl(45,60%,70%) 0%,hsl(45,70%,78%) 50%,hsl(45,60%,70%) 100%);background-size:200% 200%;box-shadow:0 2px 8px rgba(0,0,0,.2),0 0 20px rgba(220,190,130,.18),inset 0 1px 0 rgba(255,255,255,.45),inset 0 -1px 0 rgba(0,0,0,.08);}
          .text-gold-gradient{color:#e0c985;}
          @media(max-width:768px){.gold-button{padding:.75rem 1.25rem;}}
          @media(min-width:768px){.gold-button{padding:1rem 2rem;}}
          @keyframes hero-fade-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
          .hero-badge{animation:hero-fade-up .4s ease both;}
          .hero-heading{animation:hero-fade-up .4s ease both;}
          .hero-subtitle{animation:hero-fade-up .4s ease .1s both;}
          .hero-cta{animation:hero-fade-up .4s ease .2s both;}
          @keyframes scroll-breath{0%,100%{transform:translateX(-50%) translateY(0);opacity:1}50%{transform:translateX(-50%) translateY(6px);opacity:.62}}
          @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.hero-badge,.hero-heading,.hero-subtitle,.hero-cta,.scroll-indicator{animation:none!important}}
        ` }} />
        {!IS_ADMIN_APPLICATION ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ccpunSchemaGraph) }} /> : null}
      </head>
      <body className="antialiased font-sans">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-2 focus:bg-background focus:text-foreground focus:rounded focus:border focus:border-primary/50">
          ข้ามไปเนื้อหาหลัก
        </a>
        {children}
        <ClientWidgets gaId={GA_ID} gtmId={GTM_ID} metaPixelId={META_PIXEL_ID} />
        {draftPreviewRuntime}
      </body>
    </html>
  );
}
