'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { INVESTMENT_COPY_DEFAULTS, investmentLabel, investmentValue } from "@/lib/content/investment-copy-defaults";
import { allocationTotal, calculatePlan, clampPercentInput, constructionCoverageMatches, createPlanId, createAdvisorHandoffPayload, isAllocationComplete, parseInvestmentAmount, percentForAmount } from "./domain/calculation";
import { planningFundFromDetail } from "./domain/detail-to-planning";
import type { AllocationRow, AssetBucket, ConstructionBucket, FundDetailResponse, FundSearchResponse, InvestmentPlanResult, PlanningFund, SelectedFund } from "./domain/types";
import styles from "./InvestmentAllocation.module.css";
import { INVESTMENT_RISK_STATEMENT, requestFailureMessage } from "./domain/copy";
import { type FundScope, withFundScope } from "./domain/fund-scope";
import { fetchRestoreData, readSavedPlan, savePlanLocally } from "./domain/saved-plan";

const CONSTRUCTION_LABELS: Record<ConstructionBucket, string> = {
  mixed: "กองทุนผสม",
  equity: "กองทุนหุ้น",
  fixed_income: "กองทุนตราสารหนี้",
  money_market: "กองทุนตลาดเงิน",
  other: "ประเภทอื่นที่ข้อมูลรองรับ",
};

const ASSET_LABELS: Record<Exclude<AssetBucket, "unknown">, string> = {
  equity: "หุ้น",
  fixed_income: "ตราสารหนี้",
  cash: "เงินฝาก / ตลาดเงิน",
  other: "สินทรัพย์อื่น",
};

const EFFECTIVE_LABELS: Record<AssetBucket, string> = { ...ASSET_LABELS, unknown: "ยังระบุไม่ได้" };

const WARNING_LABELS: Record<InvestmentPlanResult["warnings"][number], string> = {
  demo_data: "แผนนี้มีข้อมูลตัวอย่างชั่วคราวบางส่วน จึงยังไม่ควรนำไปใช้ตัดสินใจลงทุนจริง",
  partial_asset_allocation: "ข้อมูลสินทรัพย์ของบางกองยังไม่ครบ ส่วนที่ยังไม่ทราบจะแยกไว้ชัดเจนและไม่ถูกกระจายไปยังส่วนอื่น",
  missing_risk: "บางกองยังไม่มีข้อมูลระดับความเสี่ยงที่แสดงได้ในตอนนี้",
  missing_liquidity: "บางกองยังไม่มีข้อมูลเงื่อนไขรับเงินที่แสดงได้ในตอนนี้",
  target_not_set: "คุณยังไม่ได้กำหนดสัดส่วนสินทรัพย์เป้าหมาย จึงไม่มีการเปรียบเทียบกับเป้าหมาย",
  target_delta_inconclusive: "ยังมีสินทรัพย์บางส่วนที่ระบุไม่ได้ จึงยังสรุปส่วนต่างจากเป้าหมายไม่ได้ทั้งหมด",
  stale_data: "ข้อมูลบางส่วนอาจเก่า ควรตรวจวันที่ข้อมูลก่อนใช้ประกอบการตัดสินใจ",
};

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

function formatMoney(value: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
}

function stepCopy(step: number, text: (key: keyof typeof INVESTMENT_COPY_DEFAULTS) => string) {
  if (step === 1) return { title: text("investment.portfolio.text136"), body: text("investment.portfolio.text137") };
  if (step === 2) return { title: text("investment.portfolio.text138"), body: text("investment.portfolio.text139") };
  if (step === 3) return { title: text("investment.portfolio.text140"), body: text("investment.portfolio.text141") };
  return { title: text("investment.portfolio.text142"), body: text("investment.portfolio.text143") };
}

