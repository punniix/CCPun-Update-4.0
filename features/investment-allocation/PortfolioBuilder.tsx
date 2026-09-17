'use client';

import { FormEvent, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { allocationTotal, calculatePlan, constructionCoverageMatches, createAdvisorHandoffPayload, isAllocationComplete, percentForAmount } from "./domain/calculation";
import type { AllocationRow, AssetBucket, ConstructionBucket, FundSearchResponse, InvestmentPlanResult, PlanningFund, SelectedFund } from "./domain/types";
import styles from "./InvestmentAllocation.module.css";

const CONSTRUCTION_LABELS: Record<ConstructionBucket, string> = {
  mixed: "กองทุนรวมผสม",
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
  demo_data: "มีข้อมูลสังเคราะห์ UAT อยู่ในแผนนี้ ข้อมูลดังกล่าวไม่ใช่ข้อมูลกองทุนจริงจาก ก.ล.ต.",
  partial_asset_allocation: "องค์ประกอบสินทรัพย์ของบางกองไม่ครบ ส่วนที่ขาดถูกเก็บเป็น “ยังระบุไม่ได้” โดยไม่ปรับส่วนที่รู้ให้รวมเป็น 100%",
  missing_risk: "บางกองยังไม่มี Risk Spectrum ที่ระบบอ่านได้ จึงแสดงเป็นไม่ทราบระดับความเสี่ยง",
  missing_liquidity: "บางกองยังไม่มีข้อมูลเงื่อนไขรับเงินที่ระบบอ่านได้",
  target_not_set: "คุณไม่ได้กำหนดเป้าหมายสินทรัพย์ จึงไม่แสดงส่วนต่าง Target เทียบ Effective",
  target_delta_inconclusive: "ยังมีองค์ประกอบสินทรัพย์ที่ระบุไม่ได้ จึงไม่สรุป Delta ว่าสูง/ต่ำกว่าเป้าหมายอย่างเด็ดขาด",
  stale_data: "บางข้อมูลมีสถานะเก่า ควรตรวจวันข้อมูลก่อนใช้ประกอบการตัดสินใจ",
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

function safePercent(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.round(parsed * 100) / 100));
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
}

function stepCopy(step: number) {
  if (step === 1) return { title: "กำหนดเงินและวิธีประกอบพอร์ต", body: "เริ่มจากจำนวนเงินและสัดส่วนประเภทกองที่คุณตั้งใจใช้ ระบบไม่เติม Allocation ให้เอง" };
  if (step === 2) return { title: "เลือกกองทุนด้วยตัวคุณเอง", body: "ค้นหาและเลือกกองเอง แล้วกำหนดน้ำหนักให้ตรงกับ Allocation ที่คุณตั้งไว้" };
  if (step === 3) return { title: "กำหนด Target Asset Allocation (ถ้ามี)", body: "ส่วนนี้แยกจากประเภทกองทุน เพื่อให้เทียบกับ Effective Allocation บนฐานเดียวกัน" };
  return { title: "ภาพรวมจากสิ่งที่คุณเลือก", body: "ผลลัพธ์อธิบายโครงสร้าง ความเสี่ยง และเงื่อนไขจากข้อมูลที่มี โดยไม่บอกว่าควรซื้อหรือขายอะไร" };
}

