import { CRITICAL_FOUNDATION_CSS } from "@/components/styles/critical-foundation";
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
  description: "พื้นที่สำหรับดูแลลูกค้า เนื้อหา และงานของ CCPun",
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
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_FOUNDATION_CSS }} />
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
