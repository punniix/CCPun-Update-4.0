'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { INVESTMENT_COPY_DEFAULTS, investmentLabel, investmentValue } from "@/lib/content/investment-copy-defaults";
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
import { createPlanId, parseInvestmentAmount } from "./domain/calculation";
import styles from "./InvestmentAllocation.module.css";
import { INVESTMENT_RISK_STATEMENT, requestFailureMessage } from "./domain/copy";
import { type FundScope, withFundScope } from "./domain/fund-scope";
import { fetchRestoreData, readSavedPlan, savePlanLocally } from "./domain/saved-plan";

const CATEGORIES: FundCatalogCategory[] = ["equity", "mixed", "fixed_income", "alternative", "other"];

const formatMoney = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format;

function formatDate(value: string | null): string {
  if (!value) return "ไม่ระบุ";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function subcategoryLabel(category: FundCatalogCategory | "all", subcategory: FundCatalogSubcategory): string {
  if (category === "equity") return equitySubcategoryLabel(subcategory);
  return FUND_SUBCATEGORY_LABELS[subcategory];
}

function rawAllocationTotal(detail: FundDetailResponse | null): number {
  if (!detail) return 0;
  return Math.round(detail.assetAllocation.reduce((sum, row) => sum + row.percentNav, 0) * 100) / 100;
}

export default function SingleFundBuilder({ scope = "main" }: { scope?: FundScope }) {
  const text = usePublicCopy(INVESTMENT_COPY_DEFAULTS);
  const label = (value: string) => investmentLabel(value, text);
  // The AIA tool is locked to บลจ. เอไอเอ on the server, so it has no AMC picker.
  const amcPicker = scope === "main";
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
  const [restoring, setRestoring] = useState(false);
  const [handoffText, setHandoffText] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const catalogRequest = useRef(0);
  const detailRequest = useRef(0);

  useEffect(() => () => { catalogRequest.current++; detailRequest.current++; }, []);

  const amount = parseInvestmentAmount(investmentAmount);
  const options = useMemo(() => category ? subcategoryOptions(category) : ["all"] as FundCatalogSubcategory[], [category]);
  const allocationTotal = rawAllocationTotal(detail);
  const selectedAmcName = !amcPicker ? text("investment.single.text002") : amcId === "all" ? text("investment.single.text003") : amcs?.items.find((item) => item.id === amcId)?.nameTh ?? text("investment.single.text004");
  const amcStep = options.length > 1 ? 3 : 2;
  const fundStep = (options.length > 1 ? 4 : 3) - (amcPicker ? 0 : 1);

  async function loadAmcs() {
    if (!amcPicker || amcs || amcsLoading) return;
    setAmcsLoading(true);
    try {
      const response = await fetch("/api/investment-allocation/amcs/", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`amcs_${response.status}`);
      setAmcs(await response.json() as FundAmcResponse);
    } catch {
      setAmcs({ source: "unavailable", state: "unavailable", items: [], fetchedAt: new Date().toISOString(), message: text("investment.single.text005") });
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
      setHandoffText(null);
      setRestoring(false);
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
      const params = withFundScope(new URLSearchParams({ category: filters.category, subcategory: filters.subcategory, limit: "20" }), scope);
      if (filters.query) params.set("q", filters.query);
      if (filters.amcId !== "all") params.set("amc", filters.amcId);
      if (filters.cursor) params.set("cursor", filters.cursor);
      const response = await fetch(`/api/investment-allocation/catalog/?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`catalog_${response.status}`);
      const data = await response.json() as FundCatalogResponse;
      if (request !== catalogRequest.current) return;
      setCatalog((current) => append && current ? { ...data, items: [...current.items, ...data.items] } : data);
    } catch (error) {
      if (request !== catalogRequest.current) return;
      setCatalog({ source: "unavailable", state: "unavailable", items: [], nextCursor: null, hasMore: false, query: filters.query, category: filters.category, subcategory: filters.subcategory, amcId: filters.amcId === "all" ? null : filters.amcId, fetchedAt: new Date().toISOString(), message: requestFailureMessage(error, text("investment.single.text006")) });
    } finally {
      if (request === catalogRequest.current) {
        setCatalogLoading(false);
        setCatalogAppending(false);
      }
    }
  }

  function chooseCategory(next: FundCatalogCategory | "all") {
    setCategory(next);
    setSubcategory("all");
    setAmcId("all");
    setSelectedFund(null);
    setDetail(null);
    setSaveStatus(null);
    void loadAmcs();
    void loadCatalog({ category: next, subcategory: "all", query, amcId: "all" });
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
    setHandoffText(null);
    setRestoring(false);
    const request = ++detailRequest.current;
    setSelectedFund(fund);
    setDetail(null);
    setDetailLoading(true);
    setSaveStatus(null);
    setPlanId(null);
    try {
      const params = withFundScope(new URLSearchParams({ proj_id: fund.projectId }), scope);
      if (className) params.set("class_name", className);
      const response = await fetch(`/api/investment-allocation/detail/?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`detail_${response.status}`);
      const data = await response.json() as FundDetailResponse;
      if (request !== detailRequest.current) return;
      setDetail(data);
      window.setTimeout(() => {
        if (request === detailRequest.current) document.getElementById("single-fund-result")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      }, 0);
    } catch (error) {
      if (request !== detailRequest.current) return;
      setDetail({ source: "unavailable", state: "unavailable", fund, classes: [], selectedClassName: null, specifications: [], risk: null, assetAllocation: [], dealing: null, dataDate: null, fetchedAt: new Date().toISOString(), warnings: [requestFailureMessage(error, text("investment.single.text007"))], endpointStates: {} });
    } finally {
      if (request === detailRequest.current) setDetailLoading(false);
    }
  }

  function ensurePlanId(): string {
    if (planId) return planId;
    const next = createPlanId("single");
    setPlanId(next);
    return next;
  }

  function buildHandoff() {
    if (!selectedFund || !detail || detail.fund?.projectId !== selectedFund.projectId || detail.state === "unavailable" || amount <= 0 || (detail.classes.length > 0 && !detail.selectedClassName)) return null;
    return {
      schema_version: 1,
      tool_scope: scope,
      journey_mode: "single_fund" as const,
      plan_id: ensurePlanId(),
      investment_amount: amount,
      selection_source: "customer" as const,
      selected_fund: {
        project_id: selectedFund.projectId,
        restore_query: selectedFund.abbreviation,
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
      savePlanLocally(localStorage, "single", scope, payload);
      setSaveStatus(text("investment.single.text008"));
    } catch {
      setSaveStatus(text("investment.single.text009"));
    }
  }

  async function restorePlan() {
    const request = ++detailRequest.current;
    catalogRequest.current++;
    setCatalogLoading(false);
    setCatalogAppending(false);
    setDetailLoading(false);
    setRestoring(true);
    setRestoreStatus(null);
    try {
      const saved = readSavedPlan(localStorage, "single", scope);
      if (!saved) { setRestoreStatus(text("investment.single.text010")); return; }
      const fund = saved.funds[0];
      const params = withFundScope(new URLSearchParams({ proj_id: fund.projectId }), scope);
      if (fund.className) params.set("class_name", fund.className);
      const response = await fetchRestoreData(`/api/investment-allocation/detail/?${params}`, () => request === detailRequest.current);
      if (!response.ok) throw new Error("restore_unavailable");
      const data = await response.json() as FundDetailResponse;
      if (!data.fund || data.fund.projectId !== fund.projectId || data.state === "unavailable" || (fund.className && (data.selectedClassName !== fund.className || !data.classes.some(row => row.name === fund.className)))) throw new Error("restore_unavailable");
      if (request !== detailRequest.current) return;
      setHandoffText(null);
      setInvestmentAmount(String(saved.amount));
      setCatalog(null);
      setQuery("");
      setQueryInput("");
      void loadAmcs();
      setSelectedFund(data.fund);
      setCategory(data.fund.category);
      setSubcategory("all");
      setAmcId(data.fund.amcId);
      setDetail(data);
      setPlanId(null);
      setSaveStatus(null);
      setRestoreStatus(text("investment.single.text011"));
    } catch (error) {
      if (request === detailRequest.current) setRestoreStatus(text(error instanceof Error && ["saved_plan_too_large", "saved_plan_restore_limit"].includes(error.message) ? "investment.restore.limit" : "investment.single.text012"));
    } finally {
      if (request === detailRequest.current) setRestoring(false);
    }
  }

  async function handoffToLine() {
    const payload = buildHandoff();
    if (!payload || !selectedFund || !detail) return;
    const allocationLines = detail.assetAllocation.map((row) => `- ${row.name}: ${row.percentNav}%`);
    const lines = [
      text("investment.single.text013"),
      investmentValue(text("investment.single.text014"), [payload.plan_id]),
      investmentValue(text("investment.single.text015"), [formatMoney(payload.investment_amount)]),
      investmentValue(text("investment.single.text016"), [selectedFund.nameTh, selectedFund.abbreviation]),
      detail.selectedClassName ? investmentValue(text("investment.single.text017"), [detail.selectedClassName]) : "",
      detail.risk?.level ? investmentValue(text("investment.single.text018"), [detail.risk.level]) : text("investment.single.text019"),
      "",
      detail.source === "uat_synthetic" ? text("investment.single.text020") : text("investment.single.text021"),
      ...allocationLines,
      "",
      detail.dealing?.settlementPeriod ? investmentValue(text("investment.single.text022"), [detail.dealing.settlementPeriod]) : text("investment.single.text023"),
      detail.dataDate ? investmentValue(text("investment.single.text024"), [detail.dataDate]) : "",
      investmentValue(text("investment.single.text025"), [detail.fetchedAt]),
      ...detail.warnings.map((warning) => investmentValue(text("investment.single.text026"), [warning])),
      "",
      text("investment.single.text027"),
    ].filter(Boolean);
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
    <section id="investment-allocation-builder" className={styles.shell} aria-label={text("investment.single.text030")}>
      <div className={styles.singleLayout}>
        <div className={styles.builder}>
          <div className={styles.stepHeader}>
            <div>
              <h2>{text.node("investment.single.text031")}</h2>
              <p>{amcPicker ? text("investment.single.text032") : text("investment.single.text033")}</p>
            </div>
            <span className={styles.stepPill}>{text.node("investment.single.text034")}</span>
          </div>

          <div className={styles.resultActions}>
            <button className={styles.secondary} type="button" disabled={restoring} onClick={() => void restorePlan()}>{restoring ? text("investment.single.text035") : text("investment.single.text036")}</button>
          </div>
          {restoreStatus ? <p className={styles.saveStatus} role="status">{restoreStatus}</p> : null}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="single-investment-amount">{text.node("investment.single.text037")}</label>
            <div className={styles.moneyInputWrap}>
              <input id="single-investment-amount" disabled={restoring} inputMode="decimal" type="number" min="0" step="1000" value={investmentAmount} onChange={(event) => { setInvestmentAmount(event.target.value); setHandoffText(null); setSaveStatus(null); setPlanId(null); }} placeholder={text("investment.single.text038")} />
              <span>{text.node("investment.single.text039")}</span>
            </div>
            <p className={styles.fieldHint}>{text.node("investment.single.text040")}</p>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>{text.node("investment.single.text041")}</span>
            <div className={styles.categoryGrid}>
              {CATEGORIES.map((item) => (
                <button key={item} className={styles.categoryCard} data-active={category === item} aria-pressed={category === item} type="button" onClick={() => chooseCategory(item)}>
                  <strong>{label(FUND_CATEGORY_LABELS[item])}</strong>
                  <span>{label(FUND_CATEGORY_DESCRIPTIONS[item])}</span>
                </button>
              ))}
              <button className={styles.categoryCard} data-active={category === "all"} aria-pressed={category === "all"} type="button" onClick={() => chooseCategory("all")}>
                <strong>{text.node("investment.single.text042")}</strong>
                <span>{text.node("investment.single.text043")}</span>
              </button>
            </div>
          </div>

          {category ? (
            <>
              {options.length > 1 ? (
                <div className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>{text.node("investment.single.text044")}</span>
                  <div className={styles.filterChips} role="group" aria-label={text("investment.single.text045")}>
                    {options.map((option) => (
                      <button key={option} className={styles.filterChip} data-active={subcategory === option} aria-pressed={subcategory === option} type="button" onClick={() => chooseSubcategory(option)}>
                        {label(subcategoryLabel(category, option))}
                      </button>
                    ))}
                  </div>
                  <p className={styles.fieldHint}>{text.node("investment.single.text046")}</p>
                </div>
              ) : null}

              {amcPicker ? <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="fund-amc-filter">{amcStep}{text.node("investment.single.text047")}</label>
                <select id="fund-amc-filter" className={styles.amcSelect} value={amcId} disabled={amcsLoading} onChange={(event) => chooseAmc(event.target.value)}>
                  <option value="all">{text.node("investment.single.text003")}</option>
                  {amcs?.items.map((item) => <option value={item.id} key={item.id}>{item.nameTh}</option>)}
                </select>
                <p className={styles.fieldHint}>{amcsLoading ? text("investment.single.text048") : text("investment.single.text049")}</p>
                {amcs?.state === "unavailable" && amcs.message ? <div className={styles.statusNotice} role="status">{amcs.message}</div> : null}
              </div> : null}

              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>{fundStep}{text.node("investment.single.text050")}</span>
                <form className={styles.searchRow} onSubmit={submitSearch}>
                  <input className={styles.searchInput} aria-label={text("investment.single.text051")} value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder={text("investment.single.text052")} />
                  <button className={styles.smallButton} type="submit">{text.node("investment.single.text053")}</button>
                </form>
                {query ? <button className={styles.clearSearch} type="button" onClick={() => { setQueryInput(""); setQuery(""); if (category) void loadCatalog({ category, subcategory, query: "", amcId }); }}>{text.node("investment.single.text054")}{query}”</button> : null}
                <div className={styles.catalogMeta}>
                  <span>{catalog?.source === "sec_v2" ? investmentValue(text("investment.single.text055"), [selectedAmcName]) : catalog?.source === "uat_synthetic" ? text("investment.single.text056") : ""}</span>
                  {/* Stored catalog: the date SEC data was fetched by the sync job (new copy pending owner approval 2026-10-26). */}
                  {catalog?.fetchedAt ? <span>{catalog.origin === "store" ? investmentValue(text("investment.single.text057"), [label(formatDate(catalog.fetchedAt))]) : investmentValue(text("investment.single.text058"), [label(formatDate(catalog.fetchedAt))])}</span> : null}
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
                            <span>{label(FUND_CATEGORY_LABELS[fund.category])}</span>
                            <span>{label(geographyLabel(fund.investCountryFlag, fund.category))}</span>
                            {fund.masterFund ? <span>{text.node("investment.single.text059")}</span> : null}
                          </div>
                        </div>
                        <button className={styles.catalogChoose} type="button" onClick={() => void fetchDetail(fund)}>{text.node("investment.single.text060")}</button>
                      </article>
                    ))}
                  </div>
                ) : null}
                {!catalogLoading && catalog?.hasMore && catalog.nextCursor ? (
                  <button className={styles.loadMore} type="button" disabled={catalogAppending} onClick={() => category && void loadCatalog({ category, subcategory, query, amcId, cursor: catalog.nextCursor, append: true })}>{catalogAppending ? text("investment.single.text061") : text("investment.single.text062")}</button>
                ) : null}
              </div>
            </>
          ) : <div className={styles.statusNotice}>{amcPicker ? text("investment.single.text063") : text("investment.single.text064")}</div>}
        </div>

        <aside className={`${styles.summary} ${styles.summarySticky}`} aria-label={text("investment.single.text065")}>
          <h2>{text.node("investment.single.text066")}</h2>
          <p className={styles.summaryIntro}>{text.node("investment.single.text067")}</p>
          <div className={styles.summaryAmount}><span>{text.node("investment.single.text068")}</span><strong>{amount > 0 ? investmentValue(text("investment.single.text069"), [formatMoney(amount)]) : "—"}</strong></div>
          <dl className={styles.summaryRows}>
            <div className={styles.summaryRow}><dt>{text.node("investment.single.text070")}</dt><dd>{category ? category === "all" ? text("investment.single.text071") : FUND_CATEGORY_LABELS[category] : text("investment.single.text072")}</dd></div>
            <div className={styles.summaryRow}><dt>{text.node("investment.single.text073")}</dt><dd>{category ? label(subcategoryLabel(category, subcategory)) : "—"}</dd></div>
            <div className={styles.summaryRow}><dt>{text.node("investment.single.text074")}</dt><dd>{category ? selectedAmcName : "—"}</dd></div>
            <div className={styles.summaryRow}><dt>{text.node("investment.single.text075")}</dt><dd>{selectedFund?.abbreviation ?? text("investment.single.text072")}</dd></div>
          </dl>
          <div className={styles.statusNotice}>{text.node("investment.single.text076")}</div>
        </aside>
      </div>

      {detailLoading ? <div className={styles.singleResultLoading}>{text.node("investment.single.text077")}</div> : null}
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
          handoffText={handoffText}
        />
      ) : null}
    </section>
  );
}

