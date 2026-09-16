import type { Metadata } from "next";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { Website43Footer, Website43Navbar } from "@/components/layout/website-43/Website43Shared";
import w43Styles from "@/components/layout/website-43/Website43.module.css";
import legalStyles from "@/components/layout/website-43/Website43Legal.module.css";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว | CCPun ที่ปรึกษาทางการเงิน",
  description: "CCPun ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ อ่านนโยบายความเป็นส่วนตัวของเราเพื่อทำความเข้าใจว่าเราเก็บและใช้ข้อมูลอย่างไร",
  robots: IS_REVIEW_ENVIRONMENT ? { index: false, follow: false } : { index: true, follow: true },
  alternates: { canonical: "https://ccpun.com/privacy/" },
  openGraph: {
    title: "นโยบายความเป็นส่วนตัว | CCPun ที่ปรึกษาทางการเงิน",
    description: "CCPun ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ อ่านนโยบายความเป็นส่วนตัวของเราเพื่อทำความเข้าใจว่าเราเก็บและใช้ข้อมูลอย่างไร",
    url: "https://ccpun.com/privacy/",
  },
  twitter: {
    title: "นโยบายความเป็นส่วนตัว | CCPun ที่ปรึกษาทางการเงิน",
    description: "CCPun ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ อ่านนโยบายความเป็นส่วนตัวของเราเพื่อทำความเข้าใจว่าเราเก็บและใช้ข้อมูลอย่างไร",
  },
};

