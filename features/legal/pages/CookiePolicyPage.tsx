import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Cookie } from "lucide-react";
import { Website43Footer, Website43Navbar } from "@/components/layout/website-43/Website43Shared";
import w43Styles from "@/components/layout/website-43/Website43.module.css";
import legalStyles from "@/components/layout/website-43/Website43Legal.module.css";

export const metadata: Metadata = {
  title: "นโยบายคุกกี้ | CCPun ที่ปรึกษาทางการเงิน",
  description: "CCPun ใช้ Google Analytics และ Meta Pixel ตามตัวเลือกความยินยอม อ่านรายละเอียดผู้ให้บริการ วัตถุประสงค์ ขอบเขต และวิธีถอนความยินยอม",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://ccpun.com/cookie-policy/" },
  openGraph: {
    title: "นโยบายคุกกี้ | CCPun ที่ปรึกษาทางการเงิน",
    description: "CCPun ใช้ Google Analytics และ Meta Pixel ตามตัวเลือกความยินยอม อ่านรายละเอียดผู้ให้บริการ วัตถุประสงค์ ขอบเขต และวิธีถอนความยินยอม",
    url: "https://ccpun.com/cookie-policy/",
  },
  twitter: {
    title: "นโยบายคุกกี้ | CCPun ที่ปรึกษาทางการเงิน",
    description: "CCPun ใช้ Google Analytics และ Meta Pixel ตามตัวเลือกความยินยอม อ่านรายละเอียดผู้ให้บริการ วัตถุประสงค์ ขอบเขต และวิธีถอนความยินยอม",
  },
};

