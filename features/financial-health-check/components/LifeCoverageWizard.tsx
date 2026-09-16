'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit3, MessageCircle, RefreshCw } from 'lucide-react';
import FHCLifeResultImageDownloadButton from '@/features/financial-health-check/components/FHCLifeResultImageDownloadButton';
import CurrencyInput from '@/components/ui/CurrencyInput';
import HumanCalculatorCard from '@/components/ui/HumanCalculatorCard';
import MoneyComparison from '@/components/ui/MoneyComparison';
import { trackEvent } from '@/lib/analytics';
import { getConsentData } from '@/lib/cookie-consent';

type Values = {
  householdMonthly: number;
  supportYears: number;
  debt: number;
  education: number;
  existingLifeCoverage: number;
  liquidAssets: number;
};

const initialValues: Values = {
  householdMonthly: 0,
  supportYears: 10,
  debt: 0,
  education: 0,
  existingLifeCoverage: 0,
  liquidAssets: 0,
};

const money = (value: number) => new Intl.NumberFormat('th-TH').format(value);

function MoneyField({ id, label, help, value, onChange, error }: { id: keyof Values; label: string; help?: string; value: number; onChange: (value: number) => void; error?: boolean }) {
  const helpId = help ? `${id}-help` : undefined;
  const describedBy = [helpId, error && 'life-calculator-error'].filter(Boolean).join(' ') || undefined;
  return <div className="space-y-2">
    <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
    <CurrencyInput id={id} value={value} onChange={onChange} placeholder="เช่น 30,000" error={error} aria-describedby={describedBy} />
    {help && <p id={helpId} className="text-xs leading-5 text-white/45">{help}</p>}
  </div>;
}

