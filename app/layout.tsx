import { buildSiteRootMetadata } from "@/lib/seo/root-metadata";
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

export const metadata: Metadata = buildSiteRootMetadata({ admin: IS_ADMIN_APPLICATION, review: IS_REVIEW_ENVIRONMENT });

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
