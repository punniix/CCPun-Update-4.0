'use client';

import { lazy, Suspense, useState } from "react";
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { INVESTMENT_COPY_DEFAULTS } from "@/lib/content/investment-copy-defaults";
import SingleFundBuilder from "./SingleFundBuilder";
import styles from "./InvestmentAllocation.module.css";
import type { FundScope } from "./domain/fund-scope";

function PortfolioLoading() {
  const text = usePublicCopy(INVESTMENT_COPY_DEFAULTS);
  return <p className={styles.shell} role="status">{text.node("investment.mode.loading")}</p>;
}

function PortfolioLoadError() {
  const text = usePublicCopy(INVESTMENT_COPY_DEFAULTS);
  return <div className={styles.shell} role="alert"><p>{text.node("investment.mode.loadError")}</p><button className={styles.secondary} type="button" onClick={() => window.location.reload()}>{text.node("investment.mode.reload")}</button></div>;
}

// ponytail: recover a failed chunk by explicit reload; no extra retry framework.
const PortfolioBuilder = lazy(() => import("./PortfolioBuilder").catch(() => ({ default: PortfolioLoadError })));

type JourneyMode = "single" | "portfolio";

/** One engine for both tools; `scope` only narrows which AMCs the server returns. */
export default function InvestmentAllocationTool({ scope = "main" }: { scope?: FundScope }) {
  const text = usePublicCopy(INVESTMENT_COPY_DEFAULTS);
  const [mode, setMode] = useState<JourneyMode>("single");

  return (
    <>
      <section className={styles.modeSection} aria-labelledby="investment-mode-title">
        <div className={styles.modeInner}>
          <h2 id="investment-mode-title">{text.node("investment.mode.text242")}</h2>
          <p className={styles.modeLead}>{text.node("investment.mode.text243")}</p>
          <div className={styles.modeGrid} role="group" aria-label={text("investment.mode.text244")}>
            <button className={styles.modeCard} data-active={mode === "single"} aria-pressed={mode === "single"} type="button" onClick={() => setMode("single")}>
              <strong>{text.node("investment.mode.text245")}</strong>
              <span>{text.node("investment.mode.text246")}</span>
            </button>
            <button className={styles.modeCard} data-active={mode === "portfolio"} aria-pressed={mode === "portfolio"} type="button" onClick={() => setMode("portfolio")}>
              <strong>{text.node("investment.mode.text247")}</strong>
              <span>{text.node("investment.mode.text248")}</span>
            </button>
          </div>
        </div>
      </section>
      {mode === "single" ? <SingleFundBuilder scope={scope} /> : (
        <Suspense fallback={<PortfolioLoading />}>
          <PortfolioBuilder scope={scope} />
        </Suspense>
      )}
    </>
  );
}
