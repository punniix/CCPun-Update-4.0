import { buildSiteRootMetadata } from "@/lib/seo/root-metadata";
import { CRITICAL_FOUNDATION_CSS } from "@/components/styles/critical-foundation";
import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";
import { buildCcpunSchemaGraph } from "@/lib/seo/structured-data/site-schema";
import { getPrimaryAuthorProfile } from "@/lib/content/sanity";
import { getPublicAuthorName } from "@/lib/content/author-identity";
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

export async function generateMetadata(): Promise<Metadata> {
  const author = await getPrimaryAuthorProfile();
  return {
    ...buildSiteRootMetadata({ admin: false, review: IS_WEB_REVIEW_ENVIRONMENT }),
    authors: [{ name: getPublicAuthorName(author), url: "https://ccpun.com" }],
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const author = await getPrimaryAuthorProfile();
  const schemaGraph = buildCcpunSchemaGraph(author);
  return (
    <html lang="th" className={`${kanit.variable} ${kanitCritical.variable}`} suppressHydrationWarning>
      <head>
        {IS_WEB_REVIEW_ENVIRONMENT ? <meta name="darkreader-lock" /> : null}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <Website43ResponsiveStyles />
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_FOUNDATION_CSS }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaGraph).replace(/</g, "\\u003c") }} />
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
