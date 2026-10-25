'use client';

import { useState } from "react";
import PortfolioBuilder from "./PortfolioBuilder";
import SingleFundBuilder from "./SingleFundBuilder";
import styles from "./InvestmentAllocation.module.css";
import type { FundScope } from "./domain/fund-scope";

type JourneyMode = "single" | "portfolio";

/** One engine for both tools; `scope` only narrows which AMCs the server returns. */
export default function InvestmentAllocationTool({ scope = "main" }: { scope?: FundScope }) {
  const [mode, setMode] = useState<JourneyMode>("single");

  return (
    <>
      <section className={styles.modeSection} aria-labelledby="investment-mode-title">
        <div className={styles.modeInner}>
          <h2 id="investment-mode-title">อยากใช้กองเดียว หรือจัดหลายกอง?</h2>
          <p className={styles.modeLead}>ทั้งสองทางให้คุณเป็นคนเลือกกองเอง ระบบไม่จัดอันดับ ไม่แนะนำกอง และไม่เลือกแทน</p>
          <div className={styles.modeGrid} role="group" aria-label="เลือกวิธีจัดการลงทุน">
            <button className={styles.modeCard} data-active={mode === "single"} aria-pressed={mode === "single"} type="button" onClick={() => setMode("single")}>
              <span className={styles.modeBadge}>เริ่มง่าย</span>
              <strong>ใช้กองเดียว</strong>
              <span>เลือกกองทุน 1 กอง แล้วดูว่าเงินถูกนำไปลงทุนในอะไร ความเสี่ยงระดับไหน และขายคืนแล้วรับเงินตามเงื่อนไขอะไร</span>
            </button>
            <button className={styles.modeCard} data-active={mode === "portfolio"} aria-pressed={mode === "portfolio"} type="button" onClick={() => setMode("portfolio")}>
              <span className={styles.modeBadge}>ขั้นสูง</span>
              <strong>จัดหลายกองเอง</strong>
              <span>กำหนดสัดส่วน เลือกหลายกอง และดูว่าสุดท้ายเงินกระจายไปอยู่ในสินทรัพย์อะไรบ้าง</span>
            </button>
          </div>
        </div>
      </section>
      {mode === "single" ? <SingleFundBuilder scope={scope} /> : <PortfolioBuilder scope={scope} />}
    </>
  );
}
