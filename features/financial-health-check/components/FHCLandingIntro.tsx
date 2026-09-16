import Link from 'next/link';
import styles from '@/components/layout/website-43/Website43.module.css';

const truths = [
  [
    '01',
    'ความคุ้มครองต้องเทียบกับภาระจริง',
    'ช่องว่างความคุ้มครองและความต้องการทุนประกันชีวิตควรดูจากค่าใช้จ่าย หนี้ และเป้าหมายของคนที่ยังต้องพึ่งรายได้',
  ],
  [
    '02',
    'สภาพคล่องต้องรับมือเหตุไม่คาดคิด',
    'เงินสำรองฉุกเฉิน ภาระหนี้ และความเสี่ยงโรคร้ายแรงควรถูกทบทวนร่วมกัน เพราะทุกเรื่องกระทบเงินที่พร้อมใช้',
  ],
  [
    '03',
    'ลงทุนเมื่อฐานการเงินพร้อม',
    'ความพร้อมลงทุนและแผนเกษียณควรต่อยอดจากฐานที่รับความเสี่ยงระยะสั้นและความคุ้มครองจำเป็นได้แล้ว',
  ],
] as const;

export const FHC_FAQS = [
  {
    question: 'Financial Health Check หน้านี้ประเมินอะไร?',
    answer: 'หน้านี้เริ่มจากโมดูลประเมินความต้องการทุนประกันชีวิต โดยเทียบภาระครอบครัว หนี้ และทุนการศึกษาบุตร กับทุนประกันชีวิตและสินทรัพย์ที่คุณตั้งใจใช้ ยังไม่ได้ให้คะแนนสุขภาพการเงินทุกด้าน',
  },
  {
    question: 'ผลลัพธ์หมายความว่าสุขภาพการเงินดีหรือไม่?',
    answer: 'ยังสรุปไม่ได้ ผลลัพธ์แสดงเฉพาะช่องว่างความคุ้มครองชีวิตตามข้อมูลและสมมติฐานที่กรอก ควรทบทวนเงินสำรองฉุกเฉิน หนี้ ความเสี่ยงโรคร้ายแรง ความพร้อมลงทุน และเกษียณร่วมด้วย',
  },
  {
    question: 'ผลลัพธ์ใช้เป็นคำแนะนำเฉพาะบุคคลได้หรือไม่?',
    answer: 'ไม่ได้ ผลลัพธ์เป็นประมาณการเบื้องต้น ไม่ใช่คำแนะนำให้ซื้อผลิตภัณฑ์หรือวงเงินเฉพาะ ควรตรวจรายละเอียดความคุ้มครอง เงื่อนไข และข้อยกเว้นของกรมธรรม์ก่อนตัดสินใจ',
  },
] as const;

export default function FHCLandingIntro() {
  return (
    <section aria-labelledby="fhc-intro-title" className={`${styles.toolStorySection} ${styles.fhcIntroCompact}`}>
      <div className={styles.inner}>
        <h2 id="fhc-intro-title" className={styles.h2}>
          การตรวจสุขภาพการเงินต้องดูหลายเรื่องให้เชื่อมกัน
        </h2>
        <div className={styles.storyCopy}>
          <p>
            สุขภาพการเงินไม่ได้วัดจากเงินออมหรือผลตอบแทนเพียงอย่างเดียว แต่ต้องดูว่ารายรับ รายจ่าย หนี้ เงินสำรอง ความคุ้มครอง และเป้าหมายระยะยาวรองรับกันหรือไม่
          </p>
          <p>
            หน้า Financial Health Check นี้เริ่มจากโมดูลความคุ้มครองชีวิต เพื่อช่วยให้เห็นภาระที่ครอบครัวยังต้องดูแลและส่วนต่างของเงินก้อน ก่อนนำไปทบทวนด้านอื่นของแผนการเงิน
          </p>
        </div>
      </div>
    </section>
  );
}

export function FHCPlanningContext() {
  return (
    <section aria-labelledby="fhc-context-title" className={`${styles.toolStorySection} ${styles.fhcContextSection}`}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>ดูต่อหลังได้ผลประเมิน</p>
        <h2 id="fhc-context-title" className={styles.h2}>3 เรื่องที่ควรทบทวนให้เชื่อมกัน</h2>
        <div className={styles.truthGrid}>
          {truths.map(([number, title, description]) => (
            <article className={styles.truth} key={number}>
              <span className={styles.truthNum}>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>

        <div className={styles.methodBox}>
          <div>
            <p className={styles.eyebrow}>โมดูลที่เปิดให้ใช้ตอนนี้</p>
            <h3>ประเมินความต้องการทุนประกันชีวิต</h3>
          </div>
          <div>
            <p>
              เริ่มจากค่าใช้จ่ายในครอบครัวและระยะเวลาที่ต้องการให้เงินก้อนรองรับ แล้วเพิ่มหนี้และทุนการศึกษาบุตร ก่อนเทียบกับทุนประกันชีวิตและสินทรัพย์ที่ตั้งใจใช้
            </p>
            <p>
              ระบบจะแสดงช่องว่างความคุ้มครองจากข้อมูลที่กรอก เพื่อใช้ตั้งคำถามกับแผนเบื้องต้น ไม่ใช่คะแนนสุขภาพการเงินทั้งแผน และไม่ใช่คำแนะนำให้ซื้อผลิตภัณฑ์หรือวงเงินเฉพาะ
            </p>
            <p>
              ดูฐานของแผนการเงินต่อได้ที่{' '}
              <Link href="/blog/personal-finance/financial-pyramid/" className={styles.toolInlineLink}>พีระมิดทางการเงิน</Link>
              {' '}และหากต้องการทบทวนเงินก้อนเมื่อเผชิญโรคร้ายแรง ใช้{' '}
              <Link href="/ci-planning/" className={styles.toolInlineLink}>เครื่องมือวางแผนทุนโรคร้ายแรง</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
