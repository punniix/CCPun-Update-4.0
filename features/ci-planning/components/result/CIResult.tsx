'use client';

import { useEffect, useRef, useState } from 'react';
import { Edit3, ExternalLink, MessageCircle, RefreshCw } from 'lucide-react';
import MoneyComparison from '@/components/ui/MoneyComparison';
import { trackEvent } from '@/lib/analytics';
import {
  CI_ESTIMATION_METHOD_LABELS,
  CI_LINE_OA_URL,
  CI_ASSESSMENT_VERSION,
} from '@/features/ci-planning/calculator/constants';
import type { CIEstimationMethod, CIResult as CIResultType } from '@/features/ci-planning/calculator/types';
import ResultImageDownloadButton from '@/features/ci-planning/components/ResultImageDownloadButton';
import { CI_RECOVERY_SOURCES, getRecoveryModeLabel } from '@/features/ci-planning/recovery-evidence';

interface CIResultProps {
  result: CIResultType;
  onEditData: () => void;
  onReset: () => void;
}

function baht(value: number) {
  return `${Math.round(value).toLocaleString('th-TH')} บาท`;
}

function getDefaultEstimationMethod(result: CIResultType): CIEstimationMethod {
  if (result.calculatedNeed > 0) return 'expense';
  if (result.incomeBasedNeed > 0) return 'income';
  return 'expense';
}

