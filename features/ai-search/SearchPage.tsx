import type { Metadata } from 'next';
import Link from 'next/link';
import { Website43Navbar } from '@/components/layout/website-43/Website43Navbar';
import { Website43Footer } from '@/components/layout/website-43/Website43Shared';
import styles from './SearchPage.module.css';

export const metadata: Metadata = {
  title: 'ค้นหาบทความด้วย AI | CCPun',
  description: 'ถามคำถามและค้นหาบทความประกัน การลงทุน และวางแผนการเงินจากเนื้อหาที่เผยแพร่แล้วของ CCPun',
  alternates: { canonical: 'https://ccpun.com/search/' },
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return (
    <div className={styles.root}>
      <Website43Navbar />
      <main id="main-content" className={styles.main}>
        <div className={styles.inner}>
          <p className={styles.eyebrow}>CCPun AI Search</p>
          <h1>มีคำถามเรื่องเงิน ประกัน หรือการลงทุน?</h1>
          <p className={styles.lead} role="status">
            ระบบค้นหาด้วย AI ยังไม่เปิดให้ใช้งานในขณะนี้ คุณสามารถอ่านบทความของ CCPun ได้ตามปกติ
          </p>
          <div className={styles.actions}>
            <Link href="/blog/">อ่านบทความทั้งหมด</Link>
            <a href="https://lin.ee/tqLCs4f" target="_blank" rel="noopener noreferrer">ปรึกษากับ CCPun</a>
          </div>
        </div>
      </main>
      <Website43Footer />
    </div>
  );
}