export default function CookiePolicyPage() {
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
            <Cookie className={legalStyles.headerIcon} />
          </div>
          <h1 className={legalStyles.title}>
            นโยบายคุกกี้
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
            เว็บไซต์ ccpun.com ใช้คุกกี้เพื่อพัฒนาประสบการณ์การใช้งาน
            นโยบายนี้อธิบายว่าเราใช้คุกกี้ประเภทใด เพื่อวัตถุประสงค์อะไร
            และคุณสามารถจัดการหรือปฏิเสธคุกกี้ได้อย่างไร
          </p>

          {/* Section 1 — ประเภทคุกกี้ที่ใช้ (ตาราง 4 หมวด) */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">
              1. ประเภทคุกกี้ที่เราใช้
            </h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />

            {/* หมวด 1 — คุกกี้ที่จำเป็น */}
            <div
              className={`${legalStyles.policyCard} rounded-xl p-5 mb-4`}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex items-start gap-3 mb-3">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{
                    background: "rgba(220,190,130,0.15)",
                    color: "hsl(45,70%,65%)",
                    border: "1px solid rgba(220,190,130,0.25)",
                  }}
                >
                  จำเป็น
                </span>
                <div>
                  <p className="text-foreground font-medium text-sm mb-1">
                    การจัดเก็บที่จำเป็น (Essential Storage)
                  </p>
                  <p className="text-muted-foreground text-[13px] md:text-sm leading-relaxed">
                    เว็บไซต์เก็บสถานะความยินยอมไว้ใน localStorage ของเบราว์เซอร์เพื่อจำตัวเลือกของคุณ — ไม่ใช่คุกกี้ติดตาม
                  </p>
                </div>
              </div>
              <table className="w-full text-[13px] md:text-sm text-muted-foreground">
                <tbody className="divide-y divide-border/20">
                  {[
                    { label: "ชื่อรายการ", value: "ccpun_cookie_consent (localStorage)" },
                    { label: "วัตถุประสงค์", value: "จำการตั้งค่าความยินยอมคุกกี้ของคุณ" },
                    { label: "ระยะเวลา", value: "1 ปี" },
                    { label: "การล้างข้อมูล", value: "หากล้างข้อมูลเว็บไซต์ ระบบจะถามตัวเลือกอีกครั้ง" },
                  ].map(({ label, value }) => (
                    <tr key={label}>
                      <td className="py-2 pr-4 text-foreground font-medium w-36 align-top">{label}</td>
                      <td className="py-2 leading-relaxed">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* หมวด 2 — คุกกี้เพิ่มประสิทธิภาพ */}
            <div
              className={`${legalStyles.policyCard} rounded-xl p-5 mb-4`}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    color: "hsl(0,10%,75%)",
                    border: "1px solid rgba(255,255,255,0.14)",
                  }}
                >
                  Performance
                </span>
                <div>
                  <p className="text-foreground font-medium text-sm mb-1">
                    คุกกี้เพื่อเพิ่มประสิทธิภาพ — ยังไม่ใช้งาน
                  </p>
                  <p className="text-muted-foreground text-[13px] md:text-sm leading-relaxed">
                    ปัจจุบันเว็บไซต์ไม่ใช้คุกกี้หรือบริการบุคคลที่สามในหมวดนี้ การเปิดหรือปิดตัวเลือกจะบันทึกเฉพาะสถานะความยินยอมไว้ใน ccpun_cookie_consent บน localStorage ของเบราว์เซอร์
                  </p>
                </div>
              </div>
            </div>

            {/* หมวด 3 — คุกกี้วิเคราะห์ */}
            <div
              className={`${legalStyles.policyCard} rounded-xl p-5 mb-4`}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex items-start gap-3 mb-3">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{
                    background: "rgba(100,160,255,0.12)",
                    color: "hsl(210,80%,70%)",
                    border: "1px solid rgba(100,160,255,0.2)",
                  }}
                >
                  Analytics
                </span>
                <div>
                  <p className="text-foreground font-medium text-sm mb-1">
                    คุกกี้วิเคราะห์ — Google Analytics 4 (GA4) และ Google Tag Manager (GTM)
                  </p>
                  <p className="text-muted-foreground text-[13px] md:text-sm leading-relaxed">
                    ให้บริการโดย Google LLC — เว็บไซต์โหลด GTM ด้วย Advanced Consent Mode
                    โดยตั้งค่าการวิเคราะห์และโฆษณาเป็นปฏิเสธไว้ก่อน ระบบจะไม่สร้างคุกกี้วิเคราะห์ก่อนคุณอนุญาต
                    แต่อาจส่งคำขอทางเทคนิคแบบไม่ใช้คุกกี้ไปยัง Google เพื่อรับและประมวลผลสถานะความยินยอม
                  </p>
                </div>
              </div>
              <table className="w-full text-[13px] md:text-sm text-muted-foreground">
                <tbody className="divide-y divide-border/20">
                  {[
                    { label: "ชื่อคุกกี้", value: "_ga, _ga_*, _gid" },
                    { label: "วัตถุประสงค์", value: "วิเคราะห์จำนวนผู้เข้าชม พฤติกรรมการใช้งาน และหน้าที่ได้รับความสนใจ เพื่อปรับปรุงเว็บไซต์" },
                    { label: "ระยะเวลา", value: "สูงสุด 2 ปี (_ga) / 24 ชั่วโมง (_gid)" },
                    { label: "ผู้ให้บริการ", value: "Google LLC (สหรัฐอเมริกา)" },
                    { label: "ปิดได้", value: "ได้ — ค่าเริ่มต้นคือ ปิด" },
                  ].map(({ label, value }) => (
                    <tr key={label}>
                      <td className="py-2 pr-4 text-foreground font-medium w-36 align-top">{label}</td>
                      <td className="py-2 leading-relaxed">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* หมวด 4 — คุกกี้การตลาด */}
            <div
              className={`${legalStyles.policyCard} rounded-xl p-5 mb-4`}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex items-start gap-3 mb-3">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{
                    background: "rgba(180,100,255,0.1)",
                    color: "hsl(270,70%,70%)",
                    border: "1px solid rgba(180,100,255,0.18)",
                  }}
                >
                  Marketing
                </span>
                <div>
                  <p className="text-foreground font-medium text-sm mb-1">
                    Meta Pixel เพื่อการวัดผลและการตลาด
                  </p>
                  <p className="text-muted-foreground text-[13px] md:text-sm leading-relaxed">
                    ให้บริการโดย Meta Platforms, Inc. และบริษัทในเครือ เว็บไซต์โหลด Pixel เฉพาะหน้า CI Planning และ Financial Health Check หลังคุณเปิดตัวเลือก Meta Pixel เท่านั้น
                  </p>
                </div>
              </div>
              <table className="w-full text-[13px] md:text-sm text-muted-foreground">
                <tbody className="divide-y divide-border/20">
                  {[
                    { label: "ชื่อคุกกี้", value: "_fbp (สูงสุด 90 วัน), _fbc (เมื่อเกี่ยวข้อง)" },
                    { label: "วัตถุประสงค์", value: "วัดการเข้าชมและปฏิสัมพันธ์บนหน้าที่ใช้โฆษณา เพื่อประเมินประสิทธิภาพการตลาด" },
                    { label: "ขอบเขต", value: "/ci-planning/ และ /tools/financial-health-check/ เท่านั้น" },
                    { label: "ข้อมูล", value: "ข้อมูลการเข้าชม ปฏิสัมพันธ์ และข้อมูลทางเทคนิคของอุปกรณ์ เบราว์เซอร์ หรือตัวระบุออนไลน์อาจส่งไป Meta แต่ event ของ CCPun ไม่แนบค่าที่กรอกในเครื่องมือหรือข้อมูลติดต่อ" },
                    { label: "ผู้ให้บริการ", value: "Meta Platforms, Inc. และบริษัทในเครือ" },
                    { label: "ปิดได้", value: "ได้ — ค่าเริ่มต้นคือ ปิด" },
                  ].map(({ label, value }) => (
                    <tr key={label}>
                      <td className="py-2 pr-4 text-foreground font-medium w-36 align-top">{label}</td>
                      <td className="py-2 leading-relaxed">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 2 — วัตถุประสงค์ */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">
              2. วัตถุประสงค์การใช้คุกกี้
            </h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <ul className="space-y-2 text-foreground">
              {[
                "วิเคราะห์จำนวนผู้เข้าชมเว็บไซต์และแนวโน้มการเติบโต",
                "ทำความเข้าใจว่าผู้ใช้ค้นพบเว็บไซต์จากช่องทางใด",
                "ระบุหน้าที่ผู้ใช้ให้ความสนใจ เพื่อพัฒนาเนื้อหาให้ตรงความต้องการ",
                "ปรับปรุงโครงสร้างเว็บไซต์ให้ใช้งานสะดวกยิ่งขึ้น",
                "วัดการเข้าชมและปฏิสัมพันธ์บนหน้า CI Planning และ Financial Health Check เพื่อประเมินผลโฆษณาหลังได้รับความยินยอม",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-sm leading-relaxed mt-4">
              Google Analytics จัดทำรายงานเชิงสถิติรวม แต่ข้อมูลออนไลน์และข้อมูลทางเทคนิคบางส่วนอาจยังถือเป็นข้อมูลส่วนบุคคลตามกฎหมายหรือเงื่อนไขของผู้ให้บริการ
            </p>
          </section>

          {/* Section 3 — วิธีจัดการ */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">
              3. วิธีจัดการหรือเปลี่ยนการตั้งค่าคุกกี้
            </h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              คุณควบคุมการใช้คุกกี้ได้ 3 วิธี:
            </p>
            <ul className="space-y-4 text-foreground">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm mb-1">ผ่านแถบตั้งค่าคุกกี้เมื่อเข้าเว็บไซต์ครั้งแรก</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    แถบแจ้งเตือนจะปรากฏที่ด้านล่างหน้าจอ คุณกด &ldquo;ยอมรับ&rdquo; หรือ &ldquo;ตั้งค่าคุกกี้&rdquo;
                    แล้วเลือกแต่ละประเภทก่อนกด &ldquo;บันทึกการตั้งค่า&rdquo;
                    การตั้งค่าจะถูกจำไว้เป็นเวลา 1 ปี
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm mb-1">ผ่านลิงก์ &ldquo;ตั้งค่าคุกกี้&rdquo; ที่ด้านล่างของเว็บไซต์</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    คุณสามารถเปลี่ยนการตั้งค่าคุกกี้ได้ตลอดเวลา โดยกดที่ลิงก์ &ldquo;ตั้งค่าคุกกี้&rdquo;
                    ที่ด้านล่างของทุกหน้าในเว็บไซต์ เมื่อปิด Meta Pixel เว็บไซต์จะถอนสิทธิ์ หยุดโหลดสคริปต์ และลบ _fbp/_fbc ที่ตั้งบนโดเมน CCPun เท่าที่เบราว์เซอร์อนุญาต
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm mb-1">ผ่านการตั้งค่าเบราว์เซอร์</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    คุณลบหรือบล็อกคุกกี้ได้จากการตั้งค่าเบราว์เซอร์ของคุณโดยตรง
                    เช่น Chrome: Settings &gt; Privacy and security &gt; Cookies
                    การบล็อกคุกกี้ทั้งหมดอาจส่งผลให้บางส่วนของเว็บไซต์ทำงานได้ไม่เต็มที่
                  </p>
                </div>
              </li>
            </ul>
          </section>

          {/* Section 4 — Provider privacy */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">
              4. นโยบายของผู้ให้บริการภายนอก
            </h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground text-sm leading-relaxed">
              ข้อมูลที่ Google Analytics รวบรวมจะถูกส่งและเก็บไว้บน server ของ Google
              ภายใต้{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline underline-offset-2"
              >
                นโยบายความเป็นส่วนตัวของ Google
              </a>
              {" "}ส่วนข้อมูลจาก Meta Pixel อยู่ภายใต้{" "}
              <a
                href="https://www.facebook.com/privacy/policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline underline-offset-2"
              >
                นโยบายความเป็นส่วนตัวของ Meta
              </a>
              {" "}การถอนความยินยอมจะหยุดการส่งข้อมูลใหม่จาก CCPun แต่ไม่ลบข้อมูลที่ผู้ให้บริการได้รับก่อนหน้านั้นโดยอัตโนมัติ
            </p>
          </section>

          {/* Section 5 — Link to Privacy */}
          <section>
            <h2 className="text-xl font-semibold text-gold-gradient mb-3">
              5. นโยบายความเป็นส่วนตัวของ CCPun
            </h2>
            <div className="section-divider mb-5" style={{ marginLeft: 0, width: "3rem" }} />
            <p className="text-muted-foreground text-sm leading-relaxed">
              นโยบายคุกกี้นี้เป็นส่วนหนึ่งของ{" "}
              <Link
                href="/privacy"
                className="text-primary hover:underline underline-offset-2"
              >
                นโยบายความเป็นส่วนตัว
              </Link>{" "}
              ของ CCPun ซึ่งอธิบายรายละเอียดเพิ่มเติมเกี่ยวกับการเก็บและใช้ข้อมูลส่วนบุคคล
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