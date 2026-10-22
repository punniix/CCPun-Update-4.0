'use client';
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { INVESTMENT_COPY_DEFAULTS, investmentLabel } from "@/lib/content/investment-copy-defaults";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  equitySubcategoryLabel,
  FUND_CATEGORY_DESCRIPTIONS,
  FUND_CATEGORY_LABELS,
  FUND_SUBCATEGORY_LABELS,
  geographyLabel,
  subcategoryOptions,
} from "./domain/catalog";
import type {
  FundAmcResponse,
  FundCatalogCategory,
  FundCatalogItem,
  FundCatalogResponse,
  FundCatalogSubcategory,
  FundDetailResponse,
} from "./domain/types";
import styles from "./InvestmentAllocation.module.css";

const CATEGORIES: FundCatalogCategory[] = ["equity", "mixed", "fixed_income", "alternative", "other"];

function formatMoney(value: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
}



function subcategoryLabel(category: FundCatalogCategory | "all", subcategory: FundCatalogSubcategory): string {
  if (category === "equity") return equitySubcategoryLabel(subcategory);
  return FUND_SUBCATEGORY_LABELS[subcategory];
}

function rawAllocationTotal(detail: FundDetailResponse | null): number {
  if (!detail) return 0;
  return Math.round(detail.assetAllocation.reduce((sum, row) => sum + row.percentNav, 0) * 100) / 100;
}

