import type { Metadata } from 'next';
import { IS_REVIEW_ENVIRONMENT } from '@/lib/deployment-environment';
import { CCPunAiSearchBar } from '@/features/ai-search/CCPunAiSearchWidgets';
import { Website43Navbar } from '@/components/layout/website-43/Website43Navbar';
import { Website43Footer } from '@/components/layout/website-43/Website43Shared';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'ค้นหาบทความด้วย AI | CCPun',
  description: 'ถามคำถามและค้นหาบทความประกัน การลงทุน และวางแผนการเงินจากเนื้อหาที่เผยแพร่แล้วของ CCPun',
  alternates: { canonical: 'https://ccpun.com/search/' },
  robots: { index: false, follow: true },
};

const suggestions = [
  'Copayment กับ Deductible ต่างกันอย่างไร?',
  'AIA Health Happy กับ Health CI Hero ต่างกันอย่างไร?',
  'ประกันบำนาญช่วยวางแผนเกษียณอย่างไร?',
  'วิธีคำนวณภาษีเงินได้บุคคลธรรมดา 2569',
];

export default function SearchPage() {
  return (
    <div className={styles.root}>
      <Website43Navbar />
      <main id="main-content" className={styles.main}>
        <div className={styles.inner}>
          <p className={styles.eyebrow}>CCPun AI Search</p>
          <h1>มีคำถามเรื่องเงิน ประกัน หรือการลงทุน?</h1>
          <p className={styles.lead}>
            ลองค้นหาด้วยภาษาของคุณเอง ระบบจะช่วยค้นข้อมูลจากบทความที่ CCPun เผยแพร่ไว้
            เพื่อให้เริ่มทำความเข้าใจและเปรียบเทียบตัวเลือกได้ง่ายขึ้น
          </p>
          <div className={styles.searchBox}>{IS_REVIEW_ENVIRONMENT ? <p>AI Search เปิดให้ใช้งานผ่านเว็บไซต์ Production เท่านั้น</p> : <CCPunAiSearchBar />}</div>
          <section className={styles.suggestions} aria-labelledby="sample-questions">
            <h2 id="sample-questions">ตัวอย่างคำถามที่ค้นหาได้</h2>
            <ul>{suggestions.map((question) => <li key={question}>{question}</li>)}</ul>
          </section>
          <p className={styles.disclaimer}>
            คำตอบจาก AI มีไว้ประกอบการทำความเข้าใจ ไม่ใช่คำแนะนำทางการเงินส่วนบุคคล
            โปรดตรวจสอบข้อมูลอัปเดต เงื่อนไขกรมธรรม์ และแหล่งอ้างอิงก่อนตัดสินใจ
          </p>
          <div className={styles.actions}>
            <a href="/blog/">อ่านบทความทั้งหมด</a>
            <a href="https://lin.ee/tqLCs4f" target="_blank" rel="noopener noreferrer">ปรึกษากับ CCPun</a>
          </div>
        </div>
      </main>
      <Website43Footer />
    </div>
  );
}
