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

export default function NotFound() {
  return (
    <div className={styles.root}>
      <Website43Navbar notFound />
      <main id="main-content" tabIndex={-1}>
        <section className={styles.notFound}>
          <div className={styles.inner}>
            <p className={styles.notFoundCode}>404</p>
            <h1>ไม่พบหน้าที่คุณกำลังหา</h1>
            <p className={styles.notFoundDescription}>ลิงก์อาจเปลี่ยนหรือถูกย้าย ลองกลับหน้าแรกหรือเลือกอ่านบทความเพื่อไปต่อ</p>
            <div className={styles.notFoundActions}>
              <Link className={styles.primaryButton} href="/">กลับหน้าแรก</Link>
              <Link className={styles.blogRecovery} href="/blog/">ดูบทความ</Link>
            </div>
          </div>
        </section>
      </main>
      <Website43Footer notFound />
    </div>
  );
}
