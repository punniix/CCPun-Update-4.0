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

function safePercent(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, Math.round(parsed * 100) / 100));
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value);
}

function stepCopy(step: number) {
  if (step === 1) return { title: "กำหนดเงินและสัดส่วนประเภทกอง", body: "เริ่มจากจำนวนเงินและสัดส่วนประเภทกองที่คุณตั้งใจใช้ ระบบจะไม่ตั้งสัดส่วนให้เอง" };
  if (step === 2) return { title: "เลือกกองทุนด้วยตัวคุณเอง", body: "ค้นหาและเลือกกองเอง แล้วกำหนดสัดส่วนของแต่ละกองให้ตรงกับแผนที่คุณตั้งไว้" };
  if (step === 3) return { title: "มีสัดส่วนสินทรัพย์เป้าหมายไหม?", body: "ถ้ามี สามารถใส่ไว้เพื่อเปรียบเทียบกับสิ่งที่กองทุนที่เลือกถืออยู่จริง หากยังไม่มีสามารถข้ามได้" };
  return { title: "ภาพรวมจากสิ่งที่คุณเลือก", body: "ผลลัพธ์ช่วยให้เห็นโครงสร้าง ความเสี่ยง และเงื่อนไขจากข้อมูลที่มี โดยไม่บอกว่าควรซื้อหรือขายอะไร" };
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
      setSaveStatus("อุปกรณ์นี้ไม่อนุญาตให้บันทึกข้อมูลในเบราว์เซอร์");
    }
  }

  async function handoffToLine() {
    if (!result) return;
    const id = ensurePlanId();
    const payload = createAdvisorHandoffPayload(id, result);
    const lines = [
      "CCPun — แผนหลายกอง / ขอให้ Pun ช่วยดู",
      `รหัสแผน: ${payload.plan_id}`,
      `เงินลงทุน: ${formatMoney(payload.investment_amount)} บาท`,
      "",
      "กองที่เลือกเอง:",
      ...payload.selected_funds.map((fund) => `- ${fund.fund_name}: ${fund.selected_weight_percent}%`),
      "",
      "สัดส่วนสินทรัพย์จากกองที่เลือก:",
      ...payload.effective_allocation.filter((row) => row.percent > 0).map((row) => `- ${EFFECTIVE_LABELS[row.key]}: ${row.percent}%`),
      "",
      "การกระจายตามระดับความเสี่ยง:",
      ...payload.risk_distribution.filter((row) => row.percent > 0).map((row) => `- ${row.level === "unknown" ? "ยังไม่มีข้อมูล" : `ระดับ ${row.level}`}: ${row.percent}%`),
      "",
      "เงื่อนไขรับเงินหลังขายคืน:",
      ...payload.liquidity_summary.filter((row) => row.percent > 0).map((row) => `- ${row.bucket}: ${row.percent}%`),
      "",
      "ลูกค้าเป็นผู้เลือกกองและกำหนดสัดส่วนเอง ต้องการให้ Pun ช่วยดูต่อ",
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
              <p className={styles.eyebrow}>จัดหลายกองเอง</p>
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
                <p className={styles.fieldHint}>จำนวนเงินนี้ใช้คำนวณตัวเลขในหน้านี้ และไม่ถูกส่งไปใช้วิเคราะห์พฤติกรรมการใช้งาน</p>
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
                <input className={styles.searchInput} aria-label="ค้นหากองทุน" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อกองหรือชื่อย่อ" />
                <button className={styles.smallButton} type="submit" disabled={searching}>{searching ? "กำลังค้น" : "ค้นหา"}</button>
              </form>
              <div className={styles.statusNotice}><strong>คุณเป็นคนเลือกกองเอง</strong> รายการค้นหาไม่มีการแนะนำ จัดอันดับ หรือเรียงจากผลตอบแทน</div>

              {searchState?.message ? <div className={styles.statusNotice} role="status">{searchState.message}</div> : null}
              {searchState?.funds.length ? (
                <div className={styles.searchResults} aria-label="ผลค้นหากองทุน">
                  {searchState.funds.map((fund) => {
                    const alreadySelected = selectedFunds.some((selected) => selected.fund.id === fund.id);
                    const selectable = Boolean(fund.constructionBucket);
                    return <article className={styles.fundCard} key={fund.id}>
                      <div className={styles.fundTop}><div className={styles.fundTitle}><strong>{fund.name}</strong><small>{fund.shortName}{fund.className ? ` · ${fund.className}` : ""}</small></div><span className={styles.sourceBadge}>{fund.provenance.source === "uat_synthetic" ? "ข้อมูลตัวอย่าง" : "ข้อมูลจาก ก.ล.ต."}</span></div>
                      <div className={styles.fundFacts}><span>ความเสี่ยงระดับ {fund.riskSpectrum ?? "—"}</span><span>{fund.constructionBucket ? CONSTRUCTION_LABELS[fund.constructionBucket] : "ยังไม่มีข้อมูลประเภทกอง"}</span><span>{fund.liquidity.rawText ?? "ยังไม่มีข้อมูลการรับเงินขายคืน"}</span></div>
                      {!selectable ? <p className={styles.liveFundWarning}>ข้อมูลประเภทกองของรายการนี้ยังไม่พร้อม จึงยังเลือกเข้าแผนไม่ได้</p> : null}
                      <button type="button" data-primary={selectable && !alreadySelected} disabled={!selectable || alreadySelected} onClick={() => addFund(fund)}>{alreadySelected ? "เลือกแล้ว" : selectable ? "เลือกกองนี้" : "ยังเลือกไม่ได้"}</button>
                    </article>;
                  })}
                </div>
              ) : null}

              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>กองที่คุณเลือก</span>
                {selectedFunds.length === 0 ? <div className={styles.statusNotice}>ยังไม่ได้เลือกกอง ค้นหากองที่คุณสนใจด้านบนแล้วกด “เลือกกองนี้”</div> : (
                  <div className={styles.selectedList}>
                    {selectedFunds.map((selected) => <article className={styles.fundCard} key={selected.fund.id}>
                      <div className={styles.fundTop}><div className={styles.fundTitle}><strong>{selected.fund.name}</strong><small>{selected.fund.constructionBucket ? CONSTRUCTION_LABELS[selected.fund.constructionBucket] : "ยังไม่ระบุประเภท"}</small></div><span className={styles.sourceBadge}>คุณเลือกเอง</span></div>
                      <div className={styles.selectedControl}>
                        <label><span>สัดส่วนในพอร์ต</span><div className={styles.percentWrap}><span>%</span><input className={styles.percentInput} type="number" min="0" max="100" step="1" aria-label={`สัดส่วน ${selected.fund.name}`} value={selected.weightPercent || ""} onChange={(event) => updateSelectedWeight(selected.fund.id, safePercent(event.target.value))} /></div></label>
                        <button type="button" onClick={() => removeFund(selected.fund.id)}>เอาออก</button>
                      </div>
                    </article>)}
                  </div>
                )}
                <AllocationTotal total={selectedTotal} label="รวมกองที่เลือก" errorMessage={selectedTotal === 100 && !constructionCoverageMatches(construction, selectedFunds) ? "ยอดรวม 100% แล้ว แต่สัดส่วนแต่ละประเภทกองยังไม่ตรงกับที่ตั้งไว้ในขั้นแรก" : undefined} />
              </div>

              <div className={styles.actions}><button className={styles.ghost} type="button" onClick={() => navigate(1)}>ย้อนกลับ</button><button className={styles.primary} type="button" disabled={!selectedValid} onClick={() => navigate(3)}>ไปขั้นถัดไป</button></div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className={styles.optionalBox}>
                <h3>มีสัดส่วนสินทรัพย์ที่อยากได้อยู่แล้วไหม?</h3>
                <p>ถ้ามี ให้ใส่หุ้น ตราสารหนี้ เงินฝาก/ตลาดเงิน และสินทรัพย์อื่นรวมกันเป็น 100% เพื่อเปรียบเทียบกับกองทุนที่คุณเลือก ถ้ายังไม่มี ปล่อยทุกช่องเป็น 0% แล้วไปต่อได้เลย</p>
              </div>
              <div className={styles.allocationList}>
                {target.map((row) => (
                  <div className={styles.allocationRow} key={row.key}>
                    <div className={styles.allocationName}><strong>{ASSET_LABELS[row.key]}</strong><small>ใส่เฉพาะเมื่อคุณมีสัดส่วนเป้าหมายอยู่แล้ว</small></div>
                    <label className={styles.percentWrap}><span>%</span><input className={styles.percentInput} aria-label={`สัดส่วนเป้าหมาย ${ASSET_LABELS[row.key]} เปอร์เซ็นต์`} type="number" min="0" max="100" step="1" value={row.percent || ""} onChange={(event) => updateTarget(row.key, safePercent(event.target.value))} /></label>
                  </div>
                ))}
              </div>
              <AllocationTotal total={targetTotal} label="รวมสัดส่วนเป้าหมาย" allowZero />
              <div className={styles.actions}><button className={styles.ghost} type="button" onClick={() => navigate(2)}>ย้อนกลับ</button><button className={styles.primary} type="button" disabled={!targetValid} onClick={() => navigate(4)}>ดูภาพรวมพอร์ต</button></div>
            </>
          ) : null}

          {step === 4 ? (
            result ? <ResultView result={result} onEdit={() => navigate(1)} onSave={savePlan} onHandoff={handoffToLine} saveStatus={saveStatus} /> : <div className={styles.statusNotice}>ข้อมูลยังไม่ครบ กรุณาย้อนกลับไปตรวจสัดส่วนที่กรอกไว้</div>
          ) : null}
        </div>

        <aside className={`${styles.summary} ${styles.summarySticky}`} aria-label="สรุปแผนระหว่างจัดพอร์ต">
          <p className={styles.eyebrow}>สรุประหว่างจัดพอร์ต</p>
          <h2>เห็นภาพโดยไม่เลือกแทน</h2>
          <p className={styles.summaryIntro}>ตัวเลขอัปเดตตามสิ่งที่คุณกรอกเอง ระบบไม่ตั้งพอร์ตหรือเลือกกองทุนให้โดยอัตโนมัติ</p>
          <div className={styles.summaryAmount}><span>เงินในแผน</span><strong>{amount > 0 ? `${formatMoney(amount)} บาท` : "—"}</strong></div>
          <dl className={styles.summaryRows}>
            <div className={styles.summaryRow}><dt>ประเภทกอง</dt><dd>{constructionTotal}% / 100%</dd></div>
            <div className={styles.summaryRow}><dt>กองที่เลือก</dt><dd>{selectedFunds.length} กอง · {selectedTotal}%</dd></div>
            <div className={styles.summaryRow}><dt>สัดส่วนสินทรัพย์เป้าหมาย</dt><dd>{targetTotal === 0 ? "ยังไม่ได้กำหนด" : `${targetTotal}%`}</dd></div>
            <div className={styles.summaryRow}><dt>ข้อมูลกองทุน</dt><dd>{searchState?.mode === "sec_live" ? "จาก ก.ล.ต." : searchState ? "ข้อมูลตัวอย่าง" : "ยังไม่ได้ค้นหา"}</dd></div>
          </dl>
          <div className={styles.statusNotice}>ระดับความเสี่ยง 1–8 แสดงแยกจากเงื่อนไขการรับเงิน และไม่ถูกรวมเป็นคะแนนความเสี่ยงของพอร์ต</div>
        </aside>
      </div>
    </section>
  );
}

