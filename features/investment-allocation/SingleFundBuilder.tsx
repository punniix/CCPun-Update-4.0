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

  async function loadCatalog(filters: {
    category: FundCatalogCategory | "all";
    subcategory: FundCatalogSubcategory;
    query: string;
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
      if (filters.cursor) params.set("cursor", filters.cursor);
      const response = await fetch(`/api/investment-allocation/catalog/?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`catalog_${response.status}`);
      const data = await response.json() as FundCatalogResponse;
      setCatalog((current) => append && current ? { ...data, items: [...current.items, ...data.items] } : data);
    } catch {
      setCatalog({ source: "unavailable", state: "unavailable", items: [], nextCursor: null, hasMore: false, query: filters.query, category: filters.category, subcategory: filters.subcategory, fetchedAt: new Date().toISOString(), message: "โหลดรายชื่อกองทุนไม่สำเร็จชั่วคราว" });
    } finally {
      setCatalogLoading(false);
      setCatalogAppending(false);
    }
  }

  function chooseCategory(next: FundCatalogCategory | "all") {
    setCategory(next);
    setSubcategory("all");
    setSelectedFund(null);
    setDetail(null);
    setSaveStatus(null);
    void loadCatalog({ category: next, subcategory: "all", query });
    trackEvent("ia_step_view", { tool_name: "investment_allocation", step_number: 1, cta_location: "investment_allocation_builder", surface_group: "investment_allocation" });
  }

  function chooseSubcategory(next: FundCatalogSubcategory) {
    if (!category) return;
    setSubcategory(next);
    setSelectedFund(null);
    setDetail(null);
    setSaveStatus(null);
    void loadCatalog({ category, subcategory: next, query });
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (!category) return;
    const nextQuery = queryInput.trim();
    setQuery(nextQuery);
    setSelectedFund(null);
    setDetail(null);
    void loadCatalog({ category, subcategory, query: nextQuery });
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
      setSaveStatus("อุปกรณ์นี้ไม่อนุญาตให้บันทึก Local Storage");
    }
  }

  async function handoffToLine() {
    const payload = buildHandoff();
    if (!payload || !selectedFund || !detail) return;
    const allocationLines = detail.assetAllocation.map((row) => `- ${row.name}: ${row.percentNav}%`);
    const lines = [
      "CCPun Investment Allocation — กองเดียว / ขอให้ Pun ช่วย Review",
      `Plan ID: ${payload.plan_id}`,
      `เงินลงทุน: ${formatMoney(payload.investment_amount)} บาท`,
      `กองที่เลือกเอง: ${selectedFund.nameTh} (${selectedFund.abbreviation})`,
      detail.selectedClassName ? `ชนิดหน่วย: ${detail.selectedClassName}` : "",
      detail.risk?.rawCode ? `Risk Spectrum: ${detail.risk.rawCode}` : "Risk Spectrum: ยังไม่มีข้อมูล",
      "",
      "Asset Allocation ตาม SEC Fund Factsheet:",
      ...allocationLines,
      "",
      detail.dealing?.settlementPeriod ? `เงื่อนไขรับเงินขายคืน: ${detail.dealing.settlementPeriod}` : "เงื่อนไขรับเงินขายคืน: ยังไม่มีข้อมูล",
      detail.dataDate ? `SEC data date: ${detail.dataDate}` : "",
      "",
      "ลูกค้าเป็นผู้เลือกกองเอง ต้องการให้ Pun ช่วย Review ต่อ",
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
              <p className={styles.eyebrow}>Simple Mode · กองเดียว</p>
              <h2>เลือกกองเอง แล้วดูว่าข้างในมีอะไร</h2>
              <p>ไม่ต้องจัด Asset Allocation ก่อน เลือกประเภทที่สนใจ แล้วเลือกกองทุนจากรายชื่อ active ที่ SEC เปิดเผย</p>
            </div>
            <span className={styles.stepPill}>SEC Open API</span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="single-investment-amount">เงินที่ต้องการลงทุน</label>
            <div className={styles.moneyInputWrap}>
              <input id="single-investment-amount" inputMode="decimal" type="number" min="0" step="1000" value={investmentAmount} onChange={(event) => setInvestmentAmount(event.target.value)} placeholder="เช่น 500000" />
              <span>บาท</span>
            </div>
            <p className={styles.fieldHint}>จำนวนเงินใช้สำหรับแปลงสัดส่วน Fund Factsheet เป็นภาพจำนวนเงินเท่านั้น ไม่ถูกส่งเข้า Analytics</p>
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
                <strong>ดูทุกประเภท</strong>
                <span>แสดงกอง active จาก SEC โดยไม่กรองประเภท</span>
              </button>
            </div>
          </div>

          {category ? (
            <>
              {options.length > 1 ? (
                <div className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>2. เลือกขอบเขตย่อย</span>
                  <div className={styles.filterChips} role="group" aria-label="ขอบเขตกองทุน">
                    {options.map((option) => (
                      <button key={option} className={styles.filterChip} data-active={subcategory === option} type="button" onClick={() => chooseSubcategory(option)}>
                        {subcategoryLabel(category, option)}
                      </button>
                    ))}
                  </div>
                  <p className={styles.fieldHint}>{category === "equity" ? "หุ้นไทย/ต่างประเทศอิง SEC invest_country_flag ไม่ได้อ่านจากชื่อกอง" : subcategory === "money_market" ? "ตลาดเงินใช้ SEC Fund Specification code MM" : "ขอบเขตประเทศอิง SEC invest_country_flag"}</p>
                </div>
              ) : null}

              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>{options.length > 1 ? "3" : "2"}. เลือกกองทุน</span>
                <form className={styles.searchRow} onSubmit={submitSearch}>
                  <input className={styles.searchInput} aria-label="ค้นหากองทุน" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="ค้นหาชื่อไทย อังกฤษ ชื่อย่อ หรือรหัสโครงการ" />
                  <button className={styles.smallButton} type="submit">ค้นหา</button>
                </form>
                {query ? <button className={styles.clearSearch} type="button" onClick={() => { setQueryInput(""); setQuery(""); if (category) void loadCatalog({ category, subcategory, query: "" }); }}>ล้างคำค้น “{query}”</button> : null}
                <div className={styles.catalogMeta}>
                  <span>{catalog?.source === "sec_v2" ? "ข้อมูล SEC v2 · Registered / IPO · ลำดับรายการไม่ใช่การจัดอันดับ" : catalog?.source === "uat_synthetic" ? "UAT synthetic" : ""}</span>
                  {catalog?.fetchedAt ? <span>ดึงข้อมูล {formatDate(catalog.fetchedAt)}</span> : null}
                </div>

                {catalogLoading ? <CatalogSkeleton /> : null}
                {!catalogLoading && catalog?.message ? <div className={styles.statusNotice} role="status">{catalog.message}</div> : null}
                {!catalogLoading && catalog?.items.length ? (
                  <div className={styles.catalogList}>
                    {catalog.items.map((fund) => (
                      <article className={styles.catalogCard} key={fund.projectId}>
                        <div className={styles.catalogMain}>
                          <span className={styles.sourceBadge}>{fund.fundStatus}</span>
                          <h3>{fund.nameTh}</h3>
                          <p className={styles.catalogAbbr}>{fund.abbreviation} · {fund.projectId}</p>
                          <p className={styles.catalogAmc}>{fund.amcNameTh}</p>
                          <div className={styles.fundFacts}>
                            <span>{FUND_CATEGORY_LABELS[fund.category]}</span>
                            <span>{geographyLabel(fund.investCountryFlag, fund.category)}</span>
                            {fund.masterFund ? <span>Feeder Fund</span> : null}
                          </div>
                        </div>
                        <button className={styles.catalogChoose} type="button" onClick={() => void fetchDetail(fund)}>เลือกกองนี้</button>
                      </article>
                    ))}
                  </div>
                ) : null}
                {!catalogLoading && catalog?.hasMore && catalog.nextCursor ? (
                  <button className={styles.loadMore} type="button" disabled={catalogAppending} onClick={() => category && void loadCatalog({ category, subcategory, query, cursor: catalog.nextCursor, append: true })}>{catalogAppending ? "กำลังโหลด…" : "โหลดกองเพิ่ม"}</button>
                ) : null}
              </div>
            </>
          ) : <div className={styles.statusNotice}>เลือกประเภทกองด้านบนก่อน แล้วระบบจะเปิด Fund Picker จากกองที่มีสถานะ Registered หรือ IPO ในข้อมูล SEC</div>}
        </div>

        <aside className={`${styles.summary} ${styles.summarySticky}`} aria-label="สรุปการเลือกกองเดียว">
          <p className={styles.eyebrow}>Simple Mode</p>
          <h2>กองเดียว = 100% อัตโนมัติ</h2>
          <p className={styles.summaryIntro}>คุณไม่ต้องกรอก Allocation หลายช่อง ระบบถือว่ากองที่เลือกเป็น 100% ของเงินก้อนนี้ แล้วค่อยอธิบายองค์ประกอบจาก Fund Factsheet</p>
          <div className={styles.summaryAmount}><span>เงินในแผน</span><strong>{amount > 0 ? `${formatMoney(amount)} บาท` : "—"}</strong></div>
          <dl className={styles.summaryRows}>
            <div className={styles.summaryRow}><dt>ประเภท</dt><dd>{category ? category === "all" ? "ทุกประเภท" : FUND_CATEGORY_LABELS[category] : "ยังไม่เลือก"}</dd></div>
            <div className={styles.summaryRow}><dt>หมวดย่อย</dt><dd>{category ? subcategoryLabel(category, subcategory) : "—"}</dd></div>
            <div className={styles.summaryRow}><dt>กองที่เลือก</dt><dd>{selectedFund?.abbreviation ?? "ยังไม่เลือก"}</dd></div>
          </dl>
          <div className={styles.statusNotice}>ไม่มี Recommended / Top Pick / Best Match รายการกองมาจาก SEC และลูกค้าเป็นผู้เลือกเอง</div>
        </aside>
      </div>

      {detailLoading ? <div className={styles.singleResultLoading}>กำลังดึง Fund Factsheet จาก SEC…</div> : null}
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
        <span className={styles.dataBadge}>SEC v2</span>
      </div>

      {detail.classes.length > 1 ? (
        <section className={styles.resultPanel} aria-labelledby="class-selector-title">
          <h3 id="class-selector-title">เลือกชนิดหน่วยลงทุน</h3>
          <p>กองเดียวกันอาจมีหลาย Class และเงื่อนไขซื้อขายต่างกัน เลือก Class ที่คุณจะใช้ก่อนดู Liquidity</p>
          <div className={styles.classGrid}>
            {detail.classes.map((item) => (
              <button className={styles.classCard} data-active={detail.selectedClassName === item.name} key={item.name} type="button" onClick={() => onClassChange(item.name)}>
                <strong>{item.name}</strong>
                <span>{item.detail ?? item.description ?? "SEC ไม่ได้ระบุรายละเอียด Class"}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className={styles.singleResultGrid}>
        <section className={styles.resultPanel}>
          <h3>Risk Spectrum</h3>
          {riskLevel ? <><div className={styles.riskSingle}><strong>{riskLevel}</strong><span>ระดับ {riskLevel} จาก Fund Factsheet</span></div><p>{detail.risk?.description}</p></> : <p>ยังไม่มี Risk Spectrum ระดับ 1–8 ที่ระบบอ่านได้{detail.risk?.rawCode ? ` (SEC ระบุ ${detail.risk.rawCode})` : ""}</p>}
          <p className={styles.provenance}>ข้อมูลมีผลตั้งแต่ {formatDate(detail.risk?.sourceDate ?? null)}</p>
        </section>

        <section className={styles.resultPanel}>
          <h3>Liquidity / การรับเงินขายคืน</h3>
          {classRequired ? <p>เลือกชนิดหน่วยลงทุนก่อน เพื่อดูเงื่อนไขของ Class ที่ถูกต้อง</p> : detail.dealing ? <dl className={styles.factRows}>
            <div><dt>รับคำสั่งซื้อ</dt><dd>{detail.dealing.subscriptionPeriod ?? "ไม่ระบุ"}</dd></div>
            <div><dt>รับคำสั่งขายคืน</dt><dd>{detail.dealing.redemptionPeriod ?? "ไม่ระบุ"}</dd></div>
            <div><dt>เงื่อนไขรับเงิน</dt><dd>{detail.dealing.settlementPeriod ?? "ไม่ระบุ"}</dd></div>
          </dl> : <p>ยังไม่มีข้อมูล Subscription / Redemption ที่ระบบอ่านได้</p>}
          <p className={styles.provenance}>เป็นเงื่อนไขที่ Fund Factsheet ระบุ ไม่ใช่การรับประกันวันที่เงินจริงเข้าบัญชี</p>
        </section>
      </div>

      <section className={styles.resultPanel}>
        <h3>เงินก้อนนี้อยู่ในสินทรัพย์อะไรบ้าง</h3>
        <p>แสดง `asset_ratio` (%NAV) จาก Fund Factsheet ล่าสุดตามที่ SEC เปิดเผย โดยไม่ปรับตัวเลขให้รวมเป็น 100%</p>
        {detail.assetAllocation.length ? <div className={styles.assetFactList}>{detail.assetAllocation.map((row, index) => {
          const equivalent = amount > 0 ? amount * row.percentNav / 100 : 0;
          return <div className={styles.assetFactRow} key={`${row.name}-${index}`}>
            <div className={styles.assetFactHeader}><strong>{row.name}</strong><span>{row.percentNav}%{amount > 0 ? ` · ประมาณ ${formatMoney(equivalent)} บาท` : ""}</span></div>
            <div className={styles.barTrack} aria-hidden="true"><div className={styles.barFill} data-negative={row.percentNav < 0} style={{ width: `${Math.min(100, Math.abs(row.percentNav))}%` }} /></div>
          </div>;
        })}</div> : <p>ยังไม่มี Asset Allocation ล่าสุดที่ระบบอ่านได้</p>}
        <p className={styles.allocationTotalRaw}>รวมตามข้อมูลต้นทาง: <strong>{allocationTotal}%</strong></p>
        <p className={styles.provenance}>Data date: {formatDate(detail.dataDate)} · ดึงข้อมูล: {formatDate(detail.fetchedAt)}</p>
      </section>

      {detail.specifications.length || fund.masterFund ? <section className={styles.resultPanel}>
        <h3>ข้อเท็จจริงเพิ่มเติมจาก SEC</h3>
        <div className={styles.specList}>
          {fund.masterFund ? <span>Master fund: {fund.masterFund}{fund.feederCountry ? ` · ${fund.feederCountry}` : ""}</span> : null}
          {detail.specifications.map((spec) => <span key={`${spec.className}-${spec.code}`}>{spec.code}: {spec.description}</span>)}
        </div>
      </section> : null}

      {detail.warnings.length ? <section className={styles.resultPanel}><h3>ข้อจำกัดของข้อมูล</h3><ul className={styles.warningList}>{detail.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section> : null}

      <section className={styles.resultPanel}>
        <h3>ส่งต่อให้ Pun ช่วย Review</h3>
        <p>ระบบไม่ได้ตัดสินว่ากองนี้ “ดี” หรือ “เหมาะ” แต่ส่งบริบทที่คุณเลือกเองให้คุยต่อได้โดยไม่ต้องเริ่มใหม่</p>
        <div className={styles.resultActions}>
          <button className={styles.secondary} type="button" onClick={onSave}>บันทึกในอุปกรณ์นี้</button>
          <button className={styles.primary} type="button" onClick={onHandoff}>คัดลอกสรุป + ส่งให้ Pun Review</button>
        </div>
        {saveStatus ? <p className={styles.saveStatus} role="status">{saveStatus}</p> : null}
      </section>
    </div>
  );
}