export default function LifeCoverageWizard() {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<Values>(initialValues);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<keyof Values | ''>('');
  const [showResult, setShowResult] = useState(false);
  const viewRef = useRef<HTMLElement>(null);
  const previousViewRef = useRef('1:form');

  useEffect(() => {
    const view = `${step}:${showResult ? 'result' : 'form'}`;
    if (previousViewRef.current === view) return;
    previousViewRef.current = view;
    const heading = viewRef.current?.querySelector<HTMLElement>(showResult ? 'h2' : 'h3');
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [step, showResult]);

  const landingTrackedRef = useRef(false);
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const trackedStepsRef = useRef(new Set<number>());
  useEffect(() => {
    const trackLanding = () => {
      if (landingTrackedRef.current || !getConsentData()?.analytics) return;
      if (process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED === 'true' && !document.getElementById('gtm-script')) return;
      landingTrackedRef.current = true;
      trackEvent('fhc_landing_view', { tool_name: 'fhc', cta_location: 'fhc_landing', surface_group: 'fhc' });
    };
    const queueLanding = () => queueMicrotask(trackLanding);
    queueLanding();
    window.addEventListener('ccpun:consent', queueLanding);
    window.addEventListener('ccpun:gtm-ready', queueLanding);
    return () => {
      window.removeEventListener('ccpun:consent', queueLanding);
      window.removeEventListener('ccpun:gtm-ready', queueLanding);
    };
  }, []);

  const trackStep = (stepNumber: number) => {
    if (trackedStepsRef.current.has(stepNumber)) return;
    trackedStepsRef.current.add(stepNumber);
    trackEvent('fhc_step_view', { tool_name: 'fhc', step_number: stepNumber, cta_location: 'fhc_calculator', surface_group: 'fhc' });
  };
  const trackStart = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackEvent('fhc_calculator_start', { tool_name: 'fhc', cta_location: 'fhc_calculator', surface_group: 'fhc' });
    trackStep(1);
  };
  const updateValue = (key: keyof Values, value: number) => {
    trackStart();
    setValues((old) => ({ ...old, [key]: value }));
    setError('');
    setErrorField('');
  };

  const result = useMemo(() => {
    const familySupport = values.householdMonthly * 12 * values.supportYears;
    const need = familySupport + values.debt + values.education;
    const resources = values.existingLifeCoverage + values.liquidAssets;
    return { familySupport, need, resources, gap: Math.max(need - resources, 0) };
  }, [values]);

  const fail = (field: keyof Values, message: string) => {
    setError(message);
    setErrorField(field);
    window.requestAnimationFrame(() => document.getElementById(field)?.focus());
  };

  const next = () => {
    if (step === 1 && !values.householdMonthly) { fail('householdMonthly', 'กรอกค่าใช้จ่ายครัวเรือนต่อเดือนก่อน'); return; }
    if (step === 1 && (values.supportYears < 1 || values.supportYears > 20)) { fail('supportYears', 'จำนวนปีที่ต้องการให้เงินก้อนรองรับต้องอยู่ระหว่าง 1–20 ปี'); return; }
    if (step === 1 && !Number.isSafeInteger(result.need)) { fail('householdMonthly', 'ตัวเลขสูงเกินช่วงที่เครื่องมือนี้คำนวณได้ กรุณาตรวจสอบข้อมูล'); return; }
    trackStart();
    if (step === 2) {
      if (![result.resources, result.gap].every(Number.isSafeInteger)) { fail('existingLifeCoverage', 'ตัวเลขสูงเกินช่วงที่เครื่องมือนี้คำนวณได้ กรุณาตรวจสอบข้อมูล'); return; }
      setShowResult(true);
      if (!completedRef.current) {
        completedRef.current = true;
        trackEvent('fhc_calculator_complete', { tool_name: 'fhc', step_number: 2, cta_location: 'fhc_result', surface_group: 'fhc' });
        trackEvent('fhc_result_view', { tool_name: 'fhc', cta_location: 'fhc_result', surface_group: 'fhc' });
      }
      return;
    }
    setStep(2);
    trackStep(2);
  };

  if (showResult) return <section ref={viewRef} aria-labelledby="life-result-title" data-ui="human-centered-fhc-result" className="ccpun-calculator-result">
    <div className="ccpun-calculator-result-lead">
      <p className="ccpun-calculator-result-eyebrow">ผลการประเมิน</p>
      <h2 id="life-result-title" tabIndex={-1} className="ccpun-calculator-result-title scroll-mt-28 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">ช่องว่างความคุ้มครอง<span className="whitespace-nowrap">เบื้องต้น</span><span className="sr-only"> {money(result.gap)} บาท</span></h2>
      <p className="ccpun-calculator-result-amount">{money(result.gap)} <small>บาท</small></p>
      <p className="ccpun-calculator-result-body">ส่วนต่างระหว่างภาระที่คุณกรอก กับทุนประกันชีวิตและสินทรัพย์ที่ตั้งใจใช้ ไม่ใช่วงเงินที่ควรซื้อโดยอัตโนมัติ</p>
    </div>

    <MoneyComparison need={result.need} resources={result.resources} title="ภาระที่ต้องดูแลเทียบกับทรัพยากรที่พร้อมใช้" needLabel="ภาระตามข้อมูลที่กรอก" />

    <dl className="ccpun-calculator-result-rows">
      <div className="ccpun-calculator-result-row"><dt>ค่าใช้จ่ายครอบครัวตามช่วงเวลาที่เลือก</dt><dd>{money(result.familySupport)} บาท</dd></div>
      <div className="ccpun-calculator-result-row"><dt>หนี้และทุนการศึกษาบุตร</dt><dd>{money(values.debt + values.education)} บาท</dd></div>
      <div className="ccpun-calculator-result-row"><dt>ทุนประกันชีวิตและสินทรัพย์ที่พร้อมใช้</dt><dd>{money(result.resources)} บาท</dd></div>
    </dl>

    <div className="ccpun-calculator-result-notice">ผลลัพธ์เป็นประมาณการเบื้องต้นจากข้อมูลที่คุณกรอก ไม่ใช่คำแนะนำเฉพาะบุคคล ไม่รับรองว่าจำนวนเงินนี้จะเพียงพอในทุกกรณี และประกันไม่ใช่เงินฝาก</div>

    <div className="ccpun-calculator-result-cta">
      <FHCLifeResultImageDownloadButton summary={{ familySupport: result.familySupport, debtAndEducation: values.debt + values.education, resources: result.resources, gap: result.gap }} />
      <h3>อยากทบทวนตัวเลขต่อ?</h3>
      <p>บันทึกภาพนี้ไว้ แล้วส่งมาคุยกับ CCPun ทาง LINE OA ได้เมื่อพร้อม</p>
      <a href="https://lin.ee/tqLCs4f" target="_blank" rel="noreferrer" aria-label="คุยกับ CCPun ทาง LINE OA (เปิดในแท็บใหม่)" onClick={() => trackEvent('fhc_contact_click', { tool_name: 'fhc', contact_channel: 'line', cta_location: 'fhc_result', surface_group: 'fhc' })} className="gold-button mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3 sm:w-auto"><MessageCircle className="h-5 w-5" aria-hidden="true" />คุยกับ CCPun ทาง LINE OA</a>
    </div>

    <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => { setShowResult(false); setError(''); setErrorField(''); }} className="glass-button flex min-h-12 items-center justify-center gap-2"><Edit3 className="h-4 w-4" aria-hidden="true" />แก้ไขข้อมูล</button><button type="button" onClick={() => { setValues(initialValues); setStep(1); setShowResult(false); setError(''); setErrorField(''); startedRef.current = false; completedRef.current = false; trackedStepsRef.current.clear(); }} className="glass-button flex min-h-12 items-center justify-center gap-2"><RefreshCw className="h-4 w-4" aria-hidden="true" />เริ่มใหม่</button></div>
  </section>;

  const educationOpen = values.education > 0 || errorField === 'education';
  const footer = <div className="flex items-center gap-3">{step === 2 ? <button type="button" onClick={() => { setStep(1); setError(''); setErrorField(''); }} className="glass-button inline-flex min-h-11 items-center gap-2 px-4"><ChevronLeft className="h-4 w-4" aria-hidden="true" />ย้อนกลับ</button> : <span className="flex-1" />}<button type="submit" className="gold-button ml-auto inline-flex min-h-11 flex-1 items-center justify-center gap-2 px-5 sm:flex-none sm:min-w-44">{step === 1 ? 'ถัดไป' : 'ดูผลการคำนวณ'}<ChevronRight className="h-4 w-4" aria-hidden="true" /></button></div>;

  return <section ref={viewRef}>
    <form noValidate onSubmit={(event) => { event.preventDefault(); next(); }}>
      <HumanCalculatorCard step={step} total={2} labelledBy={`fhc-step-${step}-title`} title={step === 1 ? 'ภาระที่ต้องดูแล' : 'ทรัพยากรที่พร้อมใช้'} description={step === 1 ? 'เริ่มจาก 3 ข้อมูลหลัก ส่วนทุนการศึกษาบุตรเพิ่มได้เมื่อมี' : 'กรอกเฉพาะเงินก้อนที่ตั้งใจนำมาใช้ในแผนนี้'} footer={footer}>
        {error ? <p id="life-calculator-error" role="alert" className="rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p> : null}
        {step === 1 ? <>
          <MoneyField id="householdMonthly" label="ค่าใช้จ่ายครัวเรือนต่อเดือน" help="กรอกหลังหักรายได้อื่นที่ยังมีอยู่แล้ว" value={values.householdMonthly} onChange={(value) => updateValue('householdMonthly', value)} error={errorField === 'householdMonthly'} />
          <fieldset className="space-y-2"><legend className="text-sm font-medium text-foreground">จำนวนปีที่ต้องการให้เงินก้อนรองรับ</legend><div className="flex items-center justify-between text-xs text-white/45"><span>1 ปี</span><output htmlFor="supportYears" className="text-base font-semibold tabular-nums text-primary">{values.supportYears} ปี</output><span>20 ปี</span></div><input id="supportYears" type="range" min="1" max="20" step="1" value={values.supportYears} onChange={(event) => updateValue('supportYears', Number(event.target.value))} aria-invalid={errorField === 'supportYears' || undefined} aria-describedby={errorField === 'supportYears' ? 'supportYears-help life-calculator-error' : 'supportYears-help'} aria-label="จำนวนปีที่ต้องการให้เงินก้อนรองรับ" className="min-h-11 w-full cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /><p id="supportYears-help" className="text-xs leading-5 text-white/45">ปรับได้ 1–20 ปี</p></fieldset>
          <MoneyField id="debt" label="หนี้คงเหลือทั้งหมด (ถ้ามี)" help="รวมบ้าน รถ บัตรเครดิต และสินเชื่อที่ต้องการให้เงินก้อนนี้รองรับ" value={values.debt} onChange={(value) => updateValue('debt', value)} error={errorField === 'debt'} />
          <details open={educationOpen} className="group border-t border-white/10 pt-4"><summary className="cursor-pointer text-sm font-medium text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">เพิ่มทุนการศึกษาบุตร (ถ้ามี)</summary><div className="mt-4"><MoneyField id="education" label="ทุนการศึกษารวมที่ต้องการเตรียม" help="รวมค่าเล่าเรียนและค่าใช้จ่ายที่ตั้งใจดูแล" value={values.education} onChange={(value) => updateValue('education', value)} error={errorField === 'education'} /></div></details>
        </> : <>
          <MoneyField id="existingLifeCoverage" label="ทุนประกันชีวิตที่มีอยู่" help="กรอกเฉพาะทุนที่ตั้งใจให้ครอบครัวใช้ตามแผนนี้" value={values.existingLifeCoverage} onChange={(value) => updateValue('existingLifeCoverage', value)} error={errorField === 'existingLifeCoverage'} />
          <MoneyField id="liquidAssets" label="สินทรัพย์สภาพคล่องที่ตั้งใจใช้" help="ไม่หักเงินสำรองฉุกเฉินโดยอัตโนมัติ เพื่อไม่ให้นับเงินก้อนเดียวซ้ำ" value={values.liquidAssets} onChange={(value) => updateValue('liquidAssets', value)} error={errorField === 'liquidAssets'} />
        </>}
      </HumanCalculatorCard>
    </form>
  </section>;
}
