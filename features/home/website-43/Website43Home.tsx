import { homeFaqs as faqs } from './homeFaqs';
import Image from 'next/image';
import Link from 'next/link';
import styles from '@/components/layout/website-43/Website43.module.css';
import { SectionHeading, Website43Footer, Website43Navbar } from '@/components/layout/website-43/Website43Shared';
import { WEBSITE43_BASE as BASE } from '@/components/layout/website-43/constants';

const pains = [
  ['/assets/website-43/icon-protection-gap.svg', 'ไม่แน่ใจว่ามีประกันเพียงพอหรือยัง', 'มีความคุ้มครองอยู่ แต่ไม่แน่ใจว่าที่มีอยู่นั้น เพียงพอหรือไม่ ต้องเตรียมหรือปรับเพิ่มลดอย่างไร'],
  ['/assets/website-43/icon-tax.svg', 'มีเงินเก็บ แต่ไม่รู้จะเริ่มลงทุนอย่างไร', 'อยากให้เงินทำงาน แต่ยังไม่รู้ว่าควรเริ่มจากเป้าหมายหรือเครื่องมือไหน'],
  ['/assets/website-43/icon-investment-risk.svg', 'มีหลายเป้าหมาย แต่ไม่รู้ควรเริ่มตรงไหนก่อน', 'ทั้งประกัน การลงทุน ภาษี และอนาคตมาพร้อมกัน จึงต้องช่วยกันจัดลำดับ'],
] as const;

const steps = [
  ['01', 'เข้าใจสถานการณ์', 'ดูชีวิต เป้าหมาย ภาระ และสิ่งที่กำลังกังวล'],
  ['02', 'ดูสิ่งที่มีอยู่แล้ว', 'ดูประกัน เงินเก็บ การลงทุน หรือแผนที่มีอยู่'],
  ['03', 'หา Gap', 'ดูว่าส่วนไหนเพียงพอ ส่วนไหนยังขาด และอะไรอาจไม่จำเป็น'],
  ['04', 'เลือกทางที่เหมาะ', 'ค่อยเลือกว่าจะปรับ เพิ่ม ลด หรือยังไม่ต้องทำอะไร'],
] as const;