function AllocationTotal({ total, label, allowZero = false, errorMessage }: { total: number; label: string; allowZero?: boolean; errorMessage?: string }) {
  const valid = total === 100 || (allowZero && total === 0);
  const width = Math.min(100, Math.max(0, total));
  const message = errorMessage ?? (valid ? (total === 0 ? "ยังไม่ได้กำหนดสัดส่วนเป้าหมาย — ทำต่อได้" : "ครบ 100%") : total < 100 ? `เหลืออีก ${Math.round((100 - total) * 100) / 100}%` : `เกินมา ${Math.round((total - 100) * 100) / 100}%`);
  return <div className={styles.totalBox} data-valid={valid}><div className={styles.totalLine}><span>{label}</span><strong>{total}%</strong></div><div className={styles.progressTrack} aria-hidden="true"><div className={styles.progressFill} style={{ width: `${width}%` }} /></div><p className={styles.validation} data-error={!valid || Boolean(errorMessage)} aria-live="polite">{message}</p></div>;
}

function ResultView({ result, onEdit, onSave, onHandoff, saveStatus }: { result: InvestmentPlanResult; onEdit: () => void; onSave: () => void; onHandoff: () => void; saveStatus: string | null }) {
  const unknownRisk = result.riskDistribution.find((row) => row.level === "unknown")?.percent ?? 0;
  return <div className={styles.resultStack}>
    <div className={styles.resultPanel}>
      <h3>สัดส่วนสินทรัพย์จากกองที่คุณเลือก</h3>
      <p>ตอนนี้ระบบระบุสินทรัพย์ได้ {result.coverage.effectiveAssetPercentKnown}% ของแผน ส่วนที่ยังไม่ทราบจะแยกไว้ชัดเจนและไม่ถูกกระจายไปยังสินทรัพย์อื่น</p>
      <div className={styles.barList}>{result.effectiveAllocation.filter((row) => row.percent > 0).map((row) => <div className={styles.barRow} key={row.key}><span className={styles.barLabel}>{EFFECTIVE_LABELS[row.key]}</span><div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${Math.min(100, row.percent)}%` }} /></div><span className={styles.barValue}>{row.percent}%</span></div>)}</div>
    </div>

    <div className={styles.resultPanel}>
      <h3>เทียบกับสัดส่วนที่คุณตั้งไว้</h3>
      {result.targetDelta.length ? <div className={styles.deltaList}>{result.targetDelta.map((row) => <div className={styles.deltaRow} key={row.asset}><strong>{ASSET_LABELS[row.asset]} · ตั้งไว้ {row.targetPercent}% / จากกองที่เลือก {row.effectivePercent}%</strong><span>{row.conclusive && row.deltaPercentagePoints !== null ? `${row.deltaPercentagePoints > 0 ? "+" : ""}${row.deltaPercentagePoints} จุดเปอร์เซ็นต์` : "ยังสรุปส่วนต่างไม่ได้ เพราะมีสินทรัพย์บางส่วนที่ยังระบุไม่ได้"}</span></div>)}</div> : <p>คุณไม่ได้กำหนดสัดส่วนสินทรัพย์เป้าหมายไว้ จึงไม่มีส่วนเปรียบเทียบในหัวข้อนี้</p>}
    </div>

    <div className={styles.resultPanel}>
      <h3>เงินอยู่ในกองความเสี่ยงระดับไหนบ้าง</h3>
      <p>แสดงตามระดับความเสี่ยง 1–8 ของกองที่คุณเลือก โดยไม่รวมออกมาเป็นคะแนนเดียวของทั้งพอร์ต</p>
      <div className={styles.riskRail}>{result.riskDistribution.filter((row) => row.level !== "unknown").map((row) => <div className={styles.riskCell} data-has-value={row.percent > 0} key={String(row.level)}><strong>{row.level}</strong><span>{row.percent}%</span></div>)}</div>
      {unknownRisk > 0 ? <p className={styles.unknownLine}>ยังไม่มีข้อมูลระดับความเสี่ยง: {unknownRisk}% ของแผน</p> : null}
    </div>

    <div className={styles.resultPanel}>
      <h3>ขายคืนแล้วรับเงินตามเงื่อนไขแบบไหน</h3>
      <p>แสดงจำนวนเงินตามแผนที่อยู่ในกองซึ่งมีเงื่อนไขรับเงินแบบต่าง ๆ โดยไม่รับประกันวันที่เงินจริงเข้าบัญชี</p>
      <div className={styles.liquidityGrid}>{result.liquiditySummary.map((row) => <div className={styles.liquidityCard} key={row.bucket}><strong>{row.bucket}</strong><span>{row.percent}% · {formatMoney(row.amount)} บาท</span></div>)}</div>
    </div>

    <div className={styles.resultPanel}><h3>ข้อควรรู้ก่อนนำผลไปใช้</h3><ul className={styles.warningList}>{result.warnings.map((warning) => <li key={warning}>{WARNING_LABELS[warning]}</li>)}</ul></div>

    <div className={styles.resultPanel}><h3>ให้ Pun ช่วยดูต่อ</h3><p>คุณสามารถปรับพอร์ตต่อ บันทึกไว้ในอุปกรณ์ หรือคัดลอกสรุปเพื่อส่งให้ Pun ดูต่อได้</p><div className={styles.resultActions}><button className={styles.ghost} type="button" onClick={onEdit}>ปรับพอร์ตต่อ</button><button className={styles.secondary} type="button" onClick={onSave}>บันทึกในอุปกรณ์นี้</button><button className={styles.primary} type="button" onClick={onHandoff}>คัดลอกสรุป + ส่งให้ Pun ช่วยดู</button></div>{saveStatus ? <p className={styles.saveStatus} role="status">{saveStatus}</p> : null}</div>
  </div>;
}