export default function CIResult({ result, onEditData, onReset }: CIResultProps) {
  const [selectedMethod, setSelectedMethod] = useState<CIEstimationMethod>(() => getDefaultEstimationMethod(result));
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const hasTrackedResultViewRef = useRef(false);

  const expenseBaseNeed = result.expenseBaseNeed ?? Math.max(result.calculatedNeed - result.recoveryReserveNeed - result.protectedAssetsNeed, 0);
  const incomeBaseNeed = result.incomeBaseNeed ?? Math.max(result.incomeBasedNeed - result.recoveryReserveNeed - result.protectedAssetsNeed, 0);

  const availableMethods: CIEstimationMethod[] = [
    ...(expenseBaseNeed > 0 ? ['expense' as const] : []),
    ...(incomeBaseNeed > 0 ? ['income' as const] : []),
  ];

  const activeMethod = availableMethods.includes(selectedMethod)
    ? selectedMethod
    : (availableMethods[0] ?? 'expense');

  const methodLabel = CI_ESTIMATION_METHOD_LABELS[activeMethod];
  const selectedBaseNeed = activeMethod === 'income' ? incomeBaseNeed : expenseBaseNeed;
  const selectedNeed = activeMethod === 'income' ? result.incomeBasedNeed : result.calculatedNeed;
  const displayedGap = activeMethod === 'income' ? result.incomeShortfall : result.shortfall;
  const displayedSurplus = activeMethod === 'income' ? result.incomeSurplus : result.surplus;

  useEffect(() => {
    resultHeadingRef.current?.scrollIntoView({ block: 'center' });
    resultHeadingRef.current?.focus({ preventScroll: true });
    if (hasTrackedResultViewRef.current) return;
    hasTrackedResultViewRef.current = true;
    trackEvent('ci_result_view', {
      tool_name: 'ci_planning',
      cta_location: 'ci_result',
      calculator_version: CI_ASSESSMENT_VERSION,
    });
  }, []);

  const difference = displayedGap > 0 ? displayedGap : displayedSurplus;
  const differenceLabel = displayedGap > 0
    ? 'ทุนที่ยังขาด'
    : displayedSurplus > 0
      ? 'ทรัพยากรที่มีมากกว่าประมาณการ'
      : 'ส่วนต่างจากประมาณการ';

  const recoveryRowCandidates: Array<[string, number]> = [
    [`ติดตามรักษา ${result.recoveryTreatmentVisits} ครั้ง × ${baht(result.recoveryTreatmentVisitUnitCost)}`, result.recoveryVisitNeed],
    [`ผู้ดูแล ${result.recoveryCaregiverHomeDays} วัน × ${baht(result.recoveryCaregiverDailyCost)}`, result.recoveryCaregiverHomeNeed],
    [`กายภาพ/ฟื้นฟู ${result.recoveryRehabSessions} ครั้ง × ${baht(result.recoveryRehabUnitCost)}`, result.recoveryRehabNeed],
    ['เครื่องวัดออกซิเจนปลายนิ้ว', result.recoveryPulseOximeter],
    ['เครื่องวัดความดัน', result.recoveryBloodPressureMonitor],
    ['เครื่องวัดอุณหภูมิ', result.recoveryThermometer],
    ['Walker / อุปกรณ์ช่วยเดิน', result.recoveryWalker],
    ['Wheelchair', result.recoveryWheelchair],
    ['เก้าอี้อาบน้ำ / อุปกรณ์ห้องน้ำ', result.recoveryShowerChair],
    ['ราวจับและอุปกรณ์ความปลอดภัย', result.recoveryGrabRailAndSafety],
    ['เตียงผู้ป่วย / อุปกรณ์ก้อนใหญ่', result.recoveryHospitalBed],
    ['ของใช้สิ้นเปลือง', result.recoveryConsumables],
    ['ปรับบ้านเดิม / พื้นที่ใช้งาน', result.recoveryHomeAdaptation],
    ['Major Housing Reserve', result.recoveryMajorHousing],
    ['เงินเผื่อความคลาดเคลื่อน', result.recoveryContingency],
    ['ค่าใช้จ่ายอื่นช่วงพักฟื้น', result.recoveryOtherCosts],
  ];
  const recoveryRows = recoveryRowCandidates.filter(([, amount]) => amount > 0);

  return <div data-ui="human-centered-ci-result" className="ccpun-calculator-result ccpun-motion-result-reveal">
    <section className="ccpun-calculator-result-lead">
      <p className="ccpun-calculator-result-eyebrow">ผลการประเมิน</p>
      <h2
        ref={resultHeadingRef}
        tabIndex={-1}
        className="ccpun-calculator-result-title scroll-mt-28 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ประมาณการทุนเบื้องต้น · {methodLabel}
      </h2>
      <output className="ccpun-calculator-result-amount" aria-live="polite" aria-atomic="true">{baht(selectedNeed)}</output>
      <p className="ccpun-calculator-result-body">
        ยอดรวมนี้ = {baht(selectedBaseNeed)} จาก{activeMethod === 'expense' ? 'รายจ่ายและภาระที่กรอก' : 'รายได้ตามช่วงเวลาที่เลือก'} + Recovery Reserve {baht(result.recoveryReserveNeed)}{result.protectedAssetsNeed > 0 ? ` + เป้าหมายรักษาสินทรัพย์ ${baht(result.protectedAssetsNeed)}` : ''} โดยบวกแต่ละส่วนเพียง 1 ครั้ง
      </p>
    </section>

    {availableMethods.length > 1 ? <fieldset className="space-y-3" aria-describedby="ci-estimation-method-help">
      <legend className="ccpun-calculator-result-panel-title">เลือกวิธีดูประมาณการ</legend>
      <div className="ccpun-calculator-result-method-grid">
        {availableMethods.map((method) => {
          const value = method === 'expense' ? result.calculatedNeed : result.incomeBasedNeed;
          const inputId = `ci-estimation-method-${method}`;
          const selected = activeMethod === method;
          return <label key={method} htmlFor={inputId} className={`ccpun-calculator-result-method ccpun-motion-selection ${selected ? 'ccpun-calculator-result-method-selected ccpun-motion-selection-active' : ''} focus-within:ring-2 focus-within:ring-ring`}>
            <span className="flex items-center gap-3">
              <input
                id={inputId}
                type="radio"
                name="ci-estimation-method"
                value={method}
                checked={selected}
                onChange={() => setSelectedMethod(method)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm font-medium">{CI_ESTIMATION_METHOD_LABELS[method]}</span>
            </span>
            <span className="text-sm tabular-nums" style={{ color: 'var(--w43-muted)' }}>{baht(value)}</span>
          </label>;
        })}
      </div>
      <p id="ci-estimation-method-help" className="ccpun-calculator-result-body">
        ระบบแสดงสองวิธีแยกกันและไม่นำมาบวกกัน แต่ละวิธีเริ่มจากฐานตามรายจ่ายหรือรายได้ แล้วบวก Recovery Reserve 1 ครั้ง
        {result.protectedAssetsNeed > 0 ? ' และเป้าหมายรักษาสินทรัพย์อีก 1 ครั้ง' : ''}
      </p>
    </fieldset> : null}

    <MoneyComparison
      need={selectedNeed}
      resources={result.availableResources}
      title={`เปรียบเทียบ${methodLabel}กับทุนที่มี`}
      needLabel={methodLabel}
      resourcesLabel="ทุนที่มี"
    />

    <section className="ccpun-calculator-result-panel">
      <p className="ccpun-calculator-result-eyebrow">{differenceLabel}</p>
      <p className="ccpun-calculator-result-difference mt-1 font-semibold tabular-nums">{baht(difference)}</p>
      <p className="ccpun-calculator-result-body">
        ทุนที่มีรวม {baht(result.availableResources)} จากเงินก้อนประกันโรคร้ายแรงและสินทรัพย์สภาพคล่องที่คุณกรอก
      </p>
      {result.protectedAssetsNeed > 0 ? <p className="ccpun-calculator-result-body">
        คุณเลือกเก็บสินทรัพย์สภาพคล่อง {baht(result.protectedAssetsNeed)} ไว้ ระบบจึงเพิ่มเป้าหมายทุนเท่ากับยอดนี้ 1 ครั้ง เพื่อให้เห็นส่วนขาดหลังเผื่อรักษาสินทรัพย์ก้อนเดิม
      </p> : null}
      {displayedSurplus > 0 ? <p className="ccpun-calculator-result-body">
        จำนวนที่สูงกว่าประมาณการนี้อ้างอิงเฉพาะสมมติฐานชุดนี้ ไม่ได้หมายความว่าความคุ้มครองทั้งหมดเพียงพอแล้ว
      </p> : null}
      <details className="ccpun-calculator-result-details">
        <summary className="focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">ดูที่มาของประมาณการ</summary>
        <div className="mt-4">
          {activeMethod === 'expense' ? <dl className="ccpun-calculator-result-rows ccpun-calculator-result-breakdown">
            <div className="ccpun-calculator-result-row"><dt>ค่าใช้จ่ายครอบครัว</dt><dd>{baht(result.householdNeed)}</dd></div>
            <div className="ccpun-calculator-result-row"><dt>ค่าเรียนบุตร</dt><dd>{baht(result.educationNeed)}</dd></div>
            <div className="ccpun-calculator-result-row"><dt>ภาระหนี้รวม</dt><dd>{baht(result.debtNeed)}</dd></div>
            <div className="ccpun-calculator-result-row"><dt>Recovery Reserve</dt><dd>{baht(result.recoveryReserveNeed)}</dd></div>
            {result.protectedAssetsNeed > 0 ? <div className="ccpun-calculator-result-row"><dt>เป้าหมายรักษาสินทรัพย์</dt><dd>{baht(result.protectedAssetsNeed)}</dd></div> : null}
          </dl> : <dl className="ccpun-calculator-result-rows ccpun-calculator-result-breakdown">
            <div className="ccpun-calculator-result-row"><dt>ทุนตามรายได้ก่อน Recovery</dt><dd>{baht(incomeBaseNeed)}</dd></div>
            <div className="ccpun-calculator-result-row"><dt>Recovery Reserve</dt><dd>{baht(result.recoveryReserveNeed)}</dd></div>
            {result.protectedAssetsNeed > 0 ? <div className="ccpun-calculator-result-row"><dt>เป้าหมายรักษาสินทรัพย์</dt><dd>{baht(result.protectedAssetsNeed)}</dd></div> : null}
          </dl>}
        </div>
      </details>
    </section>

    <section className="ccpun-calculator-result-panel" aria-labelledby="ci-recovery-result-title">
      <p className="ccpun-calculator-result-eyebrow">เงินสำรองสำหรับรักษา ฟื้นฟู และปรับการใช้ชีวิต</p>
      <h3 id="ci-recovery-result-title" className="ccpun-calculator-result-panel-title mt-1">
        {getRecoveryModeLabel(result.recoveryMode)}
      </h3>
      <p className="mt-2 text-3xl font-semibold tabular-nums" style={{ color: 'var(--w43-gold)' }}>
        {baht(result.recoveryReserveNeed)}
      </p>
      <p className="ccpun-calculator-result-body">
        ก้อนนี้แยกจากรายได้ ค่าใช้จ่ายประจำ ค่าเรียน และหนี้ แล้วบวกเพิ่มเพียง 1 ครั้งในวิธีคำนวณที่เลือก
      </p>

      {result.recoveryReserveNeed > 0 ? (
        <details className="mt-4 border-t pt-4" style={{ borderColor: 'var(--w43-border)' }}>
          <summary className="cursor-pointer text-sm font-medium focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            ดูรายละเอียด Recovery Reserve
          </summary>
          <div className="mt-4 space-y-4">
            <dl className="ccpun-calculator-result-rows">
              {recoveryRows.map(([label, amount]) => (
                <div key={label} className="ccpun-calculator-result-row">
                  <dt>{label}</dt>
                  <dd>{baht(amount)}</dd>
                </div>
              ))}
              <div className="ccpun-calculator-result-row">
                <dt>รวมรายละเอียด</dt>
                <dd>{baht(result.recoveryBreakdownTotal)}</dd>
              </div>
            </dl>

            {result.recoveryUnallocated > 0 ? <p className="ccpun-calculator-result-body">
              จากยอดที่ตั้งไว้ ยังมีเงินที่ไม่ได้จัดสรรในรายการย่อย {baht(result.recoveryUnallocated)}
            </p> : null}

            {result.recoveryOverBudget > 0 ? <p className="ccpun-calculator-result-body" style={{ color: 'var(--destructive)' }}>
              รายละเอียดย่อยสูงกว่าเงินสำรองที่ตั้งไว้ {baht(result.recoveryOverBudget)} ผลรวมหลักยังใช้เงินสำรองที่คุณยืนยันไว้
            </p> : null}

            {result.recoveryMajorHousing > 0 ? <p className="ccpun-calculator-result-body">
              Major Housing Reserve เป็นทางเลือกเผื่อกรณีต้องปรับโครงสร้าง ต่อเติม เปลี่ยนพื้นที่อยู่อาศัย หรือจัดที่อยู่อาศัยใหม่
              ไม่ได้หมายความว่าต้องเกิดค่าใช้จ่ายทุกประเภทพร้อมกัน และไม่รวมราคาที่ดิน
            </p> : null}
          </div>
        </details>
      ) : <p className="ccpun-calculator-result-body">ไม่ได้รวม Recovery Reserve ในการประเมินครั้งนี้</p>}

      <details className="mt-4 border-t pt-4" style={{ borderColor: 'var(--w43-border)' }}>
        <summary className="cursor-pointer text-sm font-medium">ที่มาของตัวเลขประมาณการ</summary>
        <div className="mt-3 space-y-3 text-xs leading-5" style={{ color: 'var(--w43-muted)' }}>
          <p>
            ตัวเลขของชุดประมาณการเป็น planning benchmark ที่ปัดเผื่อเพื่อวางเงินสำรอง ไม่ใช่ราคาค่าบริการตายตัว
            และไม่ใช่คำแนะนำทางการแพทย์ว่าทุกคนต้องใช้รายการเดียวกัน
          </p>
          {CI_RECOVERY_SOURCES.map((source) => <p key={source.id}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1"
              style={{ color: 'var(--w43-gold)' }}
            >
              {source.publisher} · {source.year}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <br />
            {source.note}
          </p>)}
        </div>
      </details>
    </section>

    <div className="ccpun-calculator-result-cta ccpun-ci-result-cta">
      <div className="ccpun-ci-result-cta-inner">
        <h3>อยากทบทวนตัวเลขต่อ?</h3>
        <p className="ccpun-ci-result-cta-copy">แชร์ภาพผลลัพธ์แล้วเลือกแชต LINE OA ของ CCPun หรือบันทึกภาพไว้แนบในแชตด้วยตัวเอง</p>
        <ResultImageDownloadButton result={result} selectedMethod={activeMethod} />
        <a
          href={CI_LINE_OA_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="คุยกับ CCPun ทาง LINE OA (เปิดในแท็บใหม่)"
          className="gold-button ccpun-motion-tactile ccpun-ci-result-cta-line inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3"
          onClick={() => trackEvent('ci_contact_click', {
            tool_name: 'ci_planning',
            cta_location: 'ci_result',
            contact_channel: 'line',
            calculator_version: CI_ASSESSMENT_VERSION,
          })}
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          ไปที่ LINE OA เพื่อส่งภาพ
        </a>
      </div>
    </div>

    <p className="ccpun-calculator-result-notice">
      ผลลัพธ์เป็นประมาณการเบื้องต้นจากข้อมูลและสมมติฐานที่คุณกรอก ไม่ใช่คำแนะนำเฉพาะบุคคล
      โปรดศึกษารายละเอียดความคุ้มครอง เงื่อนไข และข้อยกเว้นก่อนตัดสินใจ และประกันไม่ใช่เงินฝาก
    </p>

    <div className="grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={onEditData} className="glass-button ccpun-motion-tactile flex min-h-12 items-center justify-center gap-2">
        <Edit3 className="h-4 w-4" />
        <span>แก้ไขข้อมูล</span>
      </button>
      <button type="button" onClick={onReset} className="glass-button ccpun-motion-tactile flex min-h-12 items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4" />
        <span>เริ่มใหม่</span>
      </button>
    </div>
  </div>;
}
