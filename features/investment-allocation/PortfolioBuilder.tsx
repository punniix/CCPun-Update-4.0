'use client';
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { INVESTMENT_COPY_DEFAULTS } from "@/lib/content/investment-copy-defaults";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { allocationTotal, calculatePlan, constructionCoverageMatches, createAdvisorHandoffPayload, isAllocationComplete, percentForAmount } from "./domain/calculation";
import { planningFundFromDetail } from "./domain/detail-to-planning";
import type { AllocationRow, AssetBucket, ConstructionBucket, FundDetailResponse, FundSearchResponse, InvestmentPlanResult, PlanningFund, SelectedFund } from "./domain/types";
import styles from "./InvestmentAllocation.module.css";









const initialConstruction: AllocationRow<ConstructionBucket>[] = [
  { key: "mixed", percent: 0 },
  { key: "equity", percent: 0 },
  { key: "fixed_income", percent: 0 },
  { key: "money_market", percent: 0 },
  { key: "other", percent: 0 },
];

const initialTarget: AllocationRow<Exclude<AssetBucket, "unknown">>[] = [
  { key: "equity", percent: 0 },
  { key: "fixed_income", percent: 0 },
  { key: "cash", percent: 0 },
  { key: "other", percent: 0 },
];

function safePercent(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.round(parsed * 100) / 100));
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
}