export default function PortfolioBuilder() {
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

  const amount = Number(investmentAmount.replace(/,/g, "")) || 0;
  const constructionTotal = allocationTotal(construction);
  const selectedTotal = allocationTotal(selectedFunds.map((selected) => ({ key: selected.fund.id, percent: selected.weightPercent })));
  const targetTotal = allocationTotal(target);
  const constructionValid = amount > 0 && isAllocationComplete(construction);
  const selectedValid = selectedFunds.length > 0 && isAllocationComplete(selectedFunds.map((selected) => ({ key: selected.fund.id, percent: selected.weightPercent }))) && constructionCoverageMatches(construction, selectedFunds);
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
    window.setTimeout(() => document.getElementById("investment-allocation-builder")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function searchFunds(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    setSearchState(null);
    try {
      const response = await fetch(`/api/investment-allocation/funds/?q=${encodeURIComponent(trimmed)}`, { method: "GET", headers: { Accept: "application/json" } });
      const data = await response.json() as FundSearchResponse;
      setSearchState(data);
    } catch {
      setSearchState({ mode: "uat_demo", state: "unavailable", query: trimmed, funds: [], message: "ค้นหาไม่สำเร็จชั่วคราว ลองใหม่อีกครั้ง", fetchedAt: new Date().toISOString() });
    } finally {
      setSearching(false);
    }
  }

  function addFund(fund: PlanningFund) {
    if (!fund.constructionBucket) return;
    setSelectedFunds((current) => current.some((selected) => selected.fund.id === fund.id) ? current : [...current, { fund, weightPercent: 0, selectionSource: "customer" }]);
  }

  function updateSelectedWeight(id: string, weightPercent: number) {
    setSelectedFunds((current) => current.map((selected) => selected.fund.id === id ? { ...selected, weightPercent } : selected));
  }

  function removeFund(id: string) {
    setSelectedFunds((current) => current.filter((selected) => selected.fund.id !== id));
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
      setSaveStatus("บันทึกไว้ในอุปกรณ์นี้แล้ว — ยังไม่ได้ส่งข้อมูลออกจากเบราว์เซอร์");
      trackEvent("ia_save_local", { tool_name: "investment_allocation", cta_location: "investment_allocation_result", surface_group: "investment_allocation" });
    } catch {
      setSaveStatus("อุปกรณ์นี้ไม่อนุญาตให้บันทึก Local Storage");
    }
  }

  async function handoffToLine() {
    if (!result) return;
    const id = ensurePlanId();
    const payload = createAdvisorHandoffPayload(id, result);
    const lines = [
      "CCPun Investment Allocation — ขอให้ Pun ช่วย Review",
      `Plan ID: ${payload.plan_id}`,
      `เงินลงทุน: ${formatMoney(payload.investment_amount)} บาท`,
      "",
      "กองที่เลือกเอง:",
      ...payload.selected_funds.map((fund) => `- ${fund.fund_name}: ${fund.selected_weight_percent}%`),
      "",
      "Effective Allocation:",
      ...payload.effective_allocation.filter((row) => row.percent > 0).map((row) => `- ${EFFECTIVE_LABELS[row.key]}: ${row.percent}%`),
      "",
      "Risk Spectrum distribution:",
      ...payload.risk_distribution.filter((row) => row.percent > 0).map((row) => `- ${row.level === "unknown" ? "ไม่ทราบ" : `Risk ${row.level}`}: ${row.percent}%`),
      "",
      "Liquidity summary:",
      ...payload.liquidity_summary.filter((row) => row.percent > 0).map((row) => `- ${row.bucket}: ${row.percent}%`),
      "",
      `Methodology: ${payload.methodology_version}`,
      "ลูกค้าเป็นผู้เลือกกองและกำหนดสัดส่วนเอง ต้องการให้ Pun ช่วย Review ต่อ",
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setSaveStatus("คัดลอกสรุปแล้ว กำลังเปิด LINE — วางข้อความในแชตได้เลย");
    } catch {
      setSaveStatus("เปิด LINE ได้ แต่เบราว์เซอร์ไม่อนุญาต Clipboard กรุณากดบันทึกแผนก่อน");
    }
    trackEvent("ia_contact_click", { tool_name: "investment_allocation", contact_channel: "line", cta_location: "investment_allocation_result", surface_group: "investment_allocation" });
    window.open("https://lin.ee/tqLCs4f", "_blank", "noopener,noreferrer");
  }

  return (
    <section id="investment-allocation-builder" className={styles.shell} aria-label="เครื่องมือจัดสัดส่วนการลงทุน">
      <div className={styles.grid}>
        <div className={styles.builder}>
          <div className={styles.stepHeader}>
            <div>
              <p className={styles.eyebrow}>Investment Allocation</p>
              <h2>{currentCopy.title}</h2>
              <p>{currentCopy.body}</p>
            </div>
            <span className={styles.stepPill}>ขั้น {step}/4</span>
          </div>

          {step === 1 ? (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="investment-amount">เงินที่ต้องการนำมาวางแผน</label>
                <div className={styles.moneyInputWrap}>
                  <input id="investment-amount" inputMode="decimal" type="number" min="0" step="1000" value={investmentAmount} onChange={(event) => setInvestmentAmount(event.target.value)} placeholder="เช่น 500000" />
                  <span>บาท</span>
                </div>
                <p className={styles.fieldHint}>ตัวเลขนี้ใช้คำนวณจำนวนเงินจริงในหน้านี้ และไม่ถูกส่งเข้า GA4/Meta</p>
              </div>

              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>สัดส่วน “ประเภทกอง” ที่คุณตั้งใจใช้</span>
                <div className={styles.allocationList}>
                  {construction.map((row) => (
                    <div className={styles.allocationRow} key={row.key}>
                      <div className={styles.allocationName}><strong>{CONSTRUCTION_LABELS[row.key]}</strong><small>กรอกเป็น % หรือจำนวนเงินก็ได้</small></div>
                      <div className={styles.allocationControls}>
                        <label className={styles.percentWrap}><span>%</span><input className={styles.percentInput} aria-label={`${CONSTRUCTION_LABELS[row.key]} เปอร์เซ็นต์`} type="number" min="0" max="100" step="0.01" value={row.percent ? Math.round(row.percent * 100) / 100 : ""} onChange={(event) => updateConstruction(row.key, safePercent(event.target.value))} /></label>
                        <label className={styles.amountWrap}><span>บาท</span><input className={styles.amountInput} aria-label={`${CONSTRUCTION_LABELS[row.key]} จำนวนเงิน`} inputMode="decimal" type="number" min="0" max={amount || undefined} step="1000" disabled={amount <= 0} value={amount > 0 && row.percent ? Math.round((amount * row.percent) / 100 * 100) / 100 : ""} onChange={(event) => updateConstructionAmount(row.key, event.target.value)} /></label>
                      </div>
                    </div>
                  ))}
                </div>
                <AllocationTotal total={constructionTotal} label="รวมประเภทกอง" />
              </div>

              <div className={styles.actions}><span /><button className={styles.primary} type="button" disabled={!constructionValid} onClick={() => navigate(2)}>เลือกกองทุนต่อ</button></div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <form className={styles.searchRow} onSubmit={searchFunds}>
                <input className={styles.searchInput} aria-label="ค้นหากองทุน" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="UAT: พิมพ์ UAT หรือชื่อ/รหัสกองทุน" />
                <button className={styles.smallButton} type="submit" disabled={searching}>{searching ? "กำลังค้น" : "ค้นหา"}</button>
              </form>
              <div className={styles.statusNotice}><strong>ลูกค้าเป็นคนเลือกเอง</strong> ไม่มี Recommended / Top Pick / Best Match และผลค้นหาไม่จัดอันดับจากผลตอบแทน</div>

              {searchState?.message ? <div className={styles.statusNotice} role="status">{searchState.message}</div> : null}
              {searchState?.funds.length ? (
                <div className={styles.searchResults} aria-label="ผลค้นหากองทุน">
                  {searchState.funds.map((fund) => {
                    const alreadySelected = selectedFunds.some((selected) => selected.fund.id === fund.id);
                    const selectable = Boolean(fund.constructionBucket);
                    return <article className={styles.fundCard} key={fund.id}>
                      <div className={styles.fundTop}><div className={styles.fundTitle}><strong>{fund.name}</strong><small>{fund.projectId}{fund.className ? ` · ${fund.className}` : ""}</small></div><span className={styles.sourceBadge}>{fund.provenance.source === "uat_synthetic" ? "UAT SYNTHETIC" : "SEC v2"}</span></div>
                      <div className={styles.fundFacts}><span>Risk {fund.riskSpectrum ?? "—"}</span><span>{fund.constructionBucket ? CONSTRUCTION_LABELS[fund.constructionBucket] : "ยังไม่ยืนยันประเภทกอง"}</span><span>{fund.liquidity.rawText ?? "Liquidity: ไม่มีข้อมูล"}</span></div>
                      {!selectable ? <p className={styles.liveFundWarning}>UAT ยังไม่เลือกกองนี้เข้าแผน เพราะ endpoint สำหรับ classification / asset allocation ยังไม่ผ่าน data-feasibility gate — ไม่เดาประเภทจากชื่อกอง</p> : null}
                      <button type="button" data-primary={selectable && !alreadySelected} disabled={!selectable || alreadySelected} onClick={() => addFund(fund)}>{alreadySelected ? "เลือกแล้ว" : selectable ? "เลือกกองนี้" : "รอข้อมูล classification"}</button>
                    </article>;
                  })}
                </div>
              ) : null}

              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>กองที่คุณเลือก</span>
                {selectedFunds.length === 0 ? <div className={styles.statusNotice}>ยังไม่ได้เลือกกอง — ใน UAT พิมพ์ “UAT” เพื่อใช้ข้อมูลสังเคราะห์ทดสอบ interaction และ calculation</div> : (
                  <div className={styles.selectedList}>
                    {selectedFunds.map((selected) => <article className={styles.fundCard} key={selected.fund.id}>
                      <div className={styles.fundTop}><div className={styles.fundTitle}><strong>{selected.fund.name}</strong><small>{selected.fund.constructionBucket ? CONSTRUCTION_LABELS[selected.fund.constructionBucket] : "ยังไม่ระบุประเภท"}</small></div><span className={styles.sourceBadge}>selection: customer</span></div>
                      <div className={styles.selectedControl}>
                        <label><span>สัดส่วนในพอร์ต</span><div className={styles.percentWrap}><span>%</span><input className={styles.percentInput} type="number" min="0" max="100" step="1" aria-label={`สัดส่วน ${selected.fund.name}`} value={selected.weightPercent || ""} onChange={(event) => updateSelectedWeight(selected.fund.id, safePercent(event.target.value))} /></div></label>
                        <button type="button" onClick={() => removeFund(selected.fund.id)}>เอาออก</button>
                      </div>
                    </article>)}
                  </div>
                )}
                <AllocationTotal total={selectedTotal} label="รวมกองที่เลือก" errorMessage={selectedTotal === 100 && !constructionCoverageMatches(construction, selectedFunds) ? "ยอดรวม 100% แล้ว แต่สัดส่วนแต่ละประเภทกองยังไม่ตรงกับที่ตั้งไว้ในขั้นแรก" : undefined} />
              </div>

              <div className={styles.actions}><button className={styles.ghost} type="button" onClick={() => navigate(1)}>ย้อนกลับ</button><button className={styles.primary} type="button" disabled={!selectedValid} onClick={() => navigate(3)}>กำหนด Target ต่อ</button></div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className={styles.optionalBox}>
                <h3>Target Asset Allocation เป็นคนละชั้นกับ “ประเภทกอง”</h3>
                <p>ถ้าคุณมี Target อยู่แล้ว ให้ใส่รวม 100% เพื่อเทียบกับ Effective Allocation ในฐานสินทรัพย์เดียวกัน ถ้ายังไม่มี ให้ปล่อย 0% ทุกช่อง ระบบจะไม่สร้าง Target ให้เอง</p>
              </div>
              <div className={styles.allocationList}>
                {target.map((row) => (
                  <div className={styles.allocationRow} key={row.key}>
                    <div className={styles.allocationName}><strong>{ASSET_LABELS[row.key]}</strong><small>หมวด normalization สำหรับ UAT; Production จะล็อก mapping หลังยืนยัน SEC allocation endpoint</small></div>
                    <label className={styles.percentWrap}><span>%</span><input className={styles.percentInput} aria-label={`Target ${ASSET_LABELS[row.key]} เปอร์เซ็นต์`} type="number" min="0" max="100" step="1" value={row.percent || ""} onChange={(event) => updateTarget(row.key, safePercent(event.target.value))} /></label>
                  </div>
                ))}
              </div>
              <AllocationTotal total={targetTotal} label="รวม Target Asset" allowZero />
              <div className={styles.actions}><button className={styles.ghost} type="button" onClick={() => navigate(2)}>ย้อนกลับ</button><button className={styles.primary} type="button" disabled={!targetValid} onClick={() => navigate(4)}>ดูภาพรวมพอร์ต</button></div>
            </>
          ) : null}

          {step === 4 ? (
            result ? <ResultView result={result} onEdit={() => navigate(1)} onSave={savePlan} onHandoff={handoffToLine} saveStatus={saveStatus} /> : <div className={styles.statusNotice}>ข้อมูลยังไม่ครบสำหรับคำนวณ กรุณาย้อนกลับไปตรวจ Allocation</div>
          ) : null}
        </div>

        <aside className={`${styles.summary} ${styles.summarySticky}`} aria-label="สรุปแผนระหว่างจัดพอร์ต">
          <p className={styles.eyebrow}>Live Summary</p>
          <h2>เห็นภาพโดยไม่เลือกแทน</h2>
          <p className={styles.summaryIntro}>ตัวเลขอัปเดตตามสิ่งที่คุณกรอกเอง ไม่มีพอร์ตเริ่มต้นหรือกองแนะนำอัตโนมัติ</p>
          <div className={styles.summaryAmount}><span>เงินในแผน</span><strong>{amount > 0 ? `${formatMoney(amount)} บาท` : "—"}</strong></div>
          <dl className={styles.summaryRows}>
            <div className={styles.summaryRow}><dt>ประเภทกอง</dt><dd>{constructionTotal}% / 100%</dd></div>
            <div className={styles.summaryRow}><dt>กองที่เลือก</dt><dd>{selectedFunds.length} กอง · {selectedTotal}%</dd></div>
            <div className={styles.summaryRow}><dt>Target Asset</dt><dd>{targetTotal === 0 ? "ยังไม่ตั้ง" : `${targetTotal}%`}</dd></div>
            <div className={styles.summaryRow}><dt>แหล่งข้อมูลค้นหา</dt><dd>{searchState?.mode === "sec_live" ? "SEC v2" : searchState ? "UAT synthetic" : "ยังไม่ค้น"}</dd></div>
          </dl>
          <div className={styles.statusNotice}>Risk Spectrum แสดง 1–8 แยกจาก Liquidity และไม่ถูกเฉลี่ยเป็น “Portfolio Risk Score”</div>
        </aside>
      </div>
    </section>
  );
}

