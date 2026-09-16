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
import { CI_RECOVERY_REFERENCE, CI_RECOVERY_SOURCES } from '@/features/ci-planning/recovery-evidence';

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
  const hasIncomeMethod = result.incomeBasedNeed > 0;
  const activeMethod = selectedMethod === 'income' && hasIncomeMethod ? 'income' : 'expense';
  const methodLabel = CI_ESTIMATION_METHOD_LABELS[activeMethod];
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

  return <div data-ui="human-centered-ci-result" className="ccpun-calculator-result">
    <section className="ccpun-calculator-result-lead">
      <p className="ccpun-calculator-result-eyebrow">ผลการประเมิน</p>
      <h2 ref={resultHeadingRef} tabIndex={-1} className="ccpun-calculator-result-title scroll-mt-28 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">ประมาณการทุนเบื้องต้น · {methodLabel}</h2>
      <output className="ccpun-calculator-result-amount" aria-live="polite" aria-atomic="true">{baht(selectedNeed)}</output>
      <p className="ccpun-calculator-result-body">{activeMethod === 'expense'
        ? (result.recoveryReserveNeed > 0 ? 'คำนวณจากรายจ่าย ระยะเวลาที่เลือก ค่าเรียน ค่างวด หนี้ และ Recovery Reserve ที่คุณกรอก' : 'คำนวณจากรายจ่าย ระยะเวลาที่เลือก ค่าเรียน ค่างวด และหนี้ที่กรอก โดย Recovery Reserve ยังเป็น 0')
        : 'คำนวณจากรายได้ต่อเดือนและระยะเวลาที่เลือก โดยแสดงเป็นอีกวิธีหนึ่งแยกจากทุนตามรายจ่าย'}</p>
    </section>

    {hasIncomeMethod ? <fieldset className="space-y-3" aria-describedby="ci-estimation-method-help">
      <legend className="ccpun-calculator-result-panel-title">เลือกวิธีดูประมาณการ</legend>
      <div className="ccpun-calculator-result-method-grid">
        {(['expense', 'income'] as const).map((method) => {
          const value = method === 'expense' ? result.calculatedNeed : result.incomeBasedNeed;
          const inputId = `ci-estimation-method-${method}`;
          const selected = activeMethod === method;
          return <label key={method} htmlFor={inputId} className={`ccpun-calculator-result-method ${selected ? 'ccpun-calculator-result-method-selected' : ''} focus-within:ring-2 focus-within:ring-ring`}>
            <span className="flex items-center gap-3"><input id={inputId} type="radio" name="ci-estimation-method" value={method} checked={selected} onChange={() => setSelectedMethod(method)} className="h-4 w-4 accent-primary" /><span className="text-sm font-medium">{CI_ESTIMATION_METHOD_LABELS[method]}</span></span>
            <span className="text-sm tabular-nums" style={{ color: 'var(--w43-muted)' }}>{baht(value)}</span>
          </label>;
        })}
      </div>
      <p id="ci-estimation-method-help" className="ccpun-calculator-result-body">ระบบแสดงสองวิธีแยกกันและไม่นำมาบวกกัน Recovery Reserve ถูกบวกเฉพาะทุนตามรายจ่าย ส่วนทุนตามรายได้ไม่บวกซ้ำเพื่อหลีกเลี่ยงการนับผลกระทบรายได้ซ้ำ</p>
    </fieldset> : null}

    <MoneyComparison need={selectedNeed} resources={result.availableResources} title={`เปรียบเทียบ${methodLabel}กับทรัพยากรที่พร้อมใช้`} needLabel={methodLabel} />

    <section className="ccpun-calculator-result-panel">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div><p className="ccpun-calculator-result-eyebrow">{differenceLabel}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{baht(difference)}</p></div>
        <p className="ccpun-calculator-result-body">ทรัพยากรรวม {baht(result.availableResources)} จากเงินก้อนประกันโรคร้ายแรงและสินทรัพย์สภาพคล่องที่คุณกรอก</p>
      </div>
      {displayedSurplus > 0 ? <p className="ccpun-calculator-result-body">จำนวนที่สูงกว่าประมาณการนี้อ้างอิงเฉพาะสมมติฐานชุดนี้ ไม่ได้หมายความว่าความคุ้มครองทั้งหมดเพียงพอแล้ว</p> : null}
    </section>

    <details className="ccpun-calculator-result-details">
      <summary className="focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">ดูที่มาของประมาณการ</summary>
      <div className="mt-4">
        {activeMethod === 'expense' ? <dl className="grid gap-3 sm:grid-cols-4">
          <div><dt className="ccpun-calculator-result-eyebrow">ค่าใช้จ่ายครอบครัว</dt><dd className="mt-1 font-medium tabular-nums">{baht(result.householdNeed)}</dd></div>
          <div><dt className="ccpun-calculator-result-eyebrow">ค่าเรียนบุตร</dt><dd className="mt-1 font-medium tabular-nums">{baht(result.educationNeed)}</dd></div>
          <div><dt className="ccpun-calculator-result-eyebrow">ภาระหนี้รวม</dt><dd className="mt-1 font-medium tabular-nums">{baht(result.debtNeed)}</dd></div>
          <div><dt className="ccpun-calculator-result-eyebrow">Recovery Reserve</dt><dd className="mt-1 font-medium tabular-nums">{baht(result.recoveryReserveNeed)}</dd></div>
        </dl> : <p className="ccpun-calculator-result-body">ทุนตามรายได้ดูจากรายได้ต่อเดือนตลอดระยะเวลาที่เลือก โดยไม่บวก Recovery Reserve ซ้ำ หากต้องการเผื่อค่าใช้จ่ายนอกโรงพยาบาลให้ดูตัวเลข Recovery Reserve แยกด้านล่าง</p>}
      </div>
    </details>

    <section className="ccpun-calculator-result-panel" aria-labelledby="ci-recovery-result-title">
      <p className="ccpun-calculator-result-eyebrow">Add-on สำหรับค่าใช้จ่ายนอกโรงพยาบาล</p>
      <h3 id="ci-recovery-result-title" className="ccpun-calculator-result-panel-title mt-1">Recovery Reserve · {baht(result.recoveryReserveNeed)}</h3>
      {result.recoveryReserveNeed > 0 ? <>
        <dl className="ccpun-calculator-result-rows mt-4">
          <div className="ccpun-calculator-result-row"><dt>ไปรักษา/ติดตาม {result.recoveryTreatmentVisits} ครั้ง × {baht(CI_RECOVERY_REFERENCE.treatmentVisit.total)}</dt><dd>{baht(result.recoveryVisitNeed)}</dd></div>
          <div className="ccpun-calculator-result-row"><dt>ผู้ดูแลที่บ้าน {result.recoveryCaregiverHomeDays} วัน × {baht(CI_RECOVERY_REFERENCE.caregiverHomePerDay)}</dt><dd>{baht(result.recoveryCaregiverHomeNeed)}</dd></div>
          <div className="ccpun-calculator-result-row"><dt>กายภาพ {result.recoveryRehabSessions} ครั้ง (ที่บ้าน {result.recoveryHomeRehabSessions} ครั้ง)</dt><dd>{baht(result.recoveryRehabNeed)}</dd></div>
          <div className="ccpun-calculator-result-row"><dt>อุปกรณ์/ปรับบ้าน</dt><dd>{baht(result.recoveryEquipmentAndHomeModification)}</dd></div>
          <div className="ccpun-calculator-result-row"><dt>ค่าใช้จ่ายอื่นช่วงพักฟื้น</dt><dd>{baht(result.recoveryOtherCosts)}</dd></div>
        </dl>
      </> : <p className="ccpun-calculator-result-body">ยังไม่ได้รวมค่าใช้จ่ายช่วงรักษาและพักฟื้น เพราะคุณยังไม่ได้กรอกจำนวนครั้ง/วันหรือค่าใช้จ่ายใน Recovery Reserve</p>}
      <details className="mt-4 border-t pt-4" style={{ borderColor: 'var(--w43-border)' }}>
        <summary className="cursor-pointer text-sm font-medium">ที่มาของตัวเลข (ข้อมูลปี 2025–2026)</summary>
        <div className="mt-3 space-y-3 text-xs leading-5" style={{ color: 'var(--w43-muted)' }}>
          {CI_RECOVERY_SOURCES.map((source) => <p key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1" style={{ color: 'var(--w43-gold)' }}>{source.publisher} · {source.year}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a><br />{source.note}</p>)}
        </div>
      </details>
    </section>

    <div className="ccpun-calculator-result-cta">
      <ResultImageDownloadButton result={result} selectedMethod={activeMethod} />
      <h3>อยากทบทวนตัวเลขต่อ?</h3>
      <p>บันทึกภาพสรุป แล้วส่งมาคุยรายละเอียดกับ CCPun ทาง LINE OA เมื่อพร้อม</p>
      <a href={CI_LINE_OA_URL} target="_blank" rel="noopener noreferrer" aria-label="คุยกับ CCPun ทาง LINE OA (เปิดในแท็บใหม่)" className="gold-button mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3 sm:w-auto" onClick={() => trackEvent('ci_contact_click', { tool_name: 'ci_planning', cta_location: 'ci_result', contact_channel: 'line', calculator_version: CI_ASSESSMENT_VERSION })}><MessageCircle className="h-5 w-5" aria-hidden="true" />คุยกับ CCPun ทาง LINE OA</a>
    </div>

    <p className="ccpun-calculator-result-notice">ผลลัพธ์เป็นประมาณการเบื้องต้นจากข้อมูลและสมมติฐานที่คุณกรอก ไม่ใช่คำแนะนำเฉพาะบุคคล โปรดศึกษารายละเอียดความคุ้มครอง เงื่อนไข และข้อยกเว้นก่อนตัดสินใจ และประกันไม่ใช่เงินฝาก</p>

    <div className="grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={onEditData} className="glass-button flex min-h-12 items-center justify-center gap-2"><Edit3 className="h-4 w-4" /><span>แก้ไขข้อมูล</span></button>
      <button type="button" onClick={onReset} className="glass-button flex min-h-12 items-center justify-center gap-2"><RefreshCw className="h-4 w-4" /><span>เริ่มใหม่</span></button>
    </div>
  </div>;
}