export default function PortfolioBuilder() {
  const copyText = usePublicCopy(INVESTMENT_COPY_DEFAULTS);
  const { CONSTRUCTION_LABELS, ASSET_LABELS, EFFECTIVE_LABELS } = allocationLabels(copyText);




function stepCopy(step: number) {
  if (step === 1) return { title: copyText("investment.stepCopyText"), body: copyText("investment.stepCopyText2") };
  if (step === 2) return { title: copyText("investment.stepCopyText3"), body: copyText("investment.stepCopyText4") };
  if (step === 3) return { title: copyText("investment.stepCopyText5"), body: copyText("investment.stepCopyText6") };
  return { title: copyText("investment.stepCopyText7"), body: copyText("investment.stepCopyText8") };
}

  const [step, setStep] = useState(1);
  const [investmentAmount, setInvestmentAmount] = useState("");
  const [construction, setConstruction] = useState(initialConstruction);
  const [target, setTarget] = useState(initialTarget);
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<FundSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedFunds, setSelectedFunds] = useState<SelectedFund[]>([]);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const startedRef = useRef(false);
  const searchRequest = useRef(0);
  const detailRequests = useRef(new Map<string, number>());
  const selectedIds = useRef(new Set<string>());
  const [selectedDetails, setSelectedDetails] = useState<Record<string, {
    state: "loading" | "ready" | "unavailable";
    detail: FundDetailResponse | null;
    requestedClass: string | null;
  }>>({});

  useEffect(() => () => {
    searchRequest.current++;
    for (const [id, generation] of detailRequests.current) detailRequests.current.set(id, generation + 1);
    selectedIds.current.clear();
  }, []);

  const parsedAmount = Number(investmentAmount.replace(/,/g, ""));
  const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const constructionTotal = allocationTotal(construction);
  const selectedTotal = allocationTotal(selectedFunds.map((selected) => ({ key: selected.fund.id, percent: selected.weightPercent })));
  const targetTotal = allocationTotal(target);
  const constructionValid = amount > 0 && isAllocationComplete(construction);
  const detailsReady = selectedFunds.every(({ fund }) =>
    selectedDetails[fund.id]?.state === "ready" &&
    (!selectedDetails[fund.id].detail?.classes.length || Boolean(fund.className))
  );
  const selectedValid = selectedFunds.length > 0 && detailsReady && isAllocationComplete(selectedFunds.map((selected) => ({ key: selected.fund.id, percent: selected.weightPercent }))) && constructionCoverageMatches(construction, selectedFunds);
  const targetValid = targetTotal === 0 || isAllocationComplete(target);

  const result = useMemo(() => {
    if (step !== 4 || !constructionValid || !selectedValid || !targetValid) return null;
    try {
      return calculatePlan({ investmentAmount: amount, fundConstructionAllocation: construction, targetAssetAllocation: target, selectedFunds });
    } catch {
      return null;
    }
  }, [step, constructionValid, selectedValid, targetValid, amount, construction, target, selectedFunds]);

  const currentCopy = stepCopy(step);

  function updateConstruction(key: ConstructionBucket, percent: number) {
    setConstruction((current) => current.map((row) => row.key === key ? { ...row, percent } : row));
  }

  function updateConstructionAmount(key: ConstructionBucket, amountValue: string) {
    if (amount <= 0) return;
    updateConstruction(key, percentForAmount(amount, Number(amountValue)));
  }

  function updateTarget(key: Exclude<AssetBucket, "unknown">, percent: number) {
    setTarget((current) => current.map((row) => row.key === key ? { ...row, percent } : row));
  }

  function navigate(next: number) {
    if (!startedRef.current) {
      startedRef.current = true;
      trackEvent("ia_tool_start", { tool_name: "investment_allocation", cta_location: "investment_allocation_builder", surface_group: "investment_allocation" });
    }
    setSaveStatus(null);
    setStep(next);
    trackEvent("ia_step_view", { tool_name: "investment_allocation", step_number: next, cta_location: next === 4 ? "investment_allocation_result" : "investment_allocation_builder", surface_group: "investment_allocation" });
    if (next === 4) trackEvent("ia_result_view", { tool_name: "investment_allocation", cta_location: "investment_allocation_result", surface_group: "investment_allocation" });
    window.setTimeout(() => document.getElementById("investment-allocation-builder")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }), 0);
  }

  async function searchFunds(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    const request = ++searchRequest.current;
    setSearching(true);
    setSearchState(null);
    try {
      const response = await fetch(`/api/investment-allocation/funds/?q=${encodeURIComponent(trimmed)}`, { method: "GET", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`funds_${response.status}`);
      const data = await response.json() as FundSearchResponse;
      if (request !== searchRequest.current) return;
      setSearchState(data);
    } catch {
      if (request !== searchRequest.current) return;
      setSearchState({ mode: "sec_live", state: "unavailable", query: trimmed, funds: [], message: copyText("investment.searchFundsText"), fetchedAt: new Date().toISOString() });
    } finally {
      if (request === searchRequest.current) setSearching(false);
    }
  }

  function addFund(fund: PlanningFund) {
    if (!fund.constructionBucket || selectedIds.current.has(fund.id)) return;
    selectedIds.current.add(fund.id);
    setSelectedFunds((current) => current.some((selected) => selected.fund.id === fund.id) ? current : [...current, { fund, weightPercent: 0, selectionSource: "customer" }]);
    void loadSelectedDetail(fund, null);
  }

  async function loadSelectedDetail(fund: PlanningFund, requestedClass: string | null) {
    const request = (detailRequests.current.get(fund.id) ?? 0) + 1;
    detailRequests.current.set(fund.id, request);
    setSaveStatus(null);
    setSelectedDetails((current) => ({ ...current, [fund.id]: { state: "loading", detail: current[fund.id]?.detail ?? null, requestedClass } }));
    try {
      const params = new URLSearchParams({ proj_id: fund.projectId });
      if (requestedClass) params.set("class_name", requestedClass);
      const response = await fetch(`/api/investment-allocation/detail/?${params}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`detail_${response.status}`);
      const detail = await response.json() as FundDetailResponse;
      if (detailRequests.current.get(fund.id) !== request || !selectedIds.current.has(fund.id)) return;
      const hydrated = planningFundFromDetail(fund, detail, requestedClass);
      setSelectedFunds((current) => current.map((selected) => selected.fund.id === fund.id ? { ...selected, fund: hydrated } : selected));
      setSelectedDetails((current) => ({ ...current, [fund.id]: { state: "ready", detail, requestedClass } }));
    } catch {
      if (detailRequests.current.get(fund.id) !== request || !selectedIds.current.has(fund.id)) return;
      setSelectedDetails((current) => ({ ...current, [fund.id]: { state: "unavailable", detail: current[fund.id]?.detail ?? null, requestedClass } }));
    }
  }

  function updateSelectedWeight(id: string, weightPercent: number) {
    setSelectedFunds((current) => current.map((selected) => selected.fund.id === id ? { ...selected, weightPercent } : selected));
  }

  function removeFund(id: string) {
    selectedIds.current.delete(id);
    detailRequests.current.set(id, (detailRequests.current.get(id) ?? 0) + 1);
    setSelectedFunds((current) => current.filter((selected) => selected.fund.id !== id));
    setSelectedDetails((current) => { const next = { ...current }; delete next[id]; return next; });
  }

  function ensurePlanId(): string {
    if (planId) return planId;
    const next = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `plan-${Date.now()}`;
    setPlanId(next);
    return next;
  }

  function savePlan() {
    if (!result) return;
    const id = ensurePlanId();
    const payload = createAdvisorHandoffPayload(id, result);
    try {
      localStorage.setItem("ccpun_investment_allocation_plan_v1", JSON.stringify(payload));
      setSaveStatus(copyText("investment.savePlanText"));
      trackEvent("ia_save_local", { tool_name: "investment_allocation", cta_location: "investment_allocation_result", surface_group: "investment_allocation" });
    } catch {
      setSaveStatus(copyText("investment.savePlanText2"));
    }
  }

  async function handoffToLine() {
    if (!result) return;
    const id = ensurePlanId();
    const payload = createAdvisorHandoffPayload(id, result);
    const lines = [
      copyText("investment.linesText"),
      copyText("investment.dynamic1").replaceAll("{0}", String(payload.plan_id)),
      copyText("investment.dynamic2").replaceAll("{0}", String(formatMoney(payload.investment_amount))),
      "",
      copyText("investment.linesText2"),
      ...payload.selected_funds.map((fund) => `- ${fund.fund_name}: ${fund.selected_weight_percent}%`),
      ...payload.selected_funds.map((fund) => copyText("investment.dynamic13").replaceAll("{0}", String(fund.class_name ?? copyText("investment.linesText3"))).replaceAll("{1}", String(fund.provenance?.source === "uat_synthetic" ? copyText("investment.linesText4") : copyText("investment.linesText5"))).replaceAll("{2}", String(fund.provenance?.sourceDate ?? copyText("investment.linesText3"))).replaceAll("{3}", String(fund.provenance?.fetchedAt ?? copyText("investment.linesText3")))),
      "",
      copyText("investment.linesText6"),
      ...payload.effective_allocation.filter((row) => row.percent > 0).map((row) => `- ${EFFECTIVE_LABELS[row.key]}: ${row.percent}%`),
      "",
      copyText("investment.linesText7"),
      ...payload.risk_distribution.filter((row) => row.percent > 0).map((row) => `- ${row.level === "unknown" ? copyText("investment.linesText8") : copyText("investment.dynamic14").replaceAll("{0}", String(row.level))}: ${row.percent}%`),
      "",
      copyText("investment.linesText9"),
      ...payload.liquidity_summary.filter((row) => row.percent > 0).map((row) => `- ${row.bucket}: ${row.percent}%`),
      "",
      copyText("investment.linesText10"),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setSaveStatus(copyText("investment.handoffToLineText"));
    } catch {
      setSaveStatus(copyText("investment.handoffToLineText2"));
    }
    trackEvent("ia_contact_click", { tool_name: "investment_allocation", contact_channel: "line", cta_location: "investment_allocation_result", surface_group: "investment_allocation" });
    window.open("https://lin.ee/tqLCs4f", "_blank", "noopener,noreferrer");
  }

  return (
    <section id="investment-allocation-builder" className={styles.shell} aria-label={copyText("investment.portfolioBuilderarialabel")}>
      <div className={styles.grid}>
        <div className={styles.builder}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.eyebrow}>{copyText.node("investment.strong2")}</p>
              <h2>{currentCopy.title}</h2>
              <p>{currentCopy.body}</p>
            </div>
            <span className={styles.stepPill}>{copyText.node("investment.stepPill")}{step}{copyText.node("investment.stepPill2")}</span>
          </div>

          {step === 1 ? (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="investment-amount">{copyText.node("investment.fieldLabel")}</label>
                <div className={styles.moneyInputWrap}>
                  <input id="investment-amount" inputMode="decimal" type="number" min="0" step="1000" value={investmentAmount} onChange={(event) => setInvestmentAmount(event.target.value)} placeholder={copyText("investment.portfolioBuilderplaceholder")} />
                  <span>{copyText.node("investment.span3")}</span>
                </div>
                <p className={styles.fieldHint}>{copyText.node("investment.fieldHint")}</p>
              </div>

              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>{copyText.node("investment.fieldLabel2")}</span>
                <div className={styles.allocationList}>
                  {construction.map((row) => (
                    <div className={styles.allocationRow} key={row.key}>
                      <div className={styles.allocationName}><strong>{CONSTRUCTION_LABELS[row.key]}</strong><small>{copyText.node("investment.small")}</small></div>
                      <div className={styles.allocationControls}>
                        <label className={styles.percentWrap}><span>%</span><input className={styles.percentInput} aria-label={copyText("investment.dynamic15").replaceAll("{0}", String(CONSTRUCTION_LABELS[row.key]))} type="number" min="0" max="100" step="0.01" value={row.percent ? Math.round(row.percent * 100) / 100 : ""} onChange={(event) => updateConstruction(row.key, safePercent(event.target.value))} /></label>
                        <label className={styles.amountWrap}><span>{copyText.node("investment.span3")}</span><input className={styles.amountInput} aria-label={copyText("investment.dynamic16").replaceAll("{0}", String(CONSTRUCTION_LABELS[row.key]))} inputMode="decimal" type="number" min="0" max={amount || undefined} step="1000" disabled={amount <= 0} value={amount > 0 && row.percent ? Math.round((amount * row.percent) / 100 * 100) / 100 : ""} onChange={(event) => updateConstructionAmount(row.key, event.target.value)} /></label>
                      </div>
                    </div>
                  ))}
                </div>
                <AllocationTotal total={constructionTotal} label={copyText("investment.portfolioBuilderlabel")} />
              </div>

              <div className={styles.actions}><span /><button className={styles.primary} type="button" disabled={!constructionValid} onClick={() => navigate(2)}>{copyText.node("investment.primary")}</button></div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <form className={styles.searchRow} onSubmit={searchFunds}>
                <input className={styles.searchInput} aria-label={copyText("investment.portfolioBuilderarialabel2")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copyText("investment.portfolioBuilderplaceholder2")} />
                <button className={styles.smallButton} type="submit" disabled={searching}>{searching ? copyText("investment.portfolioBuilderText") : copyText("investment.portfolioBuilderText2")}</button>
              </form>
              <div className={styles.statusNotice}><strong>{copyText.node("investment.strong3")}</strong>{" "}{copyText.node("investment.statusNotice")}</div>

              {searchState?.message ? <div className={styles.statusNotice} role="status">{searchState.message}</div> : null}
              {searchState?.funds.length ? (
                <div className={styles.searchResults} aria-label={copyText("investment.portfolioBuilderarialabel3")}>
                  {searchState.funds.map((fund) => {
                    const alreadySelected = selectedFunds.some((selected) => selected.fund.id === fund.id);
                    const selectable = Boolean(fund.constructionBucket);
                    return <article className={styles.fundCard} key={fund.id}>
                      <div className={styles.fundTop}><div className={styles.fundTitle}><strong>{fund.name}</strong><small>{fund.shortName}{fund.className ? ` · ${fund.className}` : ""}</small></div><span className={styles.sourceBadge}>{fund.provenance.source === "uat_synthetic" ? copyText("investment.portfolioBuilderText3") : copyText("investment.linesText5")}</span></div>
                      <div className={styles.fundFacts}><span>{copyText.node("investment.span4")}{fund.riskSpectrum ?? "—"}</span><span>{fund.constructionBucket ? CONSTRUCTION_LABELS[fund.constructionBucket] : copyText("investment.portfolioBuilderText4")}</span><span>{fund.liquidity.rawText ?? copyText("investment.portfolioBuilderText5")}</span></div>
                      {!selectable ? <p className={styles.liveFundWarning}>{copyText.node("investment.liveFundWarning")}</p> : null}
                      <button type="button" data-primary={selectable && !alreadySelected} disabled={!selectable || alreadySelected} onClick={() => addFund(fund)}>{alreadySelected ? copyText("investment.portfolioBuilderText6") : selectable ? copyText("investment.portfolioBuilderText7") : copyText("investment.portfolioBuilderText8")}</button>
                    </article>;
                  })}
                </div>
              ) : null}

              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>{copyText.node("investment.fieldLabel3")}</span>
                {selectedFunds.length === 0 ? <div className={styles.statusNotice}>{copyText.node("investment.statusNotice2")}</div> : (
                  <div className={styles.selectedList}>
                    {selectedFunds.map((selected) => <article className={styles.fundCard} key={selected.fund.id}>
                      <div className={styles.fundTop}><div className={styles.fundTitle}><strong>{selected.fund.name}</strong><small>{selected.fund.constructionBucket ? CONSTRUCTION_LABELS[selected.fund.constructionBucket] : copyText("investment.portfolioBuilderText9")}</small></div><span className={styles.sourceBadge}>{copyText.node("investment.sourceBadge")}</span></div>
                      {selectedDetails[selected.fund.id]?.state === "loading" ? (
                        <p className={styles.provenance} role="status">{copyText.node("investment.provenance")}</p>
                      ) : null}
                      {selectedDetails[selected.fund.id]?.state === "unavailable" ? (
                        <div className={styles.statusNotice} role="status">{copyText.node("investment.statusNotice3")}<button className={styles.smallButton} type="button" onClick={() => void loadSelectedDetail(selected.fund, selectedDetails[selected.fund.id].requestedClass)}>{copyText.node("investment.smallButton")}</button>
                        </div>
                      ) : null}
                      {selectedDetails[selected.fund.id]?.detail?.classes.length ? (
                        <label className={styles.fieldGroup}>
                          <span className={styles.fieldLabel}>{copyText.node("investment.fieldLabel4")}</span>
                          <select
                            className={styles.amcSelect}
                            aria-label={copyText("investment.dynamic17").replaceAll("{0}", String(selected.fund.name))}
                            value={selectedDetails[selected.fund.id].requestedClass ?? ""}
                            disabled={selectedDetails[selected.fund.id].state === "loading"}
                            onChange={(event) => void loadSelectedDetail(selected.fund, event.target.value || null)}
                          >
                            <option value="">{copyText.node("investment.option")}</option>
                            {[...new Map(selectedDetails[selected.fund.id].detail!.classes.map(row => [row.name, row])).values()].map(row => (
                              <option key={row.name} value={row.name}>{row.name}{row.description ? ` · ${row.description}` : ""}</option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {selectedDetails[selected.fund.id]?.state === "ready" ? (
                        <>
                          <div className={styles.fundFacts}>
                            <span>{copyText.node("investment.span4")}{selected.fund.riskSpectrum ?? copyText("investment.linesText8")}</span>
                            <span>{selected.fund.liquidity.rawText ?? copyText("investment.portfolioBuilderText10")}</span>
                          </div>
                          <details>
                            <summary className={styles.smallButton}>{copyText.node("investment.smallButton2")}</summary>
                            <ul className={styles.warningList}>
                              {selectedDetails[selected.fund.id].detail!.assetAllocation.map((row, index) => (
                                <li key={index}>{row.name}: {row.percentNav}{copyText.node("investment.li")}{row.sourceDate ?? copyText("investment.linesText3")}</li>
                              ))}
                            </ul>
                            {selected.fund.provenance.notes.map((note, index) => <p className={styles.provenance} key={index}>{note}</p>)}
                          </details>
                        </>
                      ) : null}
                      <div className={styles.selectedControl}>
                        <label><span>{copyText.node("investment.span5")}</span><div className={styles.percentWrap}><span>%</span><input className={styles.percentInput} type="number" min="0" max="100" step="1" aria-label={copyText("investment.dynamic18").replaceAll("{0}", String(selected.fund.name))} value={selected.weightPercent || ""} onChange={(event) => updateSelectedWeight(selected.fund.id, safePercent(event.target.value))} /></div></label>
                        <button type="button" onClick={() => removeFund(selected.fund.id)}>{copyText.node("investment.button")}</button>
                      </div>
                    </article>)}
                  </div>
                )}
                <AllocationTotal total={selectedTotal} label={copyText("investment.portfolioBuilderlabel2")} errorMessage={selectedTotal === 100 && !constructionCoverageMatches(construction, selectedFunds) ? copyText("investment.portfolioBuilderText11") : undefined} />
              </div>

              <div className={styles.actions}><button className={styles.ghost} type="button" onClick={() => navigate(1)}>{copyText.node("investment.ghost")}</button><button className={styles.primary} type="button" disabled={!selectedValid} onClick={() => navigate(3)}>{copyText.node("investment.primary2")}</button></div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className={styles.optionalBox}>
                <h3>{copyText.node("investment.h3")}</h3>
                <p>{copyText.node("investment.p")}</p>
              </div>
              <div className={styles.allocationList}>
                {target.map((row) => (
                  <div className={styles.allocationRow} key={row.key}>
                    <div className={styles.allocationName}><strong>{ASSET_LABELS[row.key]}</strong><small>{copyText.node("investment.small2")}</small></div>
                    <label className={styles.percentWrap}><span>%</span><input className={styles.percentInput} aria-label={copyText("investment.dynamic19").replaceAll("{0}", String(ASSET_LABELS[row.key]))} type="number" min="0" max="100" step="1" value={row.percent || ""} onChange={(event) => updateTarget(row.key, safePercent(event.target.value))} /></label>
                  </div>
                ))}
              </div>
              <AllocationTotal total={targetTotal} label={copyText("investment.portfolioBuilderlabel3")} allowZero />
              <div className={styles.actions}><button className={styles.ghost} type="button" onClick={() => navigate(2)}>{copyText.node("investment.ghost")}</button><button className={styles.primary} type="button" disabled={!targetValid} onClick={() => navigate(4)}>{copyText.node("investment.primary3")}</button></div>
            </>
          ) : null}

          {step === 4 ? (
            result ? <ResultView result={result} onEdit={() => navigate(1)} onSave={savePlan} onHandoff={handoffToLine} saveStatus={saveStatus} /> : <div className={styles.statusNotice}>{copyText.node("investment.statusNotice4")}</div>
          ) : null}
        </div>

        <aside className={`${styles.summary} ${styles.summarySticky}`} aria-label={copyText("investment.portfolioBuilderarialabel4")}>
          <p className={styles.eyebrow}>{copyText.node("investment.eyebrow2")}</p>
          <h2>{copyText.node("investment.h22")}</h2>
          <p className={styles.summaryIntro}>{copyText.node("investment.summaryIntro")}</p>
          <div className={styles.summaryAmount}><span>{copyText.node("investment.span6")}</span><strong>{amount > 0 ? copyText("investment.dynamic11").replaceAll("{0}", String(formatMoney(amount))) : "—"}</strong></div>
          <dl className={styles.summaryRows}>
            <div className={styles.summaryRow}><dt>{copyText.node("investment.dt")}</dt><dd>{constructionTotal}{copyText.node("investment.dd")}</dd></div>
            <div className={styles.summaryRow}><dt>{copyText.node("investment.dt2")}</dt><dd>{selectedFunds.length}{" "}{copyText.node("investment.dd2")}{selectedTotal}%</dd></div>
            <div className={styles.summaryRow}><dt>{copyText.node("investment.dt3")}</dt><dd>{targetTotal === 0 ? copyText("investment.portfolioBuilderText12") : `${targetTotal}%`}</dd></div>
            <div className={styles.summaryRow}><dt>{copyText.node("investment.dt4")}</dt><dd>{searchState?.mode === "sec_live" ? copyText("investment.portfolioBuilderText13") : searchState ? copyText("investment.portfolioBuilderText3") : copyText("investment.portfolioBuilderText14")}</dd></div>
          </dl>
          <div className={styles.statusNotice}>{copyText.node("investment.statusNotice5")}</div>
        </aside>
      </div>
    </section>
  );
}

function AllocationTotal({ total, label, allowZero = false, errorMessage }: { total: number; label: string; allowZero?: boolean; errorMessage?: string }) {
  const copyText = usePublicCopy(INVESTMENT_COPY_DEFAULTS);

  const valid = total === 100 || (allowZero && total === 0);
  const width = Math.min(100, Math.max(0, total));
  const message = errorMessage ?? (valid ? (total === 0 ? copyText("investment.messageText") : copyText("investment.messageText2")) : total < 100 ? copyText("investment.dynamic20").replaceAll("{0}", String(Math.round((100 - total) * 100) / 100)) : copyText("investment.dynamic21").replaceAll("{0}", String(Math.round((total - 100) * 100) / 100)));
  return <div className={styles.totalBox} data-valid={valid}><div className={styles.totalLine}><span>{label}</span><strong>{total}%</strong></div><div className={styles.progressTrack} aria-hidden="true"><div className={styles.progressFill} style={{ width: `${width}%` }} /></div><p className={styles.validation} data-error={!valid || Boolean(errorMessage)} aria-live="polite">{message}</p></div>;
}

function ResultView({ result, onEdit, onSave, onHandoff, saveStatus }: { result: InvestmentPlanResult; onEdit: () => void; onSave: () => void; onHandoff: () => void; saveStatus: string | null }) {
  const copyText = usePublicCopy(INVESTMENT_COPY_DEFAULTS);
  const { ASSET_LABELS, EFFECTIVE_LABELS, WARNING_LABELS } = allocationLabels(copyText);

  const unknownRisk = result.riskDistribution.find((row) => row.level === "unknown")?.percent ?? 0;
  return <div className={styles.resultStack}>
    <div className={styles.resultPanel}>
      <h3>{copyText.node("investment.h32")}</h3>
      <p>{copyText.node("investment.p2")}{result.coverage.effectiveAssetPercentKnown}{copyText.node("investment.p3")}</p>
      <div className={styles.barList}>{result.effectiveAllocation.filter((row) => row.percent > 0).map((row) => <div className={styles.barRow} key={row.key}><span className={styles.barLabel}>{EFFECTIVE_LABELS[row.key]}</span><div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${Math.min(100, row.percent)}%` }} /></div><span className={styles.barValue}>{row.percent}%</span></div>)}</div>
    </div>

    <div className={styles.resultPanel}>
      <h3>{copyText.node("investment.h33")}</h3>
      {result.targetDelta.length ? <div className={styles.deltaList}>{result.targetDelta.map((row) => <div className={styles.deltaRow} key={row.asset}><strong>{ASSET_LABELS[row.asset]}{" "}{copyText.node("investment.strong4")}{row.targetPercent}{copyText.node("investment.strong5")}{row.effectivePercent}%</strong><span>{row.conclusive && row.deltaPercentagePoints !== null ? copyText("investment.dynamic22").replaceAll("{0}", String(row.deltaPercentagePoints > 0 ? "+" : "")).replaceAll("{1}", String(row.deltaPercentagePoints)) : copyText("investment.resultViewText")}</span></div>)}</div> : <p>{copyText.node("investment.p4")}</p>}
    </div>

    <div className={styles.resultPanel}>
      <h3>{copyText.node("investment.h34")}</h3>
      <p>{copyText.node("investment.p5")}</p>
      <div className={styles.riskRail}>{result.riskDistribution.filter((row) => row.level !== "unknown").map((row) => <div className={styles.riskCell} data-has-value={row.percent > 0} key={String(row.level)}><strong>{row.level}</strong><span>{row.percent}%</span></div>)}</div>
      {unknownRisk > 0 ? <p className={styles.unknownLine}>{copyText.node("investment.unknownLine")}{unknownRisk}{copyText.node("investment.unknownLine2")}</p> : null}
    </div>

    <div className={styles.resultPanel}>
      <h3>{copyText.node("investment.h35")}</h3>
      <p>{copyText.node("investment.p6")}</p>
      <div className={styles.liquidityGrid}>{result.liquiditySummary.map((row) => <div className={styles.liquidityCard} key={row.bucket}><strong>{row.bucket}</strong><span>{row.percent}% · {formatMoney(row.amount)}{" "}{copyText.node("investment.span3")}</span></div>)}</div>
    </div>

    <div className={styles.resultPanel}><h3>{copyText.node("investment.h36")}</h3><ul className={styles.warningList}>{result.selectedFunds.map(({ fund }) => <li key={fund.id}>{fund.name}{" "}{copyText.node("investment.li2")}{fund.className ?? copyText("investment.linesText3")} · {fund.provenance.source === "uat_synthetic" ? copyText("investment.linesText4") : copyText("investment.linesText5")}{" "}{copyText.node("investment.li3")}{fund.provenance.sourceDate ?? copyText("investment.linesText3")}{" "}{copyText.node("investment.li4")}{fund.provenance.fetchedAt}</li>)}</ul><p>{copyText.node("investment.p7")}</p></div>
    <div className={styles.resultPanel}><h3>{copyText.node("investment.h37")}</h3><ul className={styles.warningList}>{result.warnings.map((warning) => <li key={warning}>{WARNING_LABELS[warning]}</li>)}</ul></div>

    <div className={styles.resultPanel}><h3>{copyText.node("investment.h38")}</h3><p>{copyText.node("investment.p8")}</p><div className={styles.resultActions}><button className={styles.ghost} type="button" onClick={onEdit}>{copyText.node("investment.ghost2")}</button><button className={styles.secondary} type="button" onClick={onSave}>{copyText.node("investment.secondary")}</button><button className={styles.primary} type="button" onClick={onHandoff}>{copyText.node("investment.primary4")}</button></div>{saveStatus ? <p className={styles.saveStatus} role="status">{saveStatus}</p> : null}</div>
  </div>;
}