function AllocationTotal({ total, label, allowZero = false, errorMessage }: { total: number; label: string; allowZero?: boolean; errorMessage?: string }) {
  const valid = total === 100 || (allowZero && total === 0);
  const width = Math.min(100, Math.max(0, total));
  const message = errorMessage ?? (valid ? (total === 0 ? "ยังไม่ตั้ง Target — ทำต่อได้" : "ครบ 100%") : total < 100 ? `เหลืออีก ${Math.round((100 - total) * 100) / 100}%` : `เกินมา ${Math.round((total - 100) * 100) / 100}%`);
  return <div className={styles.totalBox} data-valid={valid}><div className={styles.totalLine}><span>{label}</span><strong>{total}%</strong></div><div className={styles.progressTrack} aria-hidden="true"><div className={styles.progressFill} style={{ width: `${width}%` }} /></div><p className={styles.validation} data-error={!valid || Boolean(errorMessage)} aria-live="polite">{message}</p></div>;
}

function ResultView({ result, onEdit, onSave, onHandoff, saveStatus }: { result: InvestmentPlanResult; onEdit: () => void; onSave: () => void; onHandoff: () => void; saveStatus: string | null }) {
  const unknownRisk = result.riskDistribution.find((row) => row.level === "unknown")?.percent ?? 0;
  return <div className={styles.resultStack}>
    <div className={styles.resultPanel}><h3>องค์ประกอบพอร์ตตามข้อมูลที่เปิดเผย</h3><p>Known coverage {result.coverage.effectiveAssetPercentKnown}% · ส่วนที่ไม่รู้ยังคงแยก ไม่ถูกกระจายกลับเข้า asset ที่รู้ข้อมูล</p><div className={styles.barList}>{result.effectiveAllocation.filter((row) => row.percent > 0).map((row) => <div className={styles.barRow} key={row.key}><span className={styles.barLabel}>{EFFECTIVE_LABELS[row.key]}</span><div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${Math.min(100, row.percent)}%` }} /></div><span className={styles.barValue}>{row.percent}%</span></div>)}</div></div>

    <div className={styles.resultPanel}><h3>Target vs Effective</h3>{result.targetDelta.length ? <div className={styles.deltaList}>{result.targetDelta.map((row) => <div className={styles.deltaRow} key={row.asset}><strong>{ASSET_LABELS[row.asset]} · Target {row.targetPercent}% / Effective {row.effectivePercent}%</strong><span>{row.conclusive && row.deltaPercentagePoints !== null ? `${row.deltaPercentagePoints > 0 ? "+" : ""}${row.deltaPercentagePoints} จุดเปอร์เซ็นต์` : "ยังสรุป Delta ไม่ได้ เพราะมี unknown coverage"}</span></div>)}</div> : <p>คุณยังไม่ได้กำหนด Target Asset Allocation จึงไม่มีการเปรียบเทียบ และระบบจะไม่สร้าง Target ให้เอง</p>}</div>

    <div className={styles.resultPanel}><h3>เงินอยู่ใน Risk Spectrum ระดับไหนบ้าง</h3><p>เป็นการกระจายตามระดับ 1–8 ของกองที่เลือก ไม่ใช่การคำนวณ Portfolio Risk Score</p><div className={styles.riskRail}>{result.riskDistribution.filter((row) => row.level !== "unknown").map((row) => <div className={styles.riskCell} data-has-value={row.percent > 0} key={String(row.level)}><strong>{row.level}</strong><span>{row.percent}%</span></div>)}</div>{unknownRisk > 0 ? <p className={styles.unknownLine}>ยังไม่มี Risk Spectrum: {unknownRisk}% ของแผน</p> : null}</div>

    <div className={styles.resultPanel}><h3>เงื่อนไข Liquidity ที่มองเห็น</h3><p>ตัวเลขนี้บอกว่าเงินตามแผนอยู่ในกองที่มีเงื่อนไขแบบใด ไม่ได้เป็นการรับประกันวันที่เงินจริงเข้าบัญชี</p><div className={styles.liquidityGrid}>{result.liquiditySummary.map((row) => <div className={styles.liquidityCard} key={row.bucket}><strong>{row.bucket}</strong><span>{row.percent}% · {formatMoney(row.amount)} บาท</span></div>)}</div></div>

    <div className={styles.resultPanel}><h3>ข้อควรรู้ก่อนนำผลไปใช้</h3><ul className={styles.warningList}>{result.warnings.map((warning) => <li key={warning}>{WARNING_LABELS[warning]}</li>)}</ul><p className={styles.provenance}>Snapshot references: {result.snapshotIds.length ? result.snapshotIds.join(" · ") : "ไม่มี snapshot reference"}</p></div>

    <div className={styles.resultPanel}><h3>ทำอะไรต่อ</h3><p>UAT นี้ยังไม่เขียนข้อมูลลูกค้าจาก Public Web เข้า Admin/Neon โดยตรง การส่ง Review ใช้การคัดลอกสรุปแล้วเปิด LINE เพื่อรักษา data boundary เดิม</p><div className={styles.resultActions}><button className={styles.ghost} type="button" onClick={onEdit}>ปรับพอร์ตต่อ</button><button className={styles.secondary} type="button" onClick={onSave}>บันทึกในอุปกรณ์นี้</button><button className={styles.primary} type="button" onClick={onHandoff}>คัดลอกสรุป + ส่งให้ Pun Review</button></div>{saveStatus ? <p className={styles.saveStatus} role="status">{saveStatus}</p> : null}</div>
  </div>;
}
