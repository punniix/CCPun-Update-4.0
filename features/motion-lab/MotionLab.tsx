'use client';

import ScrollReveal from '@/components/ui/ScrollReveal';
import MoneyComparison from '@/components/ui/MoneyComparison';

const tokenRows = [
  ['Instant', '120ms', 'state visibility'],
  ['Micro', '180ms', 'button, focus, menu'],
  ['Reveal', '320ms', 'below-the-fold group'],
  ['Explain', '650ms', 'financial comparison fill'],
] as const;

export default function MotionLab() {
  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-5xl space-y-16 px-4 py-24 md:px-8">
      <header className="max-w-3xl space-y-4">
        <p className="text-sm font-semibold text-primary">Preview-only · CCPun Motion Lab</p>
        <h1 className="text-4xl font-bold leading-tight text-foreground md:text-5xl">ความหมายมาก่อน Motion</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          เนื้อหาสำคัญแสดงครบตั้งแต่ first paint ส่วน motion ใช้เพื่อบอกลำดับ การตอบสนอง และความสัมพันธ์ของตัวเลขเท่านั้น
        </p>
      </header>

      <section aria-labelledby="motion-token-title" className="space-y-5">
        <h2 id="motion-token-title" className="text-2xl font-bold text-foreground">Motion DNA และ token</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tokenRows.map(([name, value, purpose]) => (
            <div key={name} className="border-y border-border/50 py-4">
              <dt className="text-sm text-muted-foreground">{name}</dt>
              <dd className="mt-1 text-xl font-semibold text-primary">{value}</dd>
              <dd className="mt-1 text-sm text-muted-foreground">{purpose}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="motion-micro-title" className="space-y-5">
        <h2 id="motion-micro-title" className="text-2xl font-bold text-foreground">Micro motion</h2>
        <div className="flex flex-wrap items-start gap-4">
          <button type="button" className="gold-button">กดเพื่อดู pressed state</button>
          <details className="min-w-64 border-y border-border/50 py-2">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold text-foreground">เปิดเมนูตัวอย่าง</summary>
            <p className="py-3 text-sm text-muted-foreground">ใช้ native disclosure, keyboard ได้ และไม่พึ่ง hover</p>
          </details>
        </div>
      </section>

      <ScrollReveal>
        <section aria-labelledby="motion-reveal-title" className="border-y border-border/50 py-8">
          <p className="text-sm font-semibold text-primary">เลื่อนมาถึงแล้วจึงเกิดครั้งเดียว</p>
          <h2 id="motion-reveal-title" className="mt-2 text-2xl font-bold text-foreground">Section reveal</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">Opacity + ระยะขึ้น 12px บนจอใหญ่ และ 8px บนมือถือ โดยพื้นที่ถูกจองไว้ตั้งแต่แรก</p>
        </section>
      </ScrollReveal>

      <section aria-labelledby="motion-data-title" className="space-y-8">
        <div>
          <p className="text-sm font-semibold text-primary">ตัวเลขจริงอยู่ใน DOM ทันที</p>
          <h2 id="motion-data-title" className="mt-2 text-2xl font-bold text-foreground">Data motion</h2>
        </div>
        <MoneyComparison need={3_000_000} resources={1_200_000} title="CI · ทุนที่ควรเตรียมเทียบกับทรัพยากร" />
        <MoneyComparison need={4_000_000} resources={4_500_000} title="FHC · ภาระครอบครัวเทียบกับทรัพยากร" needLabel="ภาระตามข้อมูลที่กรอก" />
      </section>

      <section aria-labelledby="motion-loading-title" className="space-y-5">
        <h2 id="motion-loading-title" className="text-2xl font-bold text-foreground">Loading และ font behavior</h2>
        <div className="motion-lab-skeleton form-glass space-y-3 p-5" aria-label="ตัวอย่าง skeleton ที่เล่นเพียงสามรอบ">
          <span className="block h-4 w-1/3 rounded bg-muted" />
          <span className="block h-4 w-full rounded bg-muted" />
          <span className="block h-4 w-2/3 rounded bg-muted" />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">Kanit ใช้ next/font แบบ optional; H1 ไม่ถูกซ่อนหรือรอ JavaScript ระหว่างโหลดฟอนต์</p>
      </section>

      <aside className="rounded-xl border border-primary/30 bg-primary/5 p-5" aria-labelledby="motion-reduced-title">
        <h2 id="motion-reduced-title" className="text-xl font-bold text-foreground">Reduced motion</h2>
        <p className="mt-2 text-muted-foreground">เมื่อระบบตั้งค่า Reduce Motion: movement, delay และ transition ถูกปิด แต่ข้อมูล ปุ่ม และ navigation อยู่ครบ</p>
      </aside>
    </main>
  );
}