export default function PortfolioBuilder({ scope = "main" }: { scope?: FundScope }) {
  const text = usePublicCopy(INVESTMENT_COPY_DEFAULTS);
  const label = (value: string) => investmentLabel(value, text);
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
  const [restoring, setRestoring] = useState(false);
  const [handoffText, setHandoffText] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
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

  const amount = parseInvestmentAmount(investmentAmount);
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

  const currentCopy = stepCopy(step, text);

  function cancelRestore() {
    setHandoffText(null);
    if (restoring) { searchRequest.current++; setRestoring(false); }
  }

  function updateConstruction(key: ConstructionBucket, percent: number) {
    cancelRestore();
    setConstruction((current) => current.map((row) => row.key === key ? { ...row, percent } : row));
  }

  function updateConstructionAmount(key: ConstructionBucket, amountValue: string) {
    if (amount <= 0) return;
    updateConstruction(key, percentForAmount(amount, Number(amountValue)));
  }

  function updateTarget(key: Exclude<AssetBucket, "unknown">, percent: number) {
    cancelRestore();
    setTarget((current) => current.map((row) => row.key === key ? { ...row, percent } : row));
  }

  function navigate(next: number) {
    setSaveStatus(null);
    cancelRestore();
    setStep(next);
    window.setTimeout(() => document.getElementById("investment-allocation-builder")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }), 0);
  }

  async function searchFunds(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    const request = ++searchRequest.current;
    setRestoring(false);
    setSearching(true);
    setSearchState(null);
    try {
      const response = await fetch(`/api/investment-allocation/funds/?q=${encodeURIComponent(trimmed)}${scope === "main" ? "" : `&${withFundScope(new URLSearchParams(), scope)}`}`, { method: "GET", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`funds_${response.status}`);
      const data = await response.json() as FundSearchResponse;
      if (request !== searchRequest.current) return;
      setSearchState(data);
    } catch (error) {
      if (request !== searchRequest.current) return;
      setSearchState({ mode: "sec_live", state: "unavailable", query: trimmed, funds: [], message: requestFailureMessage(error, text("investment.portfolio.text144")), fetchedAt: new Date().toISOString() });
    } finally {
      if (request === searchRequest.current) setSearching(false);
    }
  }

  function addFund(fund: PlanningFund) {
    cancelRestore();
    if (!fund.constructionBucket || selectedIds.current.has(fund.id)) return;
    selectedIds.current.add(fund.id);
    setSelectedFunds((current) => current.some((selected) => selected.fund.id === fund.id) ? current : [...current, { fund, weightPercent: 0, selectionSource: "customer" }]);
    void loadSelectedDetail(fund, null);
  }

  async function loadSelectedDetail(fund: PlanningFund, requestedClass: string | null) {
    cancelRestore();
    const request = (detailRequests.current.get(fund.id) ?? 0) + 1;
    detailRequests.current.set(fund.id, request);
    setSaveStatus(null);
    setSelectedDetails((current) => ({ ...current, [fund.id]: { state: "loading", detail: current[fund.id]?.detail ?? null, requestedClass } }));
    try {
      const params = withFundScope(new URLSearchParams({ proj_id: fund.projectId }), scope);
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
    cancelRestore();
    setSelectedFunds((current) => current.map((selected) => selected.fund.id === id ? { ...selected, weightPercent } : selected));
  }

  function removeFund(id: string) {
    cancelRestore();
    selectedIds.current.delete(id);
    detailRequests.current.set(id, (detailRequests.current.get(id) ?? 0) + 1);
    setSelectedFunds((current) => current.filter((selected) => selected.fund.id !== id));
    setSelectedDetails((current) => { const next = { ...current }; delete next[id]; return next; });
  }

  function ensurePlanId(): string {
    if (planId) return planId;
    const next = createPlanId("plan");
    setPlanId(next);
    return next;
  }

  function savePlan() {
    if (!result) return;
    const id = ensurePlanId();
    const original = createAdvisorHandoffPayload(id, result);
    const payload = { ...original, tool_scope: scope,
      selected_funds: original.selected_funds.map((fund, index) => ({ ...fund, restore_query: result.selectedFunds[index].fund.shortName })),
    };
    try {
      savePlanLocally(localStorage, "portfolio", scope, payload);
      setSaveStatus(text("investment.single.text008"));
    } catch {
      setSaveStatus(text("investment.single.text009"));
    }
  }

  async function restorePlan() {
    const request = ++searchRequest.current;
    setSearching(false);
    setRestoring(true);
    setRestoreStatus(null);
    try {
      const saved = readSavedPlan(localStorage, "portfolio", scope);
      if (!saved) { setRestoreStatus(text("investment.single.text010")); return; }
      const currentFunds: SelectedFund[] = [];
      let currentSearch: FundSearchResponse | null = null;
      const currentDetails: typeof selectedDetails = {};
      for (const choice of saved.funds) {
        if (request !== searchRequest.current) return;
        const query = withFundScope(new URLSearchParams({ q: choice.query }), scope);
        const search = await fetchRestoreData(`/api/investment-allocation/funds/?${query}`, () => request === searchRequest.current);
        if (!search.ok) throw new Error("restore_unavailable");
        const found = await search.json() as FundSearchResponse;
        currentSearch = found;
        const fund = found.funds.find(row => row.projectId === choice.projectId);
        if (!fund) throw new Error("restore_unavailable");
        const params = withFundScope(new URLSearchParams({ proj_id: choice.projectId }), scope);
        if (choice.className) params.set("class_name", choice.className);
        const response = await fetchRestoreData(`/api/investment-allocation/detail/?${params}`, () => request === searchRequest.current);
        if (!response.ok) throw new Error("restore_unavailable");
        const detail = await response.json() as FundDetailResponse;
        const fresh = planningFundFromDetail(fund, detail, choice.className);
        if (detail.classes.length && !choice.className) throw new Error("restore_unavailable");
        currentFunds.push({ fund: fresh, weightPercent: choice.weight, selectionSource: "customer" });
        currentDetails[fresh.id] = { state: "ready", detail, requestedClass: choice.className };
      }
      if (request !== searchRequest.current) return;
      for (const [id, generation] of detailRequests.current) detailRequests.current.set(id, generation + 1);
      selectedIds.current = new Set(currentFunds.map(row => row.fund.id));
      setSearchState(currentSearch);
      setSelectedFunds(currentFunds);
      setSelectedDetails(currentDetails);
      setHandoffText(null);
      setInvestmentAmount(String(saved.amount));
      setConstruction(saved.construction);
      setTarget(saved.target);
      setStep(1);
      setPlanId(null);
      setSaveStatus(null);
      setRestoreStatus(text("investment.single.text011"));
    } catch (error) {
      if (request === searchRequest.current) setRestoreStatus(text(error instanceof Error && ["saved_plan_too_large", "saved_plan_restore_limit"].includes(error.message) ? "investment.restore.limit" : "investment.single.text012"));
    } finally {
      if (request === searchRequest.current) setRestoring(false);
    }
  }

  async function handoffToLine() {
    if (!result) return;
    const id = ensurePlanId();
    const payload = createAdvisorHandoffPayload(id, result);
    const lines = [
      text("investment.portfolio.text145"),
      investmentValue(text("investment.single.text014"), [payload.plan_id]),
      investmentValue(text("investment.single.text015"), [formatMoney(payload.investment_amount)]),
      "",
      text("investment.portfolio.text146"),
      ...payload.selected_funds.map((fund) => `- ${fund.fund_name}: ${fund.selected_weight_percent}%`),
      ...payload.selected_funds.map((fund) => investmentValue(text("investment.portfolio.text147"), [fund.class_name ?? text("investment.single.text109"), fund.provenance?.source === "uat_synthetic" ? text("investment.portfolio.text235") : text("investment.single.text034"), fund.provenance?.sourceDate ?? text("investment.single.text109"), fund.provenance?.fetchedAt ?? text("investment.single.text109")])),
      "",
      text("investment.portfolio.text148"),
      ...payload.effective_allocation.filter((row) => row.percent > 0).map((row) => `- ${label(EFFECTIVE_LABELS[row.key])}: ${row.percent}%`),
      "",
      text("investment.portfolio.text149"),
      ...payload.risk_distribution.filter((row) => row.percent > 0).map((row) => investmentValue(text("investment.portfolio.text150"), [row.level === "unknown" ? text("investment.portfolio.text185") : `ระดับ ${row.level}`, row.percent])),
      "",
      text("investment.portfolio.text151"),
      ...payload.liquidity_summary.filter((row) => row.percent > 0).map((row) => `- ${row.bucket}: ${row.percent}%`),
      "",
      text("investment.portfolio.text152"),
    ];
    const summary = lines.join("\n");
    setHandoffText(summary);
    try { window.open("https://lin.ee/tqLCs4f", "_blank", "noopener,noreferrer"); } catch { /* The manual LINE link remains available. */ }
    try {
      await navigator.clipboard.writeText(summary);
      setSaveStatus(text("investment.handoff.copied"));
    } catch {
      setSaveStatus(text("investment.handoff.manual"));
    }
  }

  return (
    <section id="investment-allocation-builder" className={styles.shell} aria-label={text("investment.portfolio.text154")}>
      <div className={styles.grid}>
        <div className={styles.builder}>
          <div className={styles.stepHeader}>
            <div>
              <h2>{label(currentCopy.title)}</h2>
              <p>{label(currentCopy.body)}</p>
            </div>
            <span className={styles.stepPill}>{text.node("investment.portfolio.text155")}{step}/4</span>
          </div>

          <div className={styles.resultActions}>
            <button className={styles.secondary} type="button" disabled={restoring} onClick={() => void restorePlan()}>{restoring ? text("investment.single.text035") : text("investment.single.text036")}</button>
          </div>
          {restoreStatus ? <p className={styles.saveStatus} role="status">{restoreStatus}</p> : null}
          {step === 1 ? (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="investment-amount">{text.node("investment.portfolio.text156")}</label>
                <div className={styles.moneyInputWrap}>
                  <input id="investment-amount" disabled={restoring} inputMode="decimal" type="number" min="0" step="1000" value={investmentAmount} onChange={(event) => { cancelRestore(); setInvestmentAmount(event.target.value); }} placeholder={text("investment.single.text038")} />
                  <span>{text.node("investment.single.text039")}</span>
                </div>
                <p className={styles.fieldHint}>{text.node("investment.portfolio.text157")}</p>
              </div>

              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>{text.node("investment.portfolio.text158")}</span>
                <div className={styles.allocationList}>
                  {construction.map((row) => (
                    <div className={styles.allocationRow} key={row.key}>
                      <div className={styles.allocationName}><strong>{label(CONSTRUCTION_LABELS[row.key])}</strong><small>{text.node("investment.portfolio.text159")}</small></div>
                      <div className={styles.allocationControls}>
                        <label className={styles.percentWrap}><span>%</span><input className={styles.percentInput} aria-label={investmentValue(text("investment.portfolio.text160"), [CONSTRUCTION_LABELS[row.key]])} type="number" min="0" max="100" step="0.01" value={row.percent ? Math.round(row.percent * 100) / 100 : ""} onChange={(event) => updateConstruction(row.key, clampPercentInput(event.target.value))} /></label>
                        <label className={styles.amountWrap}><span>{text.node("investment.single.text039")}</span><input className={styles.amountInput} aria-label={investmentValue(text("investment.portfolio.text161"), [CONSTRUCTION_LABELS[row.key]])} inputMode="decimal" type="number" min="0" max={amount || undefined} step="1000" disabled={amount <= 0} value={amount > 0 && row.percent ? Math.round((amount * row.percent) / 100 * 100) / 100 : ""} onChange={(event) => updateConstructionAmount(row.key, event.target.value)} /></label>
                      </div>
                    </div>
                  ))}
                </div>
                <AllocationTotal total={constructionTotal} label={text("investment.portfolio.text162")} />
              </div>

              <div className={styles.actions}><span /><button className={styles.primary} type="button" disabled={!constructionValid} onClick={() => navigate(2)}>{text.node("investment.portfolio.text163")}</button></div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <form className={styles.searchRow} onSubmit={searchFunds}>
                <input className={styles.searchInput} aria-label={text("investment.single.text051")} value={query} onChange={(event) => { cancelRestore(); setQuery(event.target.value); }} placeholder={text("investment.single.text052")} />
                <button className={styles.smallButton} type="submit" disabled={searching}>{searching ? text("investment.portfolio.text164") : text("investment.single.text053")}</button>
              </form>
              <div className={styles.statusNotice}><strong>{text.node("investment.portfolio.text165")}</strong>{text.node("investment.portfolio.text166")}</div>

              {searchState?.message ? <div className={styles.statusNotice} role="status">{searchState.message}</div> : null}
              {searchState?.funds.length ? (
                <div className={styles.searchResults} aria-label={text("investment.portfolio.text167")}>
                  {searchState.funds.map((fund) => {
                    const alreadySelected = selectedFunds.some((selected) => selected.fund.id === fund.id);
                    const selectable = Boolean(fund.constructionBucket);
                    return <article className={styles.fundCard} key={fund.id}>
                      <div className={styles.fundTop}><div className={styles.fundTitle}><strong>{fund.name}</strong><small>{fund.shortName}{fund.className ? ` · ${fund.className}` : ""}</small></div><span className={styles.sourceBadge}>{fund.provenance.source === "uat_synthetic" ? text("investment.portfolio.text168") : text("investment.single.text034")}</span></div>
                      <div className={styles.fundFacts}><span>{text.node("investment.portfolio.text169")}{fund.riskSpectrum ?? "—"}</span><span>{fund.constructionBucket ? CONSTRUCTION_LABELS[fund.constructionBucket] : text("investment.portfolio.text170")}</span><span>{fund.liquidity.rawText ?? text("investment.portfolio.text171")}</span></div>
                      {!selectable ? <p className={styles.liveFundWarning}>{text.node("investment.portfolio.text172")}</p> : null}
                      <button type="button" data-primary={selectable && !alreadySelected} disabled={!selectable || alreadySelected} onClick={() => addFund(fund)}>{alreadySelected ? text("investment.portfolio.text173") : selectable ? text("investment.single.text060") : text("investment.portfolio.text174")}</button>
                    </article>;
                  })}
                </div>
              ) : null}

              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>{text.node("investment.portfolio.text175")}</span>
                {selectedFunds.length === 0 ? <div className={styles.statusNotice}>{text.node("investment.portfolio.text176")}</div> : (
                  <div className={styles.selectedList}>
                    {selectedFunds.map((selected) => <article className={styles.fundCard} key={selected.fund.id}>
                      <div className={styles.fundTop}><div className={styles.fundTitle}><strong>{selected.fund.name}</strong><small>{selected.fund.constructionBucket ? CONSTRUCTION_LABELS[selected.fund.constructionBucket] : text("investment.portfolio.text177")}</small></div><span className={styles.sourceBadge}>{text.node("investment.portfolio.text178")}</span></div>
                      {selectedDetails[selected.fund.id]?.state === "loading" ? (
                        <p className={styles.provenance} role="status">{text.node("investment.portfolio.text179")}</p>
                      ) : null}
                      {selectedDetails[selected.fund.id]?.state === "unavailable" ? (
                        <div className={styles.statusNotice} role="status">
                          {text.node("investment.portfolio.text180")}<button className={styles.smallButton} type="button" onClick={() => void loadSelectedDetail(selected.fund, selectedDetails[selected.fund.id].requestedClass)}>{text.node("investment.portfolio.text181")}</button>
                        </div>
                      ) : null}
                      {selectedDetails[selected.fund.id]?.detail?.classes.length ? (
                        <label className={styles.fieldGroup}>
                          <span className={styles.fieldLabel}>{text.node("investment.portfolio.text182")}</span>
                          <select
                            className={styles.amcSelect}
                            aria-label={investmentValue(text("investment.portfolio.text183"), [selected.fund.name])}
                            value={selectedDetails[selected.fund.id].requestedClass ?? ""}
                            disabled={selectedDetails[selected.fund.id].state === "loading"}
                            onChange={(event) => void loadSelectedDetail(selected.fund, event.target.value || null)}
                          >
                            <option value="">{text.node("investment.portfolio.text184")}</option>
                            {[...new Map(selectedDetails[selected.fund.id].detail!.classes.map(row => [row.name, row])).values()].map(row => (
                              <option key={row.name} value={row.name}>{row.name}{row.description ? ` · ${row.description}` : ""}</option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {selectedDetails[selected.fund.id]?.state === "ready" ? (
                        <>
                          <div className={styles.fundFacts}>
                            <span>{text.node("investment.portfolio.text169")}{selected.fund.riskSpectrum ?? text("investment.portfolio.text185")}</span>
                            <span>{selected.fund.liquidity.rawText ?? text("investment.portfolio.text186")}</span>
                          </div>
                          <details>
                            <summary className={styles.smallButton}>{text.node("investment.portfolio.text187")}</summary>
                            <ul className={styles.warningList}>
                              {selectedDetails[selected.fund.id].detail!.assetAllocation.map((row, index) => (
                                <li key={index}>{row.name}: {row.percentNav}{text.node("investment.portfolio.text188")}{row.sourceDate ?? text("investment.single.text109")}</li>
                              ))}
                            </ul>
                            {selected.fund.provenance.notes.map((note, index) => <p className={styles.provenance} key={index}>{note}</p>)}
                          </details>
                        </>
                      ) : null}
                      <div className={styles.selectedControl}>
                        <label><span>{text.node("investment.portfolio.text189")}</span><div className={styles.percentWrap}><span>%</span><input className={styles.percentInput} type="number" min="0" max="100" step="1" aria-label={investmentValue(text("investment.portfolio.text190"), [selected.fund.name])} value={selected.weightPercent || ""} onChange={(event) => updateSelectedWeight(selected.fund.id, clampPercentInput(event.target.value))} /></div></label>
                        <button type="button" onClick={() => removeFund(selected.fund.id)}>{text.node("investment.portfolio.text191")}</button>
                      </div>
                    </article>)}
                  </div>
                )}
                <AllocationTotal total={selectedTotal} label={text("investment.portfolio.text192")} errorMessage={selectedTotal === 100 && !constructionCoverageMatches(construction, selectedFunds) ? text("investment.portfolio.text193") : undefined} />
              </div>

              <div className={styles.actions}><button className={styles.ghost} type="button" onClick={() => navigate(1)}>{text.node("investment.portfolio.text194")}</button><button className={styles.primary} type="button" disabled={!selectedValid} onClick={() => navigate(3)}>{text.node("investment.portfolio.text195")}</button></div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className={styles.optionalBox}>
                <h3>{text.node("investment.portfolio.text196")}</h3>
                <p>{text.node("investment.portfolio.text197")}</p>
              </div>
              <div className={styles.allocationList}>
                {target.map((row) => (
                  <div className={styles.allocationRow} key={row.key}>
                    <div className={styles.allocationName}><strong>{label(ASSET_LABELS[row.key])}</strong><small>{text.node("investment.portfolio.text198")}</small></div>
                    <label className={styles.percentWrap}><span>%</span><input className={styles.percentInput} aria-label={investmentValue(text("investment.portfolio.text199"), [ASSET_LABELS[row.key]])} type="number" min="0" max="100" step="1" value={row.percent || ""} onChange={(event) => updateTarget(row.key, clampPercentInput(event.target.value))} /></label>
                  </div>
                ))}
              </div>
              <AllocationTotal total={targetTotal} label={text("investment.portfolio.text200")} allowZero />
              <div className={styles.actions}><button className={styles.ghost} type="button" onClick={() => navigate(2)}>{text.node("investment.portfolio.text194")}</button><button className={styles.primary} type="button" disabled={!targetValid} onClick={() => navigate(4)}>{text.node("investment.portfolio.text201")}</button></div>
            </>
          ) : null}

          {step === 4 ? (
            result ? <ResultView result={result} onEdit={() => navigate(1)} onSave={savePlan} onHandoff={handoffToLine} saveStatus={saveStatus} handoffText={handoffText} /> : <div className={styles.statusNotice}>{text.node("investment.portfolio.text202")}</div>
          ) : null}
        </div>

        <aside className={`${styles.summary} ${styles.summarySticky}`} aria-label={text("investment.portfolio.text203")}>
          <h2>{text.node("investment.portfolio.text204")}</h2>
          <p className={styles.summaryIntro}>{text.node("investment.portfolio.text205")}</p>
          <div className={styles.summaryAmount}><span>{text.node("investment.single.text068")}</span><strong>{amount > 0 ? investmentValue(text("investment.single.text069"), [formatMoney(amount)]) : "—"}</strong></div>
          <dl className={styles.summaryRows}>
            <div className={styles.summaryRow}><dt>{text.node("investment.single.text070")}</dt><dd>{constructionTotal}% / 100%</dd></div>
            <div className={styles.summaryRow}><dt>{text.node("investment.single.text075")}</dt><dd>{selectedFunds.length}{text.node("investment.portfolio.text206")}{selectedTotal}%</dd></div>
            <div className={styles.summaryRow}><dt>{text.node("investment.portfolio.text207")}</dt><dd>{targetTotal === 0 ? text("investment.portfolio.text208") : `${targetTotal}%`}</dd></div>
            <div className={styles.summaryRow}><dt>{text.node("investment.portfolio.text209")}</dt><dd>{searchState?.mode === "sec_live" ? text("investment.portfolio.text210") : searchState ? text("investment.portfolio.text168") : text("investment.portfolio.text211")}</dd></div>
          </dl>
          <div className={styles.statusNotice}>{text.node("investment.portfolio.text212")}</div>
        </aside>
      </div>
    </section>
  );
}

function AllocationTotal({ total, label, allowZero = false, errorMessage }: { total: number; label: string; allowZero?: boolean; errorMessage?: string }) {
  const text = usePublicCopy(INVESTMENT_COPY_DEFAULTS);
  const valid = total === 100 || (allowZero && total === 0);
  const width = Math.min(100, Math.max(0, total));
  const message = errorMessage ?? (valid ? (total === 0 ? text("investment.portfolio.text213") : text("investment.portfolio.text214")) : total < 100 ? investmentValue(text("investment.portfolio.text215"), [Math.round((100 - total) * 100) / 100]) : investmentValue(text("investment.portfolio.text216"), [Math.round((total - 100) * 100) / 100]));
  return <div className={styles.totalBox} data-valid={valid}><div className={styles.totalLine}><span>{label}</span><strong>{total}%</strong></div><div className={styles.progressTrack} aria-hidden="true"><div className={styles.progressFill} style={{ transform: `translateX(${width - 100}%)` }} /></div><p className={styles.validation} data-error={!valid || Boolean(errorMessage)} aria-live="polite">{message}</p></div>;
}

function ResultView({ result, onEdit, onSave, onHandoff, saveStatus, handoffText }: { result: InvestmentPlanResult; onEdit: () => void; onSave: () => void; onHandoff: () => void; saveStatus: string | null; handoffText: string | null }) {
  const text = usePublicCopy(INVESTMENT_COPY_DEFAULTS);
  const label = (value: string) => investmentLabel(value, text);
  const unknownRisk = result.riskDistribution.find((row) => row.level === "unknown")?.percent ?? 0;
  return <div className={styles.resultStack}>
    <p className={styles.riskStatement} role="note">{label(INVESTMENT_RISK_STATEMENT)}</p>
    <div className={styles.resultPanel}>
      <h3>{text.node("investment.portfolio.text217")}</h3>
      <p>{text.node("investment.portfolio.text218")}{result.coverage.effectiveAssetPercentKnown}{text.node("investment.portfolio.text219")}</p>
      <div className={styles.barList}>{result.effectiveAllocation.filter((row) => row.percent > 0).map((row) => <div className={styles.barRow} key={row.key}><span className={styles.barLabel}>{label(EFFECTIVE_LABELS[row.key])}</span><div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${Math.min(100, row.percent)}%` }} /></div><span className={styles.barValue}>{row.percent}%</span></div>)}</div>
    </div>

    <div className={styles.resultPanel}>
      <h3>{text.node("investment.portfolio.text220")}</h3>
      {result.targetDelta.length ? <div className={styles.deltaList}>{result.targetDelta.map((row) => <div className={styles.deltaRow} key={row.asset}><strong>{label(ASSET_LABELS[row.asset])}{text.node("investment.portfolio.text221")}{row.targetPercent}{text.node("investment.portfolio.text222")}{row.effectivePercent}%</strong><span>{row.conclusive && row.deltaPercentagePoints !== null ? investmentValue(text("investment.portfolio.text223"), [row.deltaPercentagePoints > 0 ? "+" : "", row.deltaPercentagePoints]) : text("investment.portfolio.text224")}</span></div>)}</div> : <p>{text.node("investment.portfolio.text225")}</p>}
    </div>

    <div className={styles.resultPanel}>
      <h3>{text.node("investment.portfolio.text226")}</h3>
      <p>{text.node("investment.portfolio.text227")}</p>
      <div className={styles.riskRail}>{result.riskDistribution.filter((row) => row.level !== "unknown").map((row) => <div className={styles.riskCell} data-has-value={row.percent > 0} key={String(row.level)}><strong>{row.level}</strong><span>{row.percent}%</span></div>)}</div>
      {unknownRisk > 0 ? <p className={styles.unknownLine}>{text.node("investment.portfolio.text228")}{unknownRisk}{text.node("investment.portfolio.text229")}</p> : null}
    </div>

    <div className={styles.resultPanel}>
      <h3>{text.node("investment.portfolio.text230")}</h3>
      <p>{text.node("investment.portfolio.text231")}</p>
      <div className={styles.liquidityGrid}>{result.liquiditySummary.map((row) => <div className={styles.liquidityCard} key={row.bucket}><strong>{row.bucket}</strong><span>{row.percent}% · {formatMoney(row.amount)}{text.node("investment.portfolio.text232")}</span></div>)}</div>
    </div>

    <div className={styles.resultPanel}><h3>{text.node("investment.portfolio.text233")}</h3><ul className={styles.warningList}>{result.selectedFunds.map(({ fund }) => <li key={fund.id}>{fund.name}{text.node("investment.portfolio.text234")}{fund.className ?? text("investment.single.text109")} · {fund.provenance.source === "uat_synthetic" ? text("investment.portfolio.text235") : text("investment.single.text034")}{text.node("investment.portfolio.text236")}{fund.provenance.sourceDate ?? text("investment.single.text109")}{text.node("investment.portfolio.text237")}{fund.provenance.fetchedAt}</li>)}</ul><p>{text.node("investment.portfolio.text238")}</p></div>
    <div className={styles.resultPanel}><h3>{text.node("investment.portfolio.text239")}</h3><ul className={styles.warningList}>{result.warnings.map((warning) => <li key={warning}>{label(WARNING_LABELS[warning])}</li>)}</ul></div>

    <div className={styles.resultPanel}><h3>{text.node("investment.single.text114")}</h3><p>{text.node("investment.portfolio.text240")}</p><div className={styles.resultActions}><button className={styles.ghost} type="button" onClick={onEdit}>{text.node("investment.portfolio.text241")}</button><button className={styles.secondary} type="button" onClick={onSave}>{text.node("investment.single.text116")}</button><button className={styles.primary} type="button" onClick={onHandoff}>{text.node("investment.single.text117")}</button></div>{saveStatus ? <p className={styles.saveStatus} role="status">{saveStatus}</p> : null}{handoffText ? <details className={styles.handoffFallback}><summary>{text.node("investment.handoff.manualTitle")}</summary><label>{text.node("investment.handoff.summaryLabel")}<textarea readOnly rows={8} value={handoffText} onFocus={event => event.currentTarget.select()} /></label><a href="https://lin.ee/tqLCs4f" target="_blank" rel="noopener noreferrer">{text.node("investment.handoff.openLine")}</a></details> : null}</div>
  </div>;
}