export default function PrivacyPage() {
  return (
    <div className={`${w43Styles.root} ${legalStyles.page}`}>
      <Website43Navbar />
      <main id="main-content" tabIndex={-1} className={legalStyles.main}>
      <div className={legalStyles.inner}>

        {/* Back link */}
        <div className={legalStyles.backRow}>
          <Link
            href="/"
            className={legalStyles.backLink}
          >
            <ArrowLeft />
            กลับหน้าหลัก
          </Link>
        </div>

        {/* Header */}
        <div className={legalStyles.header}>
          <div className={legalStyles.iconWrap}>
            <Shield className={legalStyles.headerIcon} />
          </div>
          <h1 className={legalStyles.title}>
            นโยบายความเป็นส่วนตัว
          </h1>
          <div className={legalStyles.headerRule} />
          <p className={legalStyles.updated}>
            อัปเดตล่าสุด: สิงหาคม 2569
          </p>
        </div>

        {/* Content */}
        <div className={legalStyles.content}>

          {/* Intro */}
          <p className="text-foreground leading-relaxed">
            CCPun ในฐานะที่ปรึกษาการเงินอิสระ ให้ความสำคัญอย่างยิ่งกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ
            นโยบายนี้อธิบายอย่างตรงไปตรงมาว่าเราเก็บข้อมูลอะไร ใช้ทำอะไร และคุณมีสิทธิ์อะไรบ้าง
          </p>

          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">
              1. ข้อมูลที่เราเก็บรวบรวม
            </h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-4">
              เว็บไซต์ไม่มีแบบฟอร์มติดต่อและไม่ส่งข้อมูลส่วนบุคคลเข้าสู่ระบบรับข้อมูลอัตโนมัติ
              ช่องทางหลักในการเริ่มสนทนาคือ LINE OA และมี Facebook กับอีเมลเป็นช่องทางรอง
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              เว็บไซต์ใช้ Google Tag Manager แบบ Advanced Consent Mode โดยตั้งค่าการวิเคราะห์และโฆษณาเป็นปฏิเสธไว้ก่อน
              Google อาจได้รับคำขอทางเทคนิคแบบไม่ใช้คุกกี้เพื่อประมวลผลสถานะความยินยอม ส่วน Google Analytics
              จะใช้คุกกี้และวิเคราะห์การใช้งาน เช่น จำนวนผู้เยี่ยมชมและหน้าที่ได้รับความสนใจ หลังจากคุณให้ความยินยอมเท่านั้น
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              หากคุณเปิดตัวเลือก Meta Pixel เว็บไซต์จะโหลด Pixel เฉพาะหน้า CI Planning และ Financial Health Check
              เพื่อวัดการเข้าชมและปฏิสัมพันธ์สำหรับประเมินผลโฆษณา ข้อมูลทางเทคนิคของอุปกรณ์ เบราว์เซอร์
              และตัวระบุออนไลน์อาจส่งไปยัง Meta Platforms, Inc. แต่ event ของ CCPun ไม่แนบค่าที่กรอกในเครื่องมือหรือข้อมูลติดต่อ
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">
              2. วัตถุประสงค์การใช้ข้อมูล
            </h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-4">
              หากคุณเลือกส่งข้อมูลผ่าน LINE OA, Facebook หรืออีเมล เราจะใช้ข้อมูลเท่าที่จำเป็นเพื่อ:
            </p>
            <ul className="space-y-2 text-foreground">
              {[
                "ติดต่อกลับเพื่อนัดหมายหรือให้ข้อมูลเบื้องต้น",
                "ให้บริการปรึกษาการเงินตามที่คุณร้องขอ",
                "ปรับปรุงคุณภาพการให้บริการของเรา",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">
              3. การเปิดเผยข้อมูลต่อบุคคลที่สาม
            </h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-foreground leading-relaxed font-medium mb-3">
              เราไม่ขายหรือให้เช่าข้อมูลส่วนบุคคลของคุณ
            </p>
            <p className="text-muted-foreground leading-relaxed">
              เมื่อคุณยินยอม เว็บไซต์อาจให้ Google Analytics และ Meta Pixel ประมวลผลข้อมูลการใช้งานตามวัตถุประสงค์ที่แจ้งไว้ข้างต้น
              การประมวลผลโดยผู้ให้บริการนี้ไม่ใช่การขายหรือให้เช่าข้อมูล เว็บไซต์ไม่ส่งหรือบันทึกข้อมูลติดต่อผ่านแบบฟอร์มของเว็บไซต์
              เมื่อคุณติดต่อผ่าน LINE OA, Facebook หรืออีเมล การรับส่งข้อมูลจะอยู่ภายใต้นโยบายของแพลตฟอร์มนั้น
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">
              4. ระยะเวลาการเก็บข้อมูล
            </h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed">
              เว็บไซต์ไม่เก็บข้อมูลจากแบบฟอร์มติดต่อ ส่วนบทสนทนาที่คุณเลือกส่งผ่านช่องทางภายนอก
              จะเก็บเท่าที่จำเป็นต่อการให้บริการและตามข้อกำหนดของแพลตฟอร์ม
              คุณสามารถขอให้แก้ไขหรือลบข้อมูลที่ CCPun ดูแลได้ตลอดเวลา
            </p>
          </section>

          {/* Section 4b — FHC Tool Data */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">
              4.1 ข้อมูลจากเครื่องมือตรวจสุขภาพการเงิน
            </h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed">
              ข้อมูลที่กรอกในเครื่องมือตรวจสุขภาพการเงินและเครื่องมือวางแผนทุนโรคร้ายแรง
              ใช้คำนวณในเบราว์เซอร์และไม่ถูกส่งไปยังเซิร์ฟเวอร์ของ CCPun
              ระบบจะส่งต่อข้อมูลก็ต่อเมื่อคุณเลือกดาวน์โหลดผลและส่งให้ CCPun ผ่านช่องทางติดต่อด้วยตัวเอง
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">
              5. สิทธิ์ของคุณ (PDPA)
            </h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-4">
              ภายใต้พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) คุณมีสิทธิ์:
            </p>
            <ul className="space-y-3 text-foreground">
              {[
                { title: "รับทราบ", desc: "ทราบว่าเราเก็บข้อมูลอะไรของคุณบ้าง" },
                { title: "เข้าถึง", desc: "ขอดูข้อมูลส่วนบุคคลที่เราเก็บไว้" },
                { title: "แก้ไข", desc: "ขอแก้ไขข้อมูลที่ไม่ถูกต้องหรือไม่ครบถ้วน" },
                { title: "ลบ", desc: "ขอให้ลบข้อมูลของคุณออกจากระบบของเรา" },
                { title: "ถอนความยินยอม", desc: "เพิกถอนความยินยอมที่เคยให้ไว้ได้ทุกเมื่อ โดยไม่กระทบสิทธิ์ที่เคยใช้ไปแล้ว" },
              ].map(({ title, desc }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>
                    <span className="font-medium text-primary">{title}:</span>{" "}
                    {desc}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              ในการใช้สิทธิ์ดังกล่าว กรุณาติดต่อเราผ่าน{" "}
              <a
                href="https://lin.ee/tqLCs4f"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                LINE OA @ccpun
              </a>{" "}
              เราจะดำเนินการภายใน 30 วัน
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">
              6. ติดต่อเรา
            </h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-4">
              หากมีคำถามหรือข้อกังวลเกี่ยวกับนโยบายนี้ สามารถติดต่อเราได้ที่:
            </p>
            <address className="not-italic space-y-2 text-foreground">
              <p>
                <span className="text-muted-foreground">LINE OA:</span>{" "}
                <a
                  href="https://lin.ee/tqLCs4f"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  @ccpun
                </a>
              </p>
              <p>
                <span className="text-muted-foreground">อีเมล:</span>{" "}
                <a
                  href="mailto:chanatip.chid@gmail.com"
                  className="text-primary hover:underline"
                >
                  chanatip.chid@gmail.com
                </a>
              </p>
            </address>
          </section>

          {/* Section 7 — Data Controller */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">
              7. ผู้ควบคุมข้อมูลส่วนบุคคล
            </h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-4">
              ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
              ผู้ควบคุมข้อมูลส่วนบุคคลของเว็บไซต์นี้คือ:
            </p>
            <address className="not-italic space-y-2 text-foreground">
              <p>
                <span className="text-muted-foreground">ชื่อ:</span>{" "}
                ชนาธิป ชิดประเสริฐ
              </p>
              <p>
                <span className="text-muted-foreground">อีเมล:</span>{" "}
                <a
                  href="mailto:chanatip.chid@gmail.com"
                  className="text-primary hover:underline"
                >
                  chanatip.chid@gmail.com
                </a>
              </p>
              <p>
                <span className="text-muted-foreground">เบอร์โทร:</span>{" "}
                <a href="tel:0633438513" className="text-primary hover:underline">
                  063-343-8513
                </a>
              </p>
            </address>
          </section>

          {/* Section 8 — Cookie */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">
              8. การใช้คุกกี้
            </h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed mb-3">
              เว็บไซต์โหลด Google Tag Manager โดยปฏิเสธการจัดเก็บข้อมูลไว้เป็นค่าเริ่มต้น และอาจส่งคำขอทางเทคนิคแบบไม่ใช้คุกกี้
              Google Analytics จะใช้คุกกี้หลังคุณยินยอม ส่วน Meta Pixel จะโหลดหลังคุณเปิดตัวเลือก Meta Pixel และเฉพาะหน้า CI Planning กับ Financial Health Check
              Meta อาจใช้ _fbp สูงสุด 90 วันและ _fbc เมื่อเกี่ยวข้อง คุณถอนความยินยอมได้ผ่านลิงก์ “ตั้งค่าคุกกี้”
              จากนั้นเว็บไซต์จะหยุดโหลด Pixel และลบคุกกี้ดังกล่าวบนโดเมน CCPun เท่าที่เบราว์เซอร์อนุญาต
              การถอนความยินยอมไม่ลบข้อมูลที่ผู้ให้บริการได้รับก่อนหน้านั้นโดยอัตโนมัติ
            </p>
            <p className="text-muted-foreground leading-relaxed">
              อ่านรายละเอียดเพิ่มเติมได้ที่{" "}
              <a
                href="/cookie-policy"
                className="text-primary hover:underline"
              >
                นโยบายคุกกี้
              </a>
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">
              9. การดูแลข้อมูลส่วนบุคคล
            </h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground leading-relaxed">
              CCPun ดำเนินงานตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
              เราเก็บข้อมูลบนหลักการ{" "}
              <span className="text-foreground font-medium">
                &ldquo;เก็บเท่าที่จำเป็น ใช้ตามวัตถุประสงค์ที่แจ้ง และปกป้องด้วยมาตรการที่เหมาะสม&rdquo;
              </span>
              {" "}เสมอ นโยบายนี้อาจมีการปรับปรุงเป็นครั้งคราว
              และจะแจ้งให้ทราบผ่านเว็บไซต์ ccpun.com เมื่อมีการเปลี่ยนแปลงสำคัญ
            </p>
          </section>

        </div>

        {/* Bottom back link */}
        <div className={legalStyles.bottomBack}>
          <Link
            href="/"
            className={legalStyles.backLink}
          >
            <ArrowLeft />
            กลับหน้าหลัก
          </Link>
        </div>

      </div>
      </main>
      <Website43Footer />
    </div>
  );
}