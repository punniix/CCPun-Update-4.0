'use client';
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { INVESTMENT_COPY_DEFAULTS } from "@/lib/content/investment-copy-defaults";

import { useState } from "react";
import PortfolioBuilder from "./PortfolioBuilder";
import SingleFundBuilder from "./SingleFundBuilder";
import styles from "./InvestmentAllocation.module.css";

type JourneyMode = "single" | "portfolio";

export default function InvestmentAllocationTool() {
  const copyText = usePublicCopy(INVESTMENT_COPY_DEFAULTS);


  const [mode, setMode] = useState<JourneyMode>("single");

  return (
    <>
      <section className={styles.modeSection} aria-labelledby="investment-mode-title">
        <div className={styles.modeInner}>
          <p className={styles.eyebrow}>{copyText.node("investment.eyebrow")}</p>
          <h2 id="investment-mode-title">{copyText.node("investment.h2")}</h2>
          <p className={styles.modeLead}>{copyText.node("investment.modeLead")}</p>
          <div className={styles.modeGrid} role="group" aria-label={copyText("investment.investmentAllocationToolarialabel")}>
            <button className={styles.modeCard} data-active={mode === "single"} aria-pressed={mode === "single"} type="button" onClick={() => setMode("single")}>
              <span className={styles.modeBadge}>{copyText.node("investment.modeBadge")}</span>
              <strong>{copyText.node("investment.strong")}</strong>
              <span>{copyText.node("investment.span")}</span>
            </button>
            <button className={styles.modeCard} data-active={mode === "portfolio"} aria-pressed={mode === "portfolio"} type="button" onClick={() => setMode("portfolio")}>
              <span className={styles.modeBadge}>{copyText.node("investment.modeBadge2")}</span>
              <strong>{copyText.node("investment.strong2")}</strong>
              <span>{copyText.node("investment.span2")}</span>
            </button>
          </div>
        </div>
      </section>
      {mode === "single" ? <SingleFundBuilder /> : <PortfolioBuilder />}
    </>
  );
}