function CatalogSkeleton() {
  const text = usePublicCopy(INVESTMENT_COPY_DEFAULTS);
  return <div className={styles.catalogList} aria-busy="true" aria-label={text("investment.single.text078")}>{[0, 1, 2].map((item) => <div className={styles.catalogSkeleton} key={item} />)}</div>;
}

function SingleFundResult({ amount, fund, detail, allocationTotal, onClassChange, onSave, onHandoff, saveStatus, handoffText }: {
  amount: number;
  fund: FundCatalogItem;
  detail: FundDetailResponse;
  allocationTotal: number;
  onClassChange: (className: string) => void;
  onSave: () => void;
  onHandoff: () => void;
  saveStatus: string | null;
  handoffText: string | null;
}) {
  const text = usePublicCopy(INVESTMENT_COPY_DEFAULTS);
  const label = (value: string) => investmentLabel(value, text);
  const riskLevel = detail.risk?.level;
  const classRequired = detail.classes.length > 0 && !detail.selectedClassName;
  const handoffDisabled = amount <= 0 || detail.state === "unavailable" || classRequired || detail.fund?.projectId !== fund.projectId;

  return (
    <div id="single-fund-result" className={styles.singleResult}>
      <div className={styles.singleResultHeader}>
        <div>
          <h2>{fund.nameTh}</h2>
          <p>{fund.abbreviation} · {fund.amcNameTh}</p>
        </div>
        <span className={styles.dataBadge}>{detail.source === "uat_synthetic" ? text("investment.single.text079") : detail.source === "sec_v2" ? text("investment.single.text034") : text("investment.single.text080")}</span>
      </div>
      <p className={styles.riskStatement} role="note">{label(INVESTMENT_RISK_STATEMENT)}</p>

      {detail.classes.length > 1 ? (
        <section className={styles.resultPanel} aria-labelledby="class-selector-title">
          <h3 id="class-selector-title">{text.node("investment.single.text081")}</h3>
          <p>{text.node("investment.single.text082")}</p>
          <div className={styles.classGrid}>
            {detail.classes.map((item) => (
              <button className={styles.classCard} data-active={detail.selectedClassName === item.name} aria-pressed={detail.selectedClassName === item.name} key={item.name} type="button" onClick={() => onClassChange(item.name)}>
                <strong>{item.name}</strong>
                <span>{item.detail ?? item.description ?? text("investment.single.text083")}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className={styles.singleResultGrid}>
        <section className={styles.resultPanel}>
          <h3>{text.node("investment.single.text084")}</h3>
          {riskLevel ? <><div className={styles.riskSingle}><strong>{riskLevel}</strong><span>{text.node("investment.single.text085")}{riskLevel}{text.node("investment.single.text086")}</span></div><p>{detail.risk?.description}</p></> : <p>{text.node("investment.single.text087")}</p>}
          <p className={styles.provenance}>{text.node("investment.single.text088")}{label(formatDate(detail.risk?.sourceDate ?? null))}</p>
        </section>

        <section className={styles.resultPanel}>
          <h3>{text.node("investment.single.text089")}</h3>
          {classRequired ? <p>{text.node("investment.single.text090")}</p> : detail.dealing ? <dl className={styles.factRows}>
            <div><dt>{text.node("investment.single.text091")}</dt><dd>{detail.dealing.subscriptionPeriod ?? text("investment.single.text001")}</dd></div>
            <div><dt>{text.node("investment.single.text092")}</dt><dd>{detail.dealing.redemptionPeriod ?? text("investment.single.text001")}</dd></div>
            <div><dt>{text.node("investment.single.text093")}</dt><dd>{detail.dealing.settlementPeriod ?? text("investment.single.text001")}</dd></div>
          </dl> : <p>{text.node("investment.single.text094")}</p>}
          <p className={styles.provenance}>{text.node("investment.single.text095")}</p>
          <p className={styles.provenance}>{text.node("investment.single.text096")}{label(formatDate(detail.dealing?.sourceDate ?? null))}</p>
        </section>
      </div>

      <section className={styles.resultPanel}>
        <h3>{text.node("investment.single.text097")}</h3>
        <p>{detail.source === "uat_synthetic" ? text("investment.single.text098") : text("investment.single.text099")}{text.node("investment.single.text100")}</p>
        {detail.assetAllocation.length ? <div className={styles.assetFactList}>{detail.assetAllocation.map((row, index) => {
          const equivalent = amount > 0 ? amount * row.percentNav / 100 : 0;
          return <div className={styles.assetFactRow} key={`${row.name}-${index}`}>
            <div className={styles.assetFactHeader}><strong>{row.name}</strong><span>{row.percentNav}%{amount > 0 ? investmentValue(text("investment.single.text101"), [formatMoney(equivalent)]) : ""}</span></div>
            <div className={styles.barTrack} aria-hidden="true"><div className={styles.barFill} data-negative={row.percentNav < 0} style={{ width: `${Math.min(100, Math.abs(row.percentNav))}%` }} /></div>
          </div>;
        })}</div> : <p>{text.node("investment.single.text102")}</p>}
        <p className={styles.allocationTotalRaw}>{text.node("investment.single.text103")}<strong>{allocationTotal}%</strong></p>
        <p className={styles.provenance}>{text.node("investment.single.text104")}{label(formatDate(detail.dataDate))}{text.node("investment.single.text105")}{label(formatDate(detail.fetchedAt))}{text.node("investment.single.text106")}</p>
        {detail.source === "uat_synthetic" ? <p className={styles.statusNotice}>{text.node("investment.single.text107")}</p> : null}
        <p className={styles.provenance}>{text.node("investment.single.text108")}{detail.selectedClassName ?? text("investment.single.text109")}{text.node("investment.single.text110")}</p>
      </section>

      {detail.specifications.length || fund.masterFund ? <section className={styles.resultPanel}>
        <h3>{text.node("investment.single.text111")}</h3>
        <div className={styles.specList}>
          {fund.masterFund ? <span>{text.node("investment.single.text112")}{fund.masterFund}{fund.feederCountry ? ` · ${fund.feederCountry}` : ""}</span> : null}
          {[...new Set(detail.specifications.map((spec) => spec.description))].map((description) => <span key={description}>{description}</span>)}
        </div>
      </section> : null}

      {detail.warnings.length ? <section className={styles.resultPanel}><h3>{text.node("investment.single.text113")}</h3><ul className={styles.warningList}>{detail.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section> : null}

      <section className={styles.resultPanel}>
        <h3>{text.node("investment.single.text114")}</h3>
        <p>{text.node("investment.single.text115")}</p>
        <div className={styles.resultActions}>
          <button className={styles.secondary} type="button" disabled={handoffDisabled} onClick={onSave}>{text.node("investment.single.text116")}</button>
          <button className={styles.primary} type="button" disabled={handoffDisabled} onClick={onHandoff}>{text.node("investment.single.text117")}</button>
        </div>
        {amount <= 0 ? <p className={styles.validation} role="status">{text.node("investment.single.text118")}</p> : null}
        {saveStatus ? <p className={styles.saveStatus} role="status">{saveStatus}</p> : null}{handoffText ? <details className={styles.handoffFallback}><summary>{text.node("investment.handoff.manualTitle")}</summary><label>{text.node("investment.handoff.summaryLabel")}<textarea readOnly rows={8} value={handoffText} onFocus={event => event.currentTarget.select()} /></label><a href="https://lin.ee/tqLCs4f" target="_blank" rel="noopener noreferrer">{text.node("investment.handoff.openLine")}</a></details> : null}
      </section>
    </div>
  );
}
