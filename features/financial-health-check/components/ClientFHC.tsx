'use client';

import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ToolHero from '@/components/layout/ToolHero';
import FHCLandingIntro from './FHCLandingIntro';
import LifeCoverageWizard from './LifeCoverageWizard';

export default function ClientFHC() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar isToolPage />

      <ToolHero
        badge="Financial Health Check · โมดูลความคุ้มครองชีวิต"
        title="ตรวจสุขภาพการเงิน"
        highlight="เริ่มจากช่องว่างความคุ้มครอง"
        highlightOnNewLine
        description="ประเมินภาระที่ครอบครัวยังต้องดูแล แล้วเทียบกับทุนประกันชีวิตและสินทรัพย์ที่พร้อมใช้ เพื่อเห็นจุดที่ควรทบทวนต่อในแผนการเงิน"
      />

      {/* Main content */}
      <main id="main-content" tabIndex={-1} className="pb-16">
        <FHCLandingIntro />
        <section id="fhc-calculator" aria-labelledby="fhc-calculator-heading" className="mt-12 scroll-mt-28 border-y border-white/5 bg-[hsl(0_15%_16%_/_0.72)] px-4 py-12 sm:py-14 md:mt-16 md:py-16">
          <div className="mx-auto max-w-5xl">
            <div className="mb-7 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">เครื่องคำนวณทุนประกันชีวิต</p>
              <h2 id="fhc-calculator-heading" className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">เริ่มจากภาระที่คนข้างหลังต้องดูแล</h2>
              <p className="mt-2 text-sm leading-6 text-white/55 sm:text-base">2 ขั้นตอน เพื่อเห็นภาระรวม เทียบกับทุนประกันชีวิตและสินทรัพย์ที่พร้อมใช้</p>
            </div>
            <LifeCoverageWizard />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
