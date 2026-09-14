'use client';

import { useEffect, useRef, useState } from 'react';
import { Edit3, MessageCircle, RefreshCw } from 'lucide-react';
import MoneyComparison from '@/components/ui/MoneyComparison';
import { trackEvent } from '@/lib/analytics';
import {
  CI_ESTIMATION_METHOD_LABELS,
  CI_LINE_OA_URL,
  CI_ASSESSMENT_VERSION,
} from '@/features/ci-planning/calculator/constants';
import type { CIEstimationMethod, CIResult as CIResultType } from '@/features/ci-planning/calculator/types';
import ResultImageDownloadButton from '@/features/ci-planning/components/ResultImageDownloadButton';

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

  return <div data-ui="human-centered-ci-result" className="mx-auto max-w-[44rem] space-y-6">
    <section className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">ผลการประเมิน</p>
      <h2 ref={resultHeadingRef} tabIndex={-1} className="mt-2 scroll-mt-28 rounded-sm text-2xl font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-3xl">ประมาณการทุนเบื้องต้น · {methodLabel}</h2>
      <output className="mt-3 block text-4xl font-semibold tabular-nums text-primary sm:text-5xl" aria-live="polite" aria-atomic="true">{baht(selectedNeed)}</output>
      <p className="mt-4 text-sm leading-6 text-white/55">{activeMethod === 'expense'
        ? 'คำนวณจากรายจ่าย ระยะเวลาที่เลือก ค่าเรียน ค่างวด และหนี้ที่กรอก'
        : 'คำนวณจากรายได้ต่อเดือนและระยะเวลาที่เลือก โดยแสดงเป็นอีกวิธีหนึ่งแยกจากทุนตามรายจ่าย'}</p>
    </section>

    {hasIncomeMethod ? <fieldset className="space-y-3" aria-describedby="ci-estimation-method-help">
      <legend className="text-sm font-medium text-foreground">เลือกวิธีดูประมาณการ</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['expense', 'income'] as const).map((method) => {
          const value = method === 'expense' ? result.calculatedNeed : result.incomeBasedNeed;
          const inputId = `ci-estimation-method-${method}`;
          const selected = activeMethod === method;
          return <label key={method} htmlFor={inputId} className={`flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 focus-within:ring-2 focus-within:ring-ring ${selected ? 'border-primary/45 bg-primary/[0.08]' : 'border-white/10 bg-white/[0.025]'}`}>
            <span className="flex items-center gap-3"><input id={inputId} type="radio" name="ci-estimation-method" value={method} checked={selected} onChange={() => setSelectedMethod(method)} className="h-4 w-4 accent-primary" /><span className="text-sm font-medium text-foreground">{CI_ESTIMATION_METHOD_LABELS[method]}</span></span>
            <span className="text-sm tabular-nums text-white/55">{baht(value)}</span>
          </label>;
        })}
      </div>
      <p id="ci-estimation-method-help" className="text-xs leading-5 text-white/45">ระบบแสดงสองวิธีแยกกันและไม่นำมาบวกกัน</p>
    </fieldset> : null}

    <MoneyComparison need={selectedNeed} resources={result.availableResources} title={`เปรียบเทียบ${methodLabel}กับทรัพยากรที่พร้อมใช้`} needLabel={methodLabel} />

    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div><p className="text-xs text-white/45">{differenceLabel}</p><p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{baht(difference)}</p></div>
        <p className="max-w-sm text-sm leading-6 text-white/50">ทรัพยากรรวม {baht(result.availableResources)} จากเงินก้อนประกันโรคร้ายแรงและสินทรัพย์สภาพคล่องที่คุณกรอก</p>
      </div>
      {displayedSurplus > 0 ? <p className="mt-3 text-xs leading-5 text-white/45">จำนวนที่สูงกว่าประมาณการนี้อ้างอิงเฉพาะสมมติฐานชุดนี้ ไม่ได้หมายความว่าความคุ้มครองทั้งหมดเพียงพอแล้ว</p> : null}
    </section>

    <details className="group border-y border-white/10 py-4">
      <summary className="cursor-pointer text-sm font-medium text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">ดูที่มาของประมาณการ</summary>
      <div className="mt-4">
        {activeMethod === 'expense' ? <dl className="grid gap-3 sm:grid-cols-3">
          <div><dt className="text-xs text-white/40">ค่าใช้จ่ายครอบครัว</dt><dd className="mt-1 font-medium tabular-nums">{baht(result.householdNeed)}</dd></div>
          <div><dt className="text-xs text-white/40">ค่าเรียนบุตร</dt><dd className="mt-1 font-medium tabular-nums">{baht(result.educationNeed)}</dd></div>
          <div><dt className="text-xs text-white/40">ภาระหนี้รวม</dt><dd className="mt-1 font-medium tabular-nums">{baht(result.debtNeed)}</dd></div>
        </dl> : <p className="text-sm leading-6 text-white/55">ทุนตามรายได้ดูจากรายได้ต่อเดือนตลอดระยะเวลาที่เลือก และแสดงแยกจากทุนตามรายจ่าย</p>}
      </div>
    </details>

    <aside className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-sm leading-6 text-white/55">
      <p className="font-medium text-foreground">ยังไม่รวมค่าใช้จ่ายระหว่างพักฟื้นโดยอัตโนมัติ</p>
      <p className="mt-2">ค่าผู้ดูแล ค่าฟื้นฟู การเดินทาง อุปกรณ์ หรือค่ารักษาส่วนที่ประกันสุขภาพไม่ครอบคลุมแตกต่างกันมาก จึงควรทบทวนแยกจากผลประมาณการนี้</p>
    </aside>

    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-center sm:p-6">
      <ResultImageDownloadButton result={result} selectedMethod={activeMethod} />
      <h3 className="mt-4 text-lg font-semibold">อยากทบทวนตัวเลขต่อ?</h3>
      <p className="mt-1 text-sm leading-6 text-white/50">บันทึกภาพสรุป แล้วส่งมาคุยรายละเอียดกับ CCPun ทาง LINE OA เมื่อพร้อม</p>
      <a href={CI_LINE_OA_URL} target="_blank" rel="noopener noreferrer" aria-label="คุยกับ CCPun ทาง LINE OA (เปิดในแท็บใหม่)" className="gold-button mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3 sm:w-auto" onClick={() => trackEvent('ci_contact_click', { tool_name: 'ci_planning', cta_location: 'ci_result', contact_channel: 'line', calculator_version: CI_ASSESSMENT_VERSION })}><MessageCircle className="h-5 w-5" aria-hidden="true" />คุยกับ CCPun ทาง LINE OA</a>
    </div>

    <p className="rounded-xl border border-white/10 bg-black/10 p-4 text-xs leading-5 text-white/45">ผลลัพธ์เป็นประมาณการเบื้องต้นจากข้อมูลและสมมติฐานที่คุณกรอก ไม่ใช่คำแนะนำเฉพาะบุคคล โปรดศึกษารายละเอียดความคุ้มครอง เงื่อนไข และข้อยกเว้นก่อนตัดสินใจ และประกันไม่ใช่เงินฝาก</p>

    <div className="grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={onEditData} className="glass-button flex min-h-12 items-center justify-center gap-2"><Edit3 className="h-4 w-4" /><span>แก้ไขข้อมูล</span></button>
      <button type="button" onClick={onReset} className="glass-button flex min-h-12 items-center justify-center gap-2"><RefreshCw className="h-4 w-4" /><span>เริ่มใหม่</span></button>
    </div>
  </div>;
}