function allocationLabels(copyText: (key: keyof typeof INVESTMENT_COPY_DEFAULTS) => string) {
const CONSTRUCTION_LABELS: Record<ConstructionBucket, string> = {
  mixed: copyText("investment.cONSTRUCTIONLABELSText"),
  equity: copyText("investment.cONSTRUCTIONLABELSText2"),
  fixed_income: copyText("investment.cONSTRUCTIONLABELSText3"),
  money_market: copyText("investment.cONSTRUCTIONLABELSText4"),
  other: copyText("investment.cONSTRUCTIONLABELSText5"),
};
const ASSET_LABELS: Record<Exclude<AssetBucket, "unknown">, string> = {
  equity: copyText("investment.aSSETLABELSText"),
  fixed_income: copyText("investment.aSSETLABELSText2"),
  cash: copyText("investment.aSSETLABELSText3"),
  other: copyText("investment.aSSETLABELSText4"),
};
const EFFECTIVE_LABELS: Record<AssetBucket, string> = { ...ASSET_LABELS, unknown: copyText("investment.eFFECTIVELABELSText") };
const WARNING_LABELS: Record<InvestmentPlanResult["warnings"][number], string> = {
  demo_data: copyText("investment.wARNINGLABELSText"),
  partial_asset_allocation: copyText("investment.wARNINGLABELSText2"),
  missing_risk: copyText("investment.wARNINGLABELSText3"),
  missing_liquidity: copyText("investment.wARNINGLABELSText4"),
  target_not_set: copyText("investment.wARNINGLABELSText5"),
  target_delta_inconclusive: copyText("investment.wARNINGLABELSText6"),
  stale_data: copyText("investment.wARNINGLABELSText7"),
};
return { CONSTRUCTION_LABELS, ASSET_LABELS, EFFECTIVE_LABELS, WARNING_LABELS };
}