export default function Website43Home() {
  return (
    <div className={styles.root}>
      <main id="main-content" tabIndex={-1}>
        <section id="home" className={styles.homeHero} aria-labelledby="home-hero-title">
          <div className={styles.homeHeroPicture}><Image src="/assets/website-43/home-hero-desktop.png" alt="CCPun กำลังนั่งทำงานพร้อมคอมพิวเตอร์โน้ตบุ๊ก" fill loading="eager" fetchPriority="high" sizes="100vw" /></div>
          <div className={styles.homeHeroGradient} aria-hidden="true" /><div className={styles.homeHeroBottomGradient} aria-hidden="true" /><Website43Navbar overlay />
          <div className={styles.homeHeroCopy}>
            <p className={styles.eyebrow}>คุณเล่าปัญหามา เราสร้างแผนแก้ไขไป</p>
            <h1 id="home-hero-title" className={styles.homeHeroTitle}>เพราะปัญหาทางการเงินมัน<span className={styles.homeHeroWord}>ซับซ้อน</span> เราจึงต้องวางแผน ออกแบบให้เหมาะกับตัวคุณ</h1>
            <p className={styles.homeHeroBody}>เริ่มจากสิ่งที่คุณมี เป้าหมายที่อยากไปให้ถึง และความเสี่ยงที่รับได้ แล้วค่อยจัดลำดับว่าอะไรควรทำก่อน</p>
            <div className={styles.heroActions}><Link className={styles.primaryButton} href="#about-ccpun">รู้จัก CCPun</Link><a className={styles.outlineButton} href="https://lin.ee/tqLCs4f" target="_blank" rel="noopener noreferrer" data-analytics-location="home_hero">ปรึกษากับ CCPun</a></div>
            <p className={styles.heroProof}>5+ ปี · 3 ใบอนุญาต · 6 พาร์ทเนอร์/แพลตฟอร์ม</p>
          </div>
        </section>

        <section className={`${styles.sectionDeep} ${styles.sectionTopLarge} ${styles.sectionBottomLarge}`}><div className={styles.inner}>
          <SectionHeading eyebrow="โจทย์ที่พบบ่อย" title="ถ้าเรื่องเงินยังเป็นเรื่องที่คุณกังวล" description="เริ่มจากปัญหาที่เจอ ดูแผนการเงินในภาพรวม และหาผลิตภัณฑ์ที่เหมาะสม" />
          <div className={styles.threeCols}>{pains.map(([icon,title,body]) => <article className={styles.editorialCard} key={title}><Image className={styles.editorialCardIcon} src={icon} alt="" width={24} height={24} aria-hidden="true" /><h3 className={styles.cardTitle}>{title}</h3><p className={styles.cardBody}>{body}</p></article>)}</div>
        </div></section>

        <section className={`${styles.section} ${styles.trustSection}`}><div className={styles.inner}>
          <div className={styles.stats}><div className={styles.stat}><strong>5+ ปี</strong><span>ประสบการณ์ด้านการเงิน</span></div><div className={styles.stat}><strong>3 ใบอนุญาต</strong><span>การลงทุน · ประกันชีวิต · ประกันวินาศภัย</span></div><div className={styles.stat}><strong>6 แพลตฟอร์มการเงิน</strong><span>ทางเลือกที่หลากหลาย ตอบโจทย์ลูกค้า</span></div></div>
          <p className={styles.license}><span>ใบอนุญาต: ตัวแทนประกันชีวิต 6801064783</span><span className={styles.licenseSeparator} aria-hidden="true"> · </span><span>ผู้วางแผนการลงทุน 106654</span><span className={styles.licenseSeparator} aria-hidden="true"> · </span><span>นายหน้าประกันวินาศภัย 6904009841</span></p>
          <p className={styles.partnerLabel}>พาร์ทเนอร์ทั้งหมดที่ร่วมงาน</p>
          <div className={styles.partners} style={{gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))'}}><div className={styles.partner}><div className={`${styles.partnerLogoFrame} ${styles.partnerLogoFrameStandard}`}><Image className={`${styles.partnerLogo} ${styles.partnerLogoStandard}`} src="/assets/aia-logo.webp" alt="AIA" width={512} height={341} /></div><strong>AIA</strong><span>ตัวแทนประกันชีวิต</span></div><div className={styles.partner}><div className={`${styles.partnerLogoFrame} ${styles.partnerLogoFrameFairdee}`}><Image className={`${styles.partnerLogo} ${styles.partnerLogoFairdee}`} src="/assets/website-43/fairdee-logo.png" alt="Fairdee" width={512} height={512} /></div><strong>Fairdee</strong><span>นายหน้าประกันวินาศภัย</span></div><div className={styles.partner}><div className={`${styles.partnerLogoFrame} ${styles.partnerLogoFrameStandard}`}><Image className={`${styles.partnerLogo} ${styles.partnerLogoStandard}`} src="/assets/maybank-logo.webp" alt="Maybank" width={512} height={512} /></div><strong>Maybank</strong><span>ผู้วางแผนการลงทุนอิสระ</span></div><div className={styles.partner}><div className={`${styles.partnerLogoFrame} ${styles.partnerLogoFrameStandard}`}><Image className={`${styles.partnerLogo} ${styles.partnerLogoStandard}`} src="/assets/phillip-logo.svg" alt="PhillipCapital" width={1000} height={400} /></div><strong>PhillipCapital</strong><span>ผู้วางแผนการลงทุนอิสระ</span></div><div className={styles.partner}><div className={`${styles.partnerLogoFrame} ${styles.partnerLogoFrameWebull}`}><Image className={`${styles.partnerLogo} ${styles.partnerLogoWebull}`} src="/assets/website-43/webull-logo.png" alt="Webull" width={736} height={736} /></div><strong>Webull</strong><span>แพลตฟอร์มการลงทุน</span></div><div className={styles.partner}><div className={`${styles.partnerLogoFrame} ${styles.partnerLogoFrameStandard}`}><Image className={`${styles.partnerLogo} ${styles.partnerLogoStandard}`} src="/assets/finnomena-logo.webp" alt="Finnomena" width={200} height={200} /></div><strong>Finnomena</strong><span>ผู้วางแผนการลงทุนอิสระ</span></div></div>
        </div></section>

        <section id="about-ccpun" className={styles.about}><div className={styles.aboutInner}><div className={styles.aboutCopy}>
          <p className={styles.eyebrow}>รู้จักที่ปรึกษาทางการเงิน CCPun</p><h2 className={styles.h2}>จากคนที่โฟกัสแต่เรื่องการลงทุน สู่ที่ปรึกษาทางการเงินแบบครบลูป</h2>
          <div className={styles.aboutPortraitStage}><Image className={styles.aboutPortrait} src="/assets/website-43/about-pun.png" alt="CCPun" width={400} height={526} sizes="(max-width: 639px) 318px, (max-width: 1023px) 260px, 400px" /></div>
          <div className={styles.aboutParagraphs}><p>จากคนที่โฟกัสแต่เพียงเรื่องการลงทุน จนเจอเหตุไม่คาดฝัน และสูญเสียในครอบครัวในเวลาต่อมา ผมจึงเริ่มเห็นความสำคัญของประกันชีวิต และกลับมาจัดแผนการเงินใหม่จากระดับรากฐาน</p><p>และเลือกเดินต่อในบทบาทตัวแทนประกันชีวิต นายหน้าประกันวินาศภัย และผู้วางแผนการลงทุน เพื่อช่วยเหลือผู้คนให้มีฐานการเงินที่ดีขึ้น</p><p>โดยนำประสบการณ์ด้านการเงินและการลงทุนจากการทำงานกว่า 5 ปี มาแนะนำ และช่วยตัดสินใจเลือกผลิตภัณฑ์ทางการเงินที่ตอบโจทย์เฉพาะบุคคล เพื่อสร้างทั้งความมั่นคงและความมั่งคั่งได้ในระยะสั้น กลางและยาว</p></div>
          <div className={styles.advisorNote}>เป้าหมายไม่ใช่การเลือกเพียงแค่ผลิตภัณฑ์ใดผลิตภัณฑ์หนึ่ง แต่วางองค์รวม และเลือกสิ่งที่ดีที่สุด เหมาะสม ตอบโจทย์กับลูกค้าที่สุด</div>
        </div></div></section>

        <section className={styles.section}><div className={styles.inner}><SectionHeading eyebrow="เสียงจากการพูดคุยจริง" title="รีวิวจากลูกค้าที่ได้รับคำแนะนำจริง" /><div className={styles.voices}><div className={styles.voice}><blockquote>หลังจากได้รีวิวแผนประกันกับคุณปั้น รู้สึกว่าได้รับข้อมูลครบถ้วนมากขึ้น คุณปั้นอธิบายรายละเอียดของกรมธรรม์ที่เรามีอยู่ได้ชัดเจน ทำให้เข้าใจสิทธิ์ที่ตัวเองได้รับจริงๆ อยากให้ทุกคนมีโอกาสได้คุยกับเจ้าหน้าที่ที่มีความรู้แบบนี้ก่อนตัดสินใจซื้อประกัน เพราะถ้าเข้าใจกรมธรรม์ตั้งแต่แรก ก็จะไม่เกิดความเข้าใจผิดในภายหลัง ขอบคุณคุณปั้นที่ตั้งใจอธิบายมากๆ ถึงขนาดเอาไปเล่าให้แฟนฟังต่อได้เลย</blockquote><cite>คุณ Kittisak</cite></div><div className={styles.voiceDivider} aria-hidden="true" /><div className={styles.voice}><blockquote>คุณปั้นให้คำแนะนำในการปรับแผนประกันสุขภาพ และโรคร้ายแรง หลังจากรีวิวแผนได้ค่อนข้างโอเค</blockquote><cite>คุณ Maylisa</cite></div></div></div></section>

        <section className={`${styles.sectionDeep} ${styles.sectionTopLarge} ${styles.sectionBottomLarge}`}><div className={styles.inner}><SectionHeading eyebrow="HOW IT WORKS" title="ถ้าเริ่มวางแผนกับ CCPun จะเกิดอะไรขึ้น?" description="คุยกันครั้งแรกไม่ต้องเตรียมอะไรซับซ้อน เราเริ่มจากสถานการณ์จริงก่อนค่อยหาทางที่เหมาะ" /><div className={styles.journey}>{steps.map(([number,title,body],index)=><article className={styles.step} key={number}><div className={styles.stepRail}><span className={styles.stepNum}>{number}</span>{index<steps.length-1?<span className={styles.stepLine}/>:null}</div><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>

        <section className={styles.section} data-uat-section="home-learning"><div className={styles.inner}><SectionHeading title="ไม่รู้จะเริ่มอย่างไร เริ่มจากบทความและเครื่องมือก่อน" description="เลือกอ่านบทความ หรือทดลองใช้เครื่องมือวางแผนก่อน แล้วค่อยกลับมาคุยเมื่อคุณพร้อม" /><div className={styles.learnGrid}>
          <article className={styles.learnCard} style={{position:'relative',overflow:'hidden'}}><Image src="/assets/website-43/about-pun.png" alt="" fill sizes="(max-width:639px) 100vw,50vw" aria-hidden="true" style={{objectFit:'cover',objectPosition:'left 30%'}}/><div aria-hidden="true" style={{position:'absolute',inset:0,background:'linear-gradient(180deg,rgba(37,24,24,.2) 0%,rgba(37,24,24,.84) 72%,rgba(37,24,24,.96) 100%)'}}/><div style={{position:'relative',zIndex:1}}><Image className={styles.editorialCardIcon} src="/assets/website-43/icon-financial-health.svg" alt="" width={24} height={24} aria-hidden="true"/><span className={styles.planNum}>READ</span><h3>บทความการเงิน</h3><p>เข้าใจเรื่องการเงินได้ แม้จะเริ่มจาก 0</p><Link href={`${BASE}/blog`}>ดูบทความทั้งหมด →</Link></div></article>
          <div className={styles.toolCtaGrid}>
            <Link className={styles.toolCtaCard} href={`${BASE}/tools/financial-health-check`} aria-label="เริ่ม Financial Health Check: ตรวจสุขภาพการเงิน">
              <Image src="/assets/website-43/fhc-hero.png" alt="" fill sizes="(max-width: 639px) 100vw, 25vw" aria-hidden="true" className={styles.toolCtaImage}/>
              <span className={styles.toolCtaOverlay} aria-hidden="true" />
              <span className={styles.toolCtaContent}><span className={styles.planNum}>TRY</span><h3>Financial Health Check</h3><p>เช็กทุนประกันชีวิตที่ควรมีก่อนตัดสินใจทำประกันผ่านการตรวจสุขภาพทางการเงิน</p><span className={styles.toolCtaAction}>เริ่มประเมิน →</span></span>
            </Link>
            <Link className={styles.toolCtaCard} href={`${BASE}/ci-planning`} aria-label="เริ่ม CI Planning: วางแผนเงินก้อนโรคร้ายแรง">
              <Image src="/assets/website-43/ci-hero.png" alt="" fill sizes="(max-width: 639px) 100vw, 25vw" aria-hidden="true" className={styles.toolCtaImage}/>
              <span className={styles.toolCtaOverlay} aria-hidden="true" />
              <span className={styles.toolCtaContent}><span className={styles.planNum}>TRY</span><h3>วางแผนการเงินเมื่อเจอโรคร้ายแรง</h3><p>เตรียมเงินก้อนรับมือภาระค่าใช้จ่าย เมื่อเจอโรคร้ายแรง</p><span className={styles.toolCtaAction}>เริ่มประเมิน →</span></span>
            </Link>
          </div>
        </div></div></section>

        <section className={`${styles.section} ${styles.sectionBottomLarge}`} id="faq" data-uat-section="home-faq"><div className={styles.inner}><SectionHeading eyebrow="คำถามที่พบบ่อย" title="ก่อนเริ่มวางแผนกับ CCPun" /><div className={styles.faqList}>{faqs.map(({question,answer})=><details className={styles.faqItem} key={question}><summary className={styles.faqSummary}><span>{question}</span><span className={styles.faqIcon} aria-hidden="true">+</span></summary><p className={styles.faqAnswer}>{answer}</p></details>)}</div><a className={styles.faqCta} href="https://lin.ee/tqLCs4f" target="_blank" rel="noopener noreferrer" data-analytics-location="home_faq">ปรึกษากับ CCPun</a></div></section>

      </main>
      <Website43Footer warnings />
    </div>
  );
}
