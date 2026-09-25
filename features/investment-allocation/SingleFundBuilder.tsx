'use client';

import { FormEvent, useMemo, useState } from "react";
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

export default function SingleFundBuilder() {
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

  const amount = Number(investmentAmount.replace(/,/g, "")) || 0;
  const options = useMemo(() => category ? subcategoryOptions(category) : ["all"] as FundCatalogSubcategory[], [category]);
  const allocationTotal = rawAllocationTotal(detail);
  const selectedAmcName = amcId === "all" ? "ทุก บลจ." : amcs?.items.find((item) => item.id === amcId)?.nameTh ?? "บลจ. ที่เลือก";
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
      setAmcs({ source: "unavailable", state: "unavailable", items: [], fetchedAt: new Date().toISOString(), message: "โหลดรายชื่อ บลจ. ไม่สำเร็จชั่วคราว" });
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
    const append = Boolean(filters.append);
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
      setCatalog((current) => append && current ? { ...data, items: [...current.items, ...data.items] } : data);
    } catch {
      setCatalog({ source: "unavailable", state: "unavailable", items: [], nextCursor: null, hasMore: false, query: filters.query, category: filters.category, subcategory: filters.subcategory, amcId: filters.amcId === "all" ? null : filters.amcId, fetchedAt: new Date().toISOString(), message: "โหลดรายชื่อกองทุนไม่สำเร็จชั่วคราว" });
    } finally {
      setCatalogLoading(false);
      setCatalogAppending(false);
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
    setSelectedFund(fund);
    setDetail(null);
    setDetailLoading(true);
    setSaveStatus(null);
    try {
      const params = new URLSearchParams({ proj_id: fund.projectId });
      if (className) params.set("class_name", className);
      const response = await fetch(`/api/investment-allocation/detail/?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`detail_${response.status}`);
      const data = await response.json() as FundDetailResponse;
      setDetail(data);
      trackEvent("ia_result_view", { tool_name: "investment_allocation", cta_location: "investment_allocation_result", surface_group: "investment_allocation" });
      window.setTimeout(() => document.getElementById("single-fund-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    } catch {
      setDetail({ source: "unavailable", state: "unavailable", fund, classes: [], selectedClassName: null, specifications: [], risk: null, assetAllocation: [], dealing: null, dataDate: null, fetchedAt: new Date().toISOString(), warnings: ["โหลดรายละเอียดกองทุนไม่สำเร็จชั่วคราว"], endpointStates: {} });
    } finally {
      setDetailLoading(false);
    }
  }

  function ensurePlanId(): string {
    if (planId) return planId;
    const next = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `single-${Date.now()}`;
    setPlanId(next);
    return next;
  }

  function buildHandoff() {
    if (!selectedFund || !detail) return null;
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
      created_at: new Date().toISOString(),
    };
  }

  function saveLocal() {
    const payload = buildHandoff();
    if (!payload) return;
    try {
      localStorage.setItem("ccpun_investment_single_fund_plan_v1", JSON.stringify(payload));
      setSaveStatus("บันทึกไว้ในอุปกรณ์นี้แล้ว — ยังไม่ได้ส่งข้อมูลออกจากเบราว์เซอร์");
      trackEvent("ia_save_local", { tool_name: "investment_allocation", cta_location: "investment_allocation_result", surface_group: "investment_allocation" });
    } catch {
      setSaveStatus("อุปกรณ์นี้ไม่อนุญาตให้บันทึกข้อมูลในเบราว์เซอร์");
    }
  }

  async function handoffToLine() {
    const payload = buildHandoff();
    if (!payload || !selectedFund || !detail) return;
    const allocationLines = detail.assetAllocation.map((row) => `- ${row.name}: ${row.percentNav}%`);
    const lines = [
      "CCPun — แผนกองทุนกองเดียว / ขอให้ Pun ช่วยดู",
      `รหัสแผน: ${payload.plan_id}`,
      `เงินลงทุน: ${formatMoney(payload.investment_amount)} บาท`,
      `กองที่เลือกเอง: ${selectedFund.nameTh} (${selectedFund.abbreviation})`,
      detail.selectedClassName ? `ชนิดหน่วยลงทุน: ${detail.selectedClassName}` : "",
      detail.risk?.level ? `ระดับความเสี่ยง: ${detail.risk.level} จาก 1–8` : "ระดับความเสี่ยง: ยังไม่มีข้อมูล",
      "",
      "สัดส่วนสินทรัพย์ตามข้อมูลจาก ก.ล.ต.:",
      ...allocationLines,
      "",
      detail.dealing?.settlementPeriod ? `เงื่อนไขรับเงินหลังขายคืน: ${detail.dealing.settlementPeriod}` : "เงื่อนไขรับเงินหลังขายคืน: ยังไม่มีข้อมูล",
      detail.dataDate ? `ข้อมูล ณ วันที่: ${detail.dataDate}` : "",
      "",
      "ลูกค้าเป็นผู้เลือกกองเอง ต้องการให้ Pun ช่วยดูต่อ",
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setSaveStatus("คัดลอกสรุปแล้ว กำลังเปิด LINE — วางข้อความในแชตได้เลย");
    } catch {
      setSaveStatus("เปิด LINE ได้ แต่เบราว์เซอร์ไม่อนุญาต Clipboard");
    }
    trackEvent("ia_contact_click", { tool_name: "investment_allocation", contact_channel: "line", cta_location: "investment_allocation_result", surface_group: "investment_allocation" });
    window.open("https://lin.ee/tqLCs4f", "_blank", "noopener,noreferrer");
  }

  return (
    <section id="investment-allocation-builder" className={styles.shell} aria-label="เลือกกองทุนกองเดียว">
      <div className={styles.singleLayout}>
        <div className={styles.builder}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.eyebrow}>เริ่มง่าย · กองเดียว</p>
              <h2>เลือกกองเอง แล้วดูว่าเงินถูกนำไปลงทุนอย่างไร</h2>
              <p>ไม่ต้องจัดพอร์ตหลายกองก่อน เลือกประเภทที่สนใจ กรองตาม บลจ. ได้ แล้วค่อยเลือกกองทุนที่คุณต้องการดู</p>
            </div>
            <span className={styles.stepPill}>ข้อมูลจาก ก.ล.ต.</span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="single-investment-amount">เงินที่ต้องการลงทุน</label>
            <div className={styles.moneyInputWrap}>
              <input id="single-investment-amount" inputMode="decimal" type="number" min="0" step="1000" value={investmentAmount} onChange={(event) => setInvestmentAmount(event.target.value)} placeholder="เช่น 500000" />
              <span>บาท</span>
            </div>
            <p className={styles.fieldHint}>จำนวนเงินนี้ใช้แสดงภาพว่าแต่ละสัดส่วนคิดเป็นเงินประมาณเท่าไร และไม่ถูกส่งไปใช้วิเคราะห์พฤติกรรมการใช้งาน</p>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>1. เลือกประเภทกองที่สนใจ</span>
            <div className={styles.categoryGrid}>
              {CATEGORIES.map((item) => (
                <button key={item} className={styles.categoryCard} data-active={category === item} type="button" onClick={() => chooseCategory(item)}>
                  <strong>{FUND_CATEGORY_LABELS[item]}</strong>
                  <span>{FUND_CATEGORY_DESCRIPTIONS[item]}</span>
                </button>
              ))}
              <button className={styles.categoryCard} data-active={category === "all"} type="button" onClick={() => chooseCategory("all")}>
                <strong>ดูกองทุนทุกประเภท</strong>
                <span>ถ้ายังไม่แน่ใจว่าควรเริ่มดูจากหมวดไหน สามารถเปิดดูทั้งหมดได้</span>
              </button>
            </div>
          </div>

          {category ? (
            <>
              {options.length > 1 ? (
                <div className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>2. เลือกพื้นที่ลงทุน</span>
                  <div className={styles.filterChips} role="group" aria-label="ขอบเขตกองทุน">
                    {options.map((option) => (
                      <button key={option} className={styles.filterChip} data-active={subcategory === option} type="button" onClick={() => chooseSubcategory(option)}>
                        {subcategoryLabel(category, option)}
                      </button>
                    ))}
                  </div>
                  <p className={styles.fieldHint}>เลือกตามพื้นที่ลงทุนที่คุณสนใจ ระบบอ้างอิงข้อมูลที่กองทุนรายงานต่อ ก.ล.ต.</p>
                </div>
              ) : null}

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="fund-amc-filter">{amcStep}. เลือก บลจ. (ไม่จำเป็น)</label>
                <select id="fund-amc-filter" className={styles.amcSelect} value={amcId} disabled={amcsLoading} onChange={(event) => chooseAmc(event.target.value)}>
                  <option value="all">ทุก บลจ.</option>
                  {amcs?.items.map((item) => <option value={item.id} key={item.id}>{item.nameTh}</option>)}
                </select>
                <p className={styles.fieldHint}>{amcsLoading ? "กำลังโหลดรายชื่อ บลจ.…" : "ถ้าคุณมี บลจ. ที่ต้องการดูอยู่แล้ว สามารถกรองได้ทันที หรือเลือกทุก บลจ. เพื่อดูทั้งหมด"}</p>
                {amcs?.state === "unavailable" && amcs.message ? <div className={styles.statusNotice} role="status">{amcs.message}</div> : null}
              </div>

              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>{fundStep}. เลือกกองทุน</span>
                <form className={styles.searchRow} onSubmit={submitSearch}>
                  <input className={styles.searchInput} aria-label="ค้นหากองทุน" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="ค้นหาชื่อกองหรือชื่อย่อ" />
                  <button className={styles.smallButton} type="submit">ค้นหา</button>
                </form>
                {query ? <button className={styles.clearSearch} type="button" onClick={() => { setQueryInput(""); setQuery(""); if (category) void loadCatalog({ category, subcategory, query: "", amcId }); }}>ล้างคำค้น “{query}”</button> : null}
                <div className={styles.catalogMeta}>
                  <span>{catalog?.source === "sec_v2" ? `ข้อมูลจาก ก.ล.ต. · ${selectedAmcName} · ลำดับรายการไม่ใช่การจัดอันดับ` : catalog?.source === "uat_synthetic" ? "ข้อมูลตัวอย่างชั่วคราว" : ""}</span>
                  {catalog?.fetchedAt ? <span>ตรวจข้อมูลล่าสุด {formatDate(catalog.fetchedAt)}</span> : null}
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
                            <span>{FUND_CATEGORY_LABELS[fund.category]}</span>
                            <span>{geographyLabel(fund.investCountryFlag, fund.category)}</span>
                            {fund.masterFund ? <span>ลงทุนผ่านกองทุนหลัก</span> : null}
                          </div>
                        </div>
                        <button className={styles.catalogChoose} type="button" onClick={() => void fetchDetail(fund)}>เลือกกองนี้</button>
                      </article>
                    ))}
                  </div>
                ) : null}
                {!catalogLoading && catalog?.hasMore && catalog.nextCursor ? (
                  <button className={styles.loadMore} type="button" disabled={catalogAppending} onClick={() => category && void loadCatalog({ category, subcategory, query, amcId, cursor: catalog.nextCursor, append: true })}>{catalogAppending ? "กำลังโหลด…" : "ดูกองทุนเพิ่ม"}</button>
                ) : null}
              </div>
            </>
          ) : <div className={styles.statusNotice}>เลือกประเภทกองด้านบนก่อน จากนั้นคุณสามารถเลือกพื้นที่ลงทุน เลือก บลจ. หรือดูทุก บลจ. แล้วค่อยเลือกกองทุนได้</div>}
        </div>

        <aside className={`${styles.summary} ${styles.summarySticky}`} aria-label="สรุปการเลือกกองเดียว">
          <p className={styles.eyebrow}>กองเดียว</p>
          <h2>เลือกกองเดียว ระบบคิดเป็น 100% ให้เลย</h2>
          <p className={styles.summaryIntro}>คุณไม่ต้องกรอกสัดส่วนหลายช่อง เมื่อเลือกกองแล้ว ระบบจะแสดงว่าเงินก้อนนี้ถูกนำไปลงทุนในอะไรบ้างจากข้อมูลล่าสุดที่กองทุนเปิดเผย</p>
          <div className={styles.summaryAmount}><span>เงินในแผน</span><strong>{amount > 0 ? `${formatMoney(amount)} บาท` : "—"}</strong></div>
          <dl className={styles.summaryRows}>
            <div className={styles.summaryRow}><dt>ประเภทกอง</dt><dd>{category ? category === "all" ? "ทุกประเภท" : FUND_CATEGORY_LABELS[category] : "ยังไม่เลือก"}</dd></div>
            <div className={styles.summaryRow}><dt>พื้นที่ลงทุน</dt><dd>{category ? subcategoryLabel(category, subcategory) : "—"}</dd></div>
            <div className={styles.summaryRow}><dt>บลจ.</dt><dd>{category ? selectedAmcName : "—"}</dd></div>
            <div className={styles.summaryRow}><dt>กองที่เลือก</dt><dd>{selectedFund?.abbreviation ?? "ยังไม่เลือก"}</dd></div>
          </dl>
          <div className={styles.statusNotice}>รายการกองทุนไม่มีการแนะนำหรือจัดอันดับ คุณเป็นคนเลือกกองเองทุกขั้น</div>
        </aside>
      </div>

      {detailLoading ? <div className={styles.singleResultLoading}>กำลังโหลดข้อมูลกองทุนจาก ก.ล.ต.…</div> : null}
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
  return <div className={styles.catalogList} aria-busy="true" aria-label="กำลังโหลดรายชื่อกองทุน">{[0, 1, 2].map((item) => <div className={styles.catalogSkeleton} key={item} />)}</div>;
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
  const riskLevel = detail.risk?.level;
  const classRequired = detail.classes.length > 1 && !detail.selectedClassName;

  return (
    <div id="single-fund-result" className={styles.singleResult}>
      <div className={styles.singleResultHeader}>
        <div>
          <p className={styles.eyebrow}>กองที่คุณเลือกเอง · 100%</p>
          <h2>{fund.nameTh}</h2>
          <p>{fund.abbreviation} · {fund.amcNameTh}</p>
        </div>
        <span className={styles.dataBadge}>ข้อมูลจาก ก.ล.ต.</span>
      </div>

      {detail.classes.length > 1 ? (
        <section className={styles.resultPanel} aria-labelledby="class-selector-title">
          <h3 id="class-selector-title">เลือกชนิดหน่วยลงทุน</h3>
          <p>กองเดียวกันอาจมีหลายชนิดหน่วยลงทุนและเงื่อนไขซื้อขายต่างกัน เลือกชนิดหน่วยที่คุณสนใจก่อนดูเงื่อนไขขายคืนและการรับเงิน</p>
          <div className={styles.classGrid}>
            {detail.classes.map((item) => (
              <button className={styles.classCard} data-active={detail.selectedClassName === item.name} key={item.name} type="button" onClick={() => onClassChange(item.name)}>
                <strong>{item.name}</strong>
                <span>{item.detail ?? item.description ?? "ยังไม่มีรายละเอียดเพิ่มเติมสำหรับชนิดหน่วยนี้"}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className={styles.singleResultGrid}>
        <section className={styles.resultPanel}>
          <h3>ระดับความเสี่ยงของกองทุน</h3>
          {riskLevel ? <><div className={styles.riskSingle}><strong>{riskLevel}</strong><span>ระดับ {riskLevel} จาก 1–8 ตามข้อมูลกองทุน</span></div><p>{detail.risk?.description}</p></> : <p>ยังไม่มีข้อมูลระดับความเสี่ยง 1–8 ที่แสดงได้ในตอนนี้</p>}
          <p className={styles.provenance}>ข้อมูล ณ วันที่ {formatDate(detail.risk?.sourceDate ?? null)}</p>
        </section>

        <section className={styles.resultPanel}>
          <h3>ขายคืนแล้วรับเงินเมื่อไร</h3>
          {classRequired ? <p>เลือกชนิดหน่วยลงทุนก่อน เพื่อดูเงื่อนไขของชนิดหน่วยนั้นให้ถูกต้อง</p> : detail.dealing ? <dl className={styles.factRows}>
            <div><dt>ซื้อได้เมื่อไร</dt><dd>{detail.dealing.subscriptionPeriod ?? "ไม่ระบุ"}</dd></div>
            <div><dt>ขายคืนได้เมื่อไร</dt><dd>{detail.dealing.redemptionPeriod ?? "ไม่ระบุ"}</dd></div>
            <div><dt>รับเงินหลังขายคืน</dt><dd>{detail.dealing.settlementPeriod ?? "ไม่ระบุ"}</dd></div>
          </dl> : <p>ยังไม่มีข้อมูลเงื่อนไขซื้อและขายคืนที่แสดงได้ในตอนนี้</p>}
          <p className={styles.provenance}>ข้อมูลนี้เป็นเงื่อนไขที่กองทุนรายงานไว้ ไม่ใช่การรับประกันวันที่เงินจริงเข้าบัญชี</p>
        </section>
      </div>

      <section className={styles.resultPanel}>
        <h3>เงินก้อนนี้ถูกนำไปลงทุนในอะไรบ้าง</h3>
        <p>แสดงสัดส่วนสินทรัพย์ตามข้อมูลล่าสุดที่กองทุนรายงานต่อ ก.ล.ต. โดยคงตัวเลขตามต้นทางและไม่ปรับให้รวมเป็น 100% เอง</p>
        {detail.assetAllocation.length ? <div className={styles.assetFactList}>{detail.assetAllocation.map((row, index) => {
          const equivalent = amount > 0 ? amount * row.percentNav / 100 : 0;
          return <div className={styles.assetFactRow} key={`${row.name}-${index}`}>
            <div className={styles.assetFactHeader}><strong>{row.name}</strong><span>{row.percentNav}%{amount > 0 ? ` · ประมาณ ${formatMoney(equivalent)} บาท` : ""}</span></div>
            <div className={styles.barTrack} aria-hidden="true"><div className={styles.barFill} data-negative={row.percentNav < 0} style={{ width: `${Math.min(100, Math.abs(row.percentNav))}%` }} /></div>
          </div>;
        })}</div> : <p>ยังไม่มีข้อมูลสัดส่วนสินทรัพย์ที่แสดงได้ในตอนนี้</p>}
        <p className={styles.allocationTotalRaw}>รวมตามข้อมูลที่รายงาน: <strong>{allocationTotal}%</strong></p>
        <p className={styles.provenance}>ข้อมูล ณ วันที่ {formatDate(detail.dataDate)} · ตรวจข้อมูลล่าสุด {formatDate(detail.fetchedAt)}</p>
      </section>

      {detail.specifications.length || fund.masterFund ? <section className={styles.resultPanel}>
        <h3>ข้อมูลเพิ่มเติมเกี่ยวกับกองทุน</h3>
        <div className={styles.specList}>
          {fund.masterFund ? <span>กองทุนหลักที่ลงทุนต่อ: {fund.masterFund}{fund.feederCountry ? ` · ${fund.feederCountry}` : ""}</span> : null}
          {detail.specifications.map((spec) => <span key={`${spec.className}-${spec.code}`}>{spec.description}</span>)}
        </div>
      </section> : null}

      {detail.warnings.length ? <section className={styles.resultPanel}><h3>ข้อจำกัดของข้อมูล</h3><ul className={styles.warningList}>{detail.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section> : null}

      <section className={styles.resultPanel}>
        <h3>ให้ Pun ช่วยดูต่อ</h3>
        <p>ระบบไม่ได้ตัดสินว่ากองนี้ “ดี” หรือ “เหมาะ” แต่ช่วยส่งข้อมูลที่คุณเลือกเองให้คุยต่อได้โดยไม่ต้องเริ่มใหม่</p>
        <div className={styles.resultActions}>
          <button className={styles.secondary} type="button" onClick={onSave}>บันทึกในอุปกรณ์นี้</button>
          <button className={styles.primary} type="button" onClick={onHandoff}>คัดลอกสรุป + ส่งให้ Pun ช่วยดู</button>
        </div>
        {saveStatus ? <p className={styles.saveStatus} role="status">{saveStatus}</p> : null}
      </section>
    </div>
  );
}
