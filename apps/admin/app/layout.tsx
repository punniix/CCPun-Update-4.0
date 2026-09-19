import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { Kanit } from "next/font/google";
import "./globals.css";
import { Website43ResponsiveStyles } from "@/components/layout/website-43/Website43ResponsiveStyles";
import { getAdminEnvironment, isAdminReadDataPlaneAllowed } from "@/lib/admin/environment";

const ADMIN_ENVIRONMENT = getAdminEnvironment();
const DRAFT_PREVIEW_ALLOWED = isAdminReadDataPlaneAllowed(
  process.env.NEXT_PUBLIC_SANITY_DATASET,
  ADMIN_ENVIRONMENT,
);
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
  metadataBase: new URL("https://admin.ccpun.com"),
  title: "ศูนย์จัดการ CCPun",
  description: "พื้นที่ควบคุมภายในของ CCPun",
  alternates: { canonical: null },
  robots: { index: false, follow: false, nocache: true },
  icons: {
    icon: { url: "/favicon.png", type: "image/png" },
    apple: "/favicon.png",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const isDraftMode = DRAFT_PREVIEW_ALLOWED ? (await draftMode()).isEnabled : false;
  let draftPreviewRuntime: React.ReactNode = null;

  if (DRAFT_PREVIEW_ALLOWED) {
    const { default: DraftPreviewRuntime } = await import("@/components/preview/DraftPreviewRuntime");
    draftPreviewRuntime = (
      <DraftPreviewRuntime enabled={DRAFT_PREVIEW_ALLOWED} isDraftMode={isDraftMode} />
    );
  }

  return (
    <html lang="th" className={`${kanit.variable} ${kanitCritical.variable}`} suppressHydrationWarning>
      <head>
        <meta name="darkreader-lock" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <Website43ResponsiveStyles />
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
      </head>
      <body className="antialiased font-sans">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-2 focus:bg-background focus:text-foreground focus:rounded focus:border focus:border-primary/50">
          ข้ามไปเนื้อหาหลัก
        </a>
        {children}
        {draftPreviewRuntime}
      </body>
    </html>
  );
}