export default function SingleFundBuilder() {
  const copyText = usePublicCopy(INVESTMENT_COPY_DEFAULTS);


  const [investmentAmount, setInvestmentAmount] = useState("");
  const [category, setCategory] = useState<FundCatalogCategory | "all" | null>(null);
  const [subcategory, setSubcategory] = useState<FundCatalogSubcategory>("all");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [amcs, setAmcs] = useState<FundAmcResponse | null>(null);
  const [amcsLoading, setAmcsLoading] = useState(false);
  const [amcId, setAmcId] = useState("all");
  const [catalog, setCatalog] = useState<FundCatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogAppending, setCatalogAppending] = useState(false);
  const [selectedFund, setSelectedFund] = useState<FundCatalogItem | null>(null);
  const [detail, setDetail] = useState<FundDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const startedRef = useRef(false);
  const catalogRequest = useRef(0);
  const detailRequest = useRef(0);

  useEffect(() => () => { catalogRequest.current++; detailRequest.current++; }, []);

  const parsedAmount = Number(investmentAmount.replace(/,/g, ""));
  const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const options = useMemo(() => category ? subcategoryOptions(category) : ["all"] as FundCatalogSubcategory[], [category]);
  const allocationTotal = rawAllocationTotal(detail);
  const selectedAmcName = amcId === "all" ? copyText("investment.selectedAmcNameText") : amcs?.items.find((item) => item.id === amcId)?.nameTh ?? copyText("investment.selectedAmcNameText2");
  const amcStep = options.length > 1 ? 3 : 2;
  const fundStep = options.length > 1 ? 4 : 3;

  async function loadAmcs() {
    if (amcs || amcsLoading) return;
    setAmcsLoading(true);
    try {
      const response = await fetch("/api/investment-allocation/amcs/", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`amcs_${response.status}`);
      setAmcs(await response.json() as FundAmcResponse);
    } catch {
      setAmcs({ source: "unavailable", state: "unavailable", items: [], fetchedAt: new Date().toISOString(), message: copyText("investment.loadAmcsText") });
    } finally {
      setAmcsLoading(false);
    }
  }

  async function loadCatalog(filters: {
    category: FundCatalogCategory | "all";
    subcategory: FundCatalogSubcategory;
    query: string;
    amcId: string;
    cursor?: string | null;
    append?: boolean;
  }) {
    const request = ++catalogRequest.current;
    const append = Boolean(filters.append);
    if (!append) {
      detailRequest.current++;
      setSelectedFund(null);
      setDetail(null);
      setDetailLoading(false);
      setSaveStatus(null);
      setPlanId(null);
    }
    setCatalogAppending(append);
    if (append) setCatalogAppending(true);
    else {
      setCatalogLoading(true);
      setCatalog(null);
    }
    try {
      const params = new URLSearchParams({ category: filters.category, subcategory: filters.subcategory, limit: "20" });
      if (filters.query) params.set("q", filters.query);
      if (filters.amcId !== "all") params.set("amc", filters.amcId);
      if (filters.cursor) params.set("cursor", filters.cursor);
      const response = await fetch(`/api/investment-allocation/catalog/?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`catalog_${response.status}`);
      const data = await response.json() as FundCatalogResponse;
      if (request !== catalogRequest.current) return;
      setCatalog((current) => append && current ? { ...data, items: [...current.items, ...data.items] } : data);
    } catch {
      if (request !== catalogRequest.current) return;
      setCatalog({ source: "unavailable", state: "unavailable", items: [], nextCursor: null, hasMore: false, query: filters.query, category: filters.category, subcategory: filters.subcategory, amcId: filters.amcId === "all" ? null : filters.amcId, fetchedAt: new Date().toISOString(), message: copyText("investment.loadCatalogText") });
    } finally {
      if (request === catalogRequest.current) {
        setCatalogLoading(false);
        setCatalogAppending(false);
      }
    }
  }

  function chooseCategory(next: FundCatalogCategory | "all") {
    if (!startedRef.current) {
      startedRef.current = true;
      trackEvent("ia_tool_start", { tool_name: "investment_allocation", cta_location: "investment_allocation_builder", surface_group: "investment_allocation" });
    }
    setCategory(next);
    setSubcategory("all");
    setAmcId("all");
    setSelectedFund(null);
    setDetail(null);
    setSaveStatus(null);
    void loadAmcs();
    void loadCatalog({ category: next, subcategory: "all", query, amcId: "all" });
    trackEvent("ia_step_view", { tool_name: "investment_allocation", step_number: 1, cta_location: "investment_allocation_builder", surface_group: "investment_allocation" });
  }

  function chooseSubcategory(next: FundCatalogSubcategory) {
    if (!category) return;
    setSubcategory(next);
    setSelectedFund(null);
    setDetail(null);
    setSaveStatus(null);
    void loadCatalog({ category, subcategory: next, query, amcId });
  }

  function chooseAmc(next: string) {
    if (!category) return;
    setAmcId(next);
    setSelectedFund(null);
    setDetail(null);
    setSaveStatus(null);
    void loadCatalog({ category, subcategory, query, amcId: next });
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (!category) return;
    const nextQuery = queryInput.trim();
    setQuery(nextQuery);
    setSelectedFund(null);
    setDetail(null);
    void loadCatalog({ category, subcategory, query: nextQuery, amcId });
  }

  async function fetchDetail(fund: FundCatalogItem, className?: string | null) {
    const request = ++detailRequest.current;
    setSelectedFund(fund);
    setDetail(null);
    setDetailLoading(true);
    setSaveStatus(null);
    setPlanId(null);
    try {
      const params = new URLSearchParams({ proj_id: fund.projectId });
      if (className) params.set("class_name", className);
      const response = await fetch(`/api/investment-allocation/detail/?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`detail_${response.status}`);
      const data = await response.json() as FundDetailResponse;
      if (request !== detailRequest.current) return;
      setDetail(data);
      trackEvent("ia_result_view", { tool_name: "investment_allocation", cta_location: "investment_allocation_result", surface_group: "investment_allocation" });
      window.setTimeout(() => {
        if (request === detailRequest.current) document.getElementById("single-fund-result")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      }, 0);
    } catch {
      if (request !== detailRequest.current) return;
      setDetail({ source: "unavailable", state: "unavailable", fund, classes: [], selectedClassName: null, specifications: [], risk: null, assetAllocation: [], dealing: null, dataDate: null, fetchedAt: new Date().toISOString(), warnings: [copyText("investment.fetchDetailText")], endpointStates: {} });
    } finally {
      if (request === detailRequest.current) setDetailLoading(false);
    }
  }

  function ensurePlanId(): string {
    if (planId) return planId;
    const next = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `single-${Date.now()}`;
    setPlanId(next);
    return next;
  }

  function buildHandoff() {
    if (!selectedFund || !detail || detail.fund?.projectId !== selectedFund.projectId || detail.state === "unavailable" || amount <= 0 || (detail.classes.length > 0 && !detail.selectedClassName)) return null;
    return {
      schema_version: 1,
      journey_mode: "single_fund" as const,
      plan_id: ensurePlanId(),
      investment_amount: amount,
      selection_source: "customer" as const,
      selected_fund: {
        project_id: selectedFund.projectId,
        fund_name: selectedFund.nameTh,
        abbreviation: selectedFund.abbreviation,
        class_name: detail.selectedClassName,
      },
      risk_spectrum: detail.risk?.rawCode ?? null,
      asset_allocation: detail.assetAllocation,
      dealing: detail.dealing,
      sec_data_date: detail.dataDate,
      provenance: { source: detail.source, state: detail.state, fetched_at: detail.fetchedAt, endpoint_states: detail.endpointStates, snapshot_ids: detail.snapshotIds ?? [], warnings: detail.warnings },
      created_at: new Date().toISOString(),
    };
  }

  function saveLocal() {
    const payload = buildHandoff();
    if (!payload) return;
    try {
      localStorage.setItem("ccpun_investment_single_fund_plan_v1", JSON.stringify(payload));
      setSaveStatus(copyText("investment.savePlanText"));
      trackEvent("ia_save_local", { tool_name: "investment_allocation", cta_location: "investment_allocation_result", surface_group: "investment_allocation" });
    } catch {
      setSaveStatus(copyText("investment.savePlanText2"));
    }
  }

  async function handoffToLine() {
    const payload = buildHandoff();
    if (!payload || !selectedFund || !detail) return;
    const allocationLines = detail.assetAllocation.map((row) => `- ${row.name}: ${row.percentNav}%`);
    const lines = [
      copyText("investment.linesText11"),
      copyText("investment.dynamic1").replaceAll("{0}", String(payload.plan_id)),
      copyText("investment.dynamic2").replaceAll("{0}", String(formatMoney(payload.investment_amount))),
      copyText("investment.dynamic3").replaceAll("{0}", String(selectedFund.nameTh)).replaceAll("{1}", String(selectedFund.abbreviation)),
      detail.selectedClassName ? copyText("investment.dynamic4").replaceAll("{0}", String(detail.selectedClassName)) : "",
      detail.risk?.level ? copyText("investment.dynamic5").replaceAll("{0}", String(detail.risk.level)) : copyText("investment.linesText12"),
      "",
      detail.source === "uat_synthetic" ? copyText("investment.linesText13") : copyText("investment.linesText14"),
      ...allocationLines,
      "",
      detail.dealing?.settlementPeriod ? copyText("investment.dynamic6").replaceAll("{0}", String(detail.dealing.settlementPeriod)) : copyText("investment.linesText15"),
      detail.dataDate ? copyText("investment.dynamic7").replaceAll("{0}", String(detail.dataDate)) : "",
      copyText("investment.dynamic8").replaceAll("{0}", String(detail.fetchedAt)),
      ...detail.warnings.map((warning) => copyText("investment.dynamic9").replaceAll("{0}", String(warning))),
      "",
      copyText("investment.linesText16"),
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setSaveStatus(copyText("investment.handoffToLineText"));
    } catch {
      setSaveStatus(copyText("investment.handoffToLineText3"));
    }
    trackEvent("ia_contact_click", { tool_name: "investment_allocation", contact_channel: "line", cta_location: "investment_allocation_result", surface_group: "investment_allocation" });
    window.open("https://lin.ee/tqLCs4f", "_blank", "noopener,noreferrer");
  }

  return (
    <section id="investment-allocation-builder" className={styles.shell} aria-label={copyText("investment.singleFundBuilderarialabel")}>
      <div className={styles.singleLayout}>
        <div className={styles.builder}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.eyebrow}>{copyText("investment.eyebrow3")}</p>
              <h2>{copyText("investment.h23")}</h2>
              <p>{copyText("investment.p9")}</p>
            </div>
            <span className={styles.stepPill}>{copyText("investment.linesText5")}</span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="single-investment-amount">{copyText("investment.fieldLabel5")}</label>
            <div className={styles.moneyInputWrap}>
              <input id="single-investment-amount" inputMode="decimal" type="number" min="0" step="1000" value={investmentAmount} onChange={(event) => { setInvestmentAmount(event.target.value); setSaveStatus(null); setPlanId(null); }} placeholder={copyText("investment.portfolioBuilderplaceholder")} />
              <span>{copyText("investment.span3")}</span>
            </div>
            <p className={styles.fieldHint}>{copyText("investment.fieldHint2")}</p>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>{copyText("investment.fieldLabel6")}</span>
            <div className={styles.categoryGrid}>
              {CATEGORIES.map((item) => (
                <button key={item} className={styles.categoryCard} data-active={category === item} aria-pressed={category === item} type="button" onClick={() => chooseCategory(item)}>
                  <strong>{investmentLabel(FUND_CATEGORY_LABELS[item], copyText)}</strong>
                  <span>{investmentLabel(FUND_CATEGORY_DESCRIPTIONS[item], copyText)}</span>
                </button>
              ))}
              <button className={styles.categoryCard} data-active={category === "all"} aria-pressed={category === "all"} type="button" onClick={() => chooseCategory("all")}>
                <strong>{copyText("investment.strong6")}</strong>
                <span>{copyText("investment.span7")}</span>
              </button>
            </div>
          </div>

          {category ? (
            <>
              {options.length > 1 ? (
                <div className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>{copyText("investment.fieldLabel7")}</span>
                  <div className={styles.filterChips} role="group" aria-label={copyText("investment.singleFundBuilderarialabel2")}>
                    {options.map((option) => (
                      <button key={option} className={styles.filterChip} data-active={subcategory === option} aria-pressed={subcategory === option} type="button" onClick={() => chooseSubcategory(option)}>
                        {investmentLabel(subcategoryLabel(category, option), copyText)}
                      </button>
                    ))}
                  </div>
                  <p className={styles.fieldHint}>{copyText("investment.fieldHint3")}</p>
                </div>
              ) : null}

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="fund-amc-filter">{amcStep}{copyText("investment.fieldLabel8")}</label>
                <select id="fund-amc-filter" className={styles.amcSelect} value={amcId} disabled={amcsLoading} onChange={(event) => chooseAmc(event.target.value)}>
                  <option value="all">{copyText("investment.selectedAmcNameText")}</option>
                  {amcs?.items.map((item) => <option value={item.id} key={item.id}>{item.nameTh}</option>)}
                </select>
                <p className={styles.fieldHint}>{amcsLoading ? copyText("investment.singleFundBuilderText") : copyText("investment.singleFundBuilderText2")}</p>
                {amcs?.state === "unavailable" && amcs.message ? <div className={styles.statusNotice} role="status">{amcs.message}</div> : null}
              </div>

              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>{fundStep}{copyText("investment.fieldLabel9")}</span>
                <form className={styles.searchRow} onSubmit={submitSearch}>
                  <input className={styles.searchInput} aria-label={copyText("investment.portfolioBuilderarialabel2")} value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder={copyText("investment.portfolioBuilderplaceholder2")} />
                  <button className={styles.smallButton} type="submit">{copyText("investment.portfolioBuilderText2")}</button>
                </form>
                {query ? <button className={styles.clearSearch} type="button" onClick={() => { setQueryInput(""); setQuery(""); if (category) void loadCatalog({ category, subcategory, query: "", amcId }); }}>{copyText("investment.clearSearch")}{query}”</button> : null}
                <div className={styles.catalogMeta}>
                  <span>{catalog?.source === "sec_v2" ? copyText("investment.dynamic10").replaceAll("{0}", String(selectedAmcName)) : catalog?.source === "uat_synthetic" ? copyText("investment.singleFundBuilderText3") : ""}</span>
                  {catalog?.fetchedAt ? <span>{copyText("investment.span8")}{formatDate(catalog.fetchedAt, copyText)}</span> : null}
                </div>

                {catalogLoading ? <CatalogSkeleton /> : null}
                {!catalogLoading && catalog?.message ? <div className={styles.statusNotice} role="status">{catalog.message}</div> : null}
                {!catalogLoading && catalog?.items.length ? (
                  <div className={styles.catalogList}>
                    {catalog.items.map((fund) => (
                      <article className={styles.catalogCard} key={fund.projectId}>
                        <div className={styles.catalogMain}>
                          <h3>{fund.nameTh}</h3>
                          <p className={styles.catalogAbbr}>{fund.abbreviation}</p>
                          <p className={styles.catalogAmc}>{fund.amcNameTh}</p>
                          <div className={styles.fundFacts}>
                            <span>{investmentLabel(FUND_CATEGORY_LABELS[fund.category], copyText)}</span>
                            <span>{investmentLabel(geographyLabel(fund.investCountryFlag, fund.category), copyText)}</span>
                            {fund.masterFund ? <span>{copyText("investment.span9")}</span> : null}
                          </div>
                        </div>
                        <button className={styles.catalogChoose} type="button" onClick={() => void fetchDetail(fund)}>{copyText("investment.portfolioBuilderText7")}</button>
                      </article>
                    ))}
                  </div>
                ) : null}
                {!catalogLoading && catalog?.hasMore && catalog.nextCursor ? (
                  <button className={styles.loadMore} type="button" disabled={catalogAppending} onClick={() => category && void loadCatalog({ category, subcategory, query, amcId, cursor: catalog.nextCursor, append: true })}>{catalogAppending ? copyText("investment.singleFundBuilderText4") : copyText("investment.singleFundBuilderText5")}</button>
                ) : null}
              </div>
            </>
          ) : <div className={styles.statusNotice}>{copyText("investment.statusNotice6")}</div>}
        </div>

        <aside className={`${styles.summary} ${styles.summarySticky}`} aria-label={copyText("investment.singleFundBuilderarialabel3")}>
          <p className={styles.eyebrow}>{copyText("investment.eyebrow4")}</p>
          <h2>{copyText("investment.h24")}</h2>
          <p className={styles.summaryIntro}>{copyText("investment.summaryIntro2")}</p>
          <div className={styles.summaryAmount}><span>{copyText("investment.span6")}</span><strong>{amount > 0 ? copyText("investment.dynamic11").replaceAll("{0}", String(formatMoney(amount))) : "—"}</strong></div>
          <dl className={styles.summaryRows}>
            <div className={styles.summaryRow}><dt>{copyText("investment.dt")}</dt><dd>{category ? category === "all" ? copyText("investment.singleFundBuilderText6") : investmentLabel(FUND_CATEGORY_LABELS[category], copyText) : copyText("investment.singleFundBuilderText7")}</dd></div>
            <div className={styles.summaryRow}><dt>{copyText("investment.dt5")}</dt><dd>{category ? investmentLabel(subcategoryLabel(category, subcategory), copyText) : "—"}</dd></div>
            <div className={styles.summaryRow}><dt>{copyText("investment.dt6")}</dt><dd>{category ? selectedAmcName : "—"}</dd></div>
            <div className={styles.summaryRow}><dt>{copyText("investment.dt2")}</dt><dd>{selectedFund?.abbreviation ?? copyText("investment.singleFundBuilderText7")}</dd></div>
          </dl>
          <div className={styles.statusNotice}>{copyText("investment.statusNotice7")}</div>
        </aside>
      </div>

      {detailLoading ? <div className={styles.singleResultLoading}>{copyText("investment.singleResultLoading")}</div> : null}
      {selectedFund && detail && !detailLoading ? (
        <SingleFundResult
          amount={amount}
          fund={selectedFund}
          detail={detail}
          allocationTotal={allocationTotal}
          onClassChange={(className) => void fetchDetail(selectedFund, className)}
          onSave={saveLocal}
          onHandoff={() => void handoffToLine()}
          saveStatus={saveStatus}
        />
      ) : null}
    </section>
  );
}

