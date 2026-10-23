import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText } from "@/lib/content/public-copy-registry";
import Link from 'next/link';
import type { Metadata } from 'next';
import styles from '@/components/layout/website-43/Website43.module.css';
import { Website43Footer, Website43Navbar } from '@/components/layout/website-43/Website43Shared';

export const metadata: Metadata = {
  title: "ไม่พบหน้า | CCPun",
  description: "ไม่พบหน้าที่คุณกำลังหา กลับหน้าแรกหรือเลือกเครื่องมือวางแผนการเงินของ CCPun",
  alternates: { canonical: null },
  openGraph: {
    title: "ไม่พบหน้า | CCPun",
    description: "ไม่พบหน้าที่คุณกำลังหา กลับหน้าแรกหรือเลือกเครื่องมือวางแผนการเงินของ CCPun",
  },
  twitter: {
    title: "ไม่พบหน้า | CCPun",
    description: "ไม่พบหน้าที่คุณกำลังหา กลับหน้าแรกหรือเลือกเครื่องมือวางแผนการเงินของ CCPun",
  },
};

export default async function NotFound() {
  const text = publicCopyText(await getPublicCopy("site"));
  return (
    <div className={styles.root}>
      <Website43Navbar notFound />
      <main id="main-content" tabIndex={-1}>
        <section className={styles.notFound}>
          <div className={styles.inner}>
            <p className={styles.notFoundCode}>{text.node("site.extra.notFoundCode")}</p>
            <h1>{text.node("site.extra.h1")}</h1>
            <p className={styles.notFoundDescription}>{text.node("site.extra.notFoundDescription")}</p>
            <div className={styles.notFoundActions} style={{ flexDirection: 'row', flexWrap: 'wrap', width: 'min(292px, 100%)', gap: '12px', justifyContent: 'center', marginInline: 'auto' }}>
              <Link className={styles.primaryButton} style={{ flex: '1 1 124px', width: 'auto', minWidth: 0, minHeight: 48, height: 'auto' }} href="/">{text.node("site.extra.primaryButton")}</Link>
              <Link className={styles.blogRecovery} style={{ flex: '1 1 124px', width: 'auto', minWidth: 0, minHeight: 48, height: 'auto', justifyContent: 'center' }} href="/blog/">{text.node("site.extra.blogRecovery")}</Link>
            </div>
          </div>
        </section>
      </main>
      <Website43Footer notFound />
    </div>
  );
}