function CatalogSkeleton() {
  const copyText = usePublicCopy(INVESTMENT_COPY_DEFAULTS);

  return <div className={styles.catalogList} aria-busy="true" aria-label={copyText("investment.catalogSkeletonarialabel")}>{[0, 1, 2].map((item) => <div className={styles.catalogSkeleton} key={item} />)}</div>;
}

function SingleFundResult({ amount, fund, detail, allocationTotal, onClassChange, onSave, onHandoff, saveStatus }: {
  amount: number;
  fund: FundCatalogItem;
  detail: FundDetailResponse;
  allocationTotal: number;
  onClassChange: (className: string) => void;
  onSave: () => void;
  onHandoff: () => void;
  saveStatus: string | null;
}) {
  const copyText = usePublicCopy(INVESTMENT_COPY_DEFAULTS);

  const riskLevel = detail.risk?.level;
  const classRequired = detail.classes.length > 0 && !detail.selectedClassName;
  const handoffDisabled = amount <= 0 || detail.state === "unavailable" || classRequired || detail.fund?.projectId !== fund.projectId;

  return (
    <div id="single-fund-result" className={styles.singleResult}>
      <div className={styles.singleResultHeader}>
        <div>
          <p className={styles.eyebrow}>{copyText("investment.eyebrow5")}</p>
          <h2>{fund.nameTh}</h2>
          <p>{fund.abbreviation} · {fund.amcNameTh}</p>
        </div>
        <span className={styles.dataBadge}>{detail.source === "uat_synthetic" ? copyText("investment.singleFundResultText") : detail.source === "sec_v2" ? copyText("investment.linesText5") : copyText("investment.singleFundResultText2")}</span>
      </div>

      {detail.classes.length > 1 ? (
        <section className={styles.resultPanel} aria-labelledby="class-selector-title">
          <h3 id="class-selector-title">{copyText("investment.h39")}</h3>
          <p>{copyText("investment.p10")}</p>
          <div className={styles.classGrid}>
            {detail.classes.map((item) => (
              <button className={styles.classCard} data-active={detail.selectedClassName === item.name} aria-pressed={detail.selectedClassName === item.name} key={item.name} type="button" onClick={() => onClassChange(item.name)}>
                <strong>{item.name}</strong>
                <span>{item.detail ?? item.description ?? copyText("investment.singleFundResultText3")}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className={styles.singleResultGrid}>
        <section className={styles.resultPanel}>
          <h3>{copyText("investment.h310")}</h3>
          {riskLevel ? <><div className={styles.riskSingle}><strong>{riskLevel}</strong><span>{copyText("investment.span10")}{riskLevel}{" "}{copyText("investment.span11")}</span></div><p>{detail.risk?.description}</p></> : <p>{copyText("investment.p11")}</p>}
          <p className={styles.provenance}>{copyText("investment.provenance2")}{formatDate(detail.risk?.sourceDate ?? null, copyText)}</p>
        </section>

        <section className={styles.resultPanel}>
          <h3>{copyText("investment.h311")}</h3>
          {classRequired ? <p>{copyText("investment.p12")}</p> : detail.dealing ? <dl className={styles.factRows}>
            <div><dt>{copyText("investment.dt7")}</dt><dd>{detail.dealing.subscriptionPeriod ?? copyText("investment.formatDateText")}</dd></div>
            <div><dt>{copyText("investment.dt8")}</dt><dd>{detail.dealing.redemptionPeriod ?? copyText("investment.formatDateText")}</dd></div>
            <div><dt>{copyText("investment.dt9")}</dt><dd>{detail.dealing.settlementPeriod ?? copyText("investment.formatDateText")}</dd></div>
          </dl> : <p>{copyText("investment.p13")}</p>}
          <p className={styles.provenance}>{copyText("investment.provenance3")}</p>
          <p className={styles.provenance}>{copyText("investment.provenance4")}{formatDate(detail.dealing?.sourceDate ?? null, copyText)}</p>
        </section>
      </div>

      <section className={styles.resultPanel}>
        <h3>{copyText("investment.h312")}</h3>
        <p>{detail.source === "uat_synthetic" ? copyText("investment.singleFundResultText4") : copyText("investment.singleFundResultText5")}{" "}{copyText("investment.p14")}</p>
        {detail.assetAllocation.length ? <div className={styles.assetFactList}>{detail.assetAllocation.map((row, index) => {
          const equivalent = amount > 0 ? amount * row.percentNav / 100 : 0;
          return <div className={styles.assetFactRow} key={`${row.name}-${index}`}>
            <div className={styles.assetFactHeader}><strong>{row.name}</strong><span>{row.percentNav}%{amount > 0 ? copyText("investment.dynamic12").replaceAll("{0}", String(formatMoney(equivalent))) : ""}</span></div>
            <div className={styles.barTrack} aria-hidden="true"><div className={styles.barFill} data-negative={row.percentNav < 0} style={{ width: `${Math.min(100, Math.abs(row.percentNav))}%` }} /></div>
          </div>;
        })}</div> : <p>{copyText("investment.p15")}</p>}
        <p className={styles.allocationTotalRaw}>{copyText("investment.allocationTotalRaw")}<strong>{allocationTotal}%</strong></p>
        <p className={styles.provenance}>{copyText("investment.provenance5")}{formatDate(detail.dataDate, copyText)}{" "}{copyText("investment.provenance6")}{formatDate(detail.fetchedAt, copyText)}{" "}{copyText("investment.provenance7")}</p>
        {detail.source === "uat_synthetic" ? <p className={styles.statusNotice}>{copyText("investment.statusNotice8")}</p> : null}
        <p className={styles.provenance}>{copyText("investment.provenance8")}{detail.selectedClassName ?? copyText("investment.linesText3")}{" "}{copyText("investment.provenance9")}</p>
      </section>

      {detail.specifications.length || fund.masterFund ? <section className={styles.resultPanel}>
        <h3>{copyText("investment.h313")}</h3>
        <div className={styles.specList}>
          {fund.masterFund ? <span>{copyText("investment.span12")}{fund.masterFund}{fund.feederCountry ? ` · ${fund.feederCountry}` : ""}</span> : null}
          {[...new Set(detail.specifications.map((spec) => spec.description))].map((description) => <span key={description}>{description}</span>)}
        </div>
      </section> : null}

      {detail.warnings.length ? <section className={styles.resultPanel}><h3>{copyText("investment.h314")}</h3><ul className={styles.warningList}>{detail.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section> : null}

      <section className={styles.resultPanel}>
        <h3>{copyText("investment.h38")}</h3>
        <p>{copyText("investment.p16")}</p>
        <div className={styles.resultActions}>
          <button className={styles.secondary} type="button" disabled={handoffDisabled} onClick={onSave}>{copyText("investment.secondary")}</button>
          <button className={styles.primary} type="button" disabled={handoffDisabled} onClick={onHandoff}>{copyText("investment.primary4")}</button>
        </div>
        {amount <= 0 ? <p className={styles.validation} role="status">{copyText("investment.validation")}</p> : null}
        {saveStatus ? <p className={styles.saveStatus} role="status">{saveStatus}</p> : null}
      </section>
    </div>
  );
}

function formatDate(value: string | null, copyText: (key: keyof typeof INVESTMENT_COPY_DEFAULTS) => string): string {
  if (!value) return copyText("investment.formatDateText");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
