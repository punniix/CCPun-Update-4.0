'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit3, MessageCircle, RefreshCw, Shield, Wallet } from 'lucide-react';
import FHCLifeResultImageDownloadButton from '@/features/financial-health-check/components/FHCLifeResultImageDownloadButton';
import CurrencyInput from '@/components/ui/CurrencyInput';
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
    <label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</label>
    <CurrencyInput id={id} value={value} onChange={onChange} placeholder="เช่น 30,000" error={error} aria-describedby={describedBy} />
    {help && <p id={helpId} className="text-sm leading-relaxed text-muted-foreground">{help}</p>}
  </div>;
}

export default function LifeCoverageWizard({ subtleMotion = false }: { subtleMotion?: boolean } = {}) {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<Values>(initialValues);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<keyof Values | ''>('');
  const [showResult, setShowResult] = useState(false);
  const landingTrackedRef = useRef(false);
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const trackedStepsRef = useRef(new Set<number>());
  const stepPanelRef = useRef<HTMLDivElement>(null);
  const previousStepRef = useRef(step);
  useEffect(() => {
    const previous = previousStepRef.current;
    previousStepRef.current = step;
    const panel = stepPanelRef.current;
    if (!subtleMotion || showResult || previous === step || !panel) return;
    const heading = panel.querySelector<HTMLElement>('h3');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches || typeof panel.animate !== 'function') return;
    const animation = panel.animate(
      [{ opacity: 0.85, translate: `${step > previous ? 12 : -12}px 0` }, { opacity: 1, translate: '0 0' }],
      { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    );
    const stop = () => { if (preference.matches) animation.cancel(); };
    preference.addEventListener('change', stop);
    return () => { animation.cancel(); preference.removeEventListener('change', stop); };
  }, [step, showResult, subtleMotion]);
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
  const updateValue = (key: keyof Values, value: number) => { trackStart(); setValues((old) => ({ ...old, [key]: value })); setError(''); setErrorField(''); };
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
  if (showResult) return <section aria-labelledby="life-result-title" className="space-y-6">
    <p className="text-sm font-semibold text-primary">ผลการประเมินโมดูลความคุ้มครองชีวิต</p>
    <h2 id="life-result-title" className="text-3xl font-bold text-foreground">ช่องว่างความคุ้มครองเบื้องต้น<br /><span className="text-primary">{money(result.gap)} บาท</span></h2>
    <p className="leading-relaxed text-muted-foreground">ตัวเลขนี้คือส่วนต่างระหว่างภาระที่คุณกรอกกับทุนประกันชีวิตและสินทรัพย์ที่ระบุ ไม่ใช่วงเงินที่ควรซื้อโดยอัตโนมัติ และยังไม่ใช่ผลประเมินสุขภาพการเงินทั้งแผน</p>
    <dl className="divide-y divide-border/30 rounded-xl border border-border/40 bg-card/40 px-4">
      <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <dt className="leading-relaxed">ค่าใช้จ่ายในครอบครัวตามจำนวนปีที่ต้องการให้เงินก้อนรองรับ</dt>
        <dd className="font-medium tabular-nums sm:whitespace-nowrap sm:text-right">{money(result.familySupport)} บาท</dd>
      </div>
      <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <dt className="leading-relaxed">หนี้รวมและทุนการศึกษาบุตร</dt>
        <dd className="font-medium tabular-nums sm:whitespace-nowrap sm:text-right">{money(values.debt + values.education)} บาท</dd>
      </div>
      <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <dt className="leading-relaxed">ทุนประกันชีวิตที่มีและสินทรัพย์ที่พร้อมใช้</dt>
        <dd className="font-medium tabular-nums sm:whitespace-nowrap sm:text-right">{money(result.resources)} บาท</dd>
      </div>
    </dl>
    <p className="rounded-xl border border-border/30 bg-background/25 p-4 text-sm leading-relaxed text-muted-foreground">ผลลัพธ์นี้เป็นประมาณการเบื้องต้นจากข้อมูลและสมมติฐานที่คุณกรอก ไม่ใช่คำแนะนำเฉพาะบุคคล และไม่รับรองว่าจำนวนเงินนี้จะเพียงพอในทุกกรณี โปรดทำความเข้าใจรายละเอียดความคุ้มครอง เงื่อนไข และข้อยกเว้นก่อนตัดสินใจทำประกันภัย และประกันไม่ใช่เงินฝาก</p>
    <section className="form-glass space-y-4 p-5 md:p-6" aria-labelledby="fhc-next-steps-title"><div><p className="text-sm font-semibold text-primary">หลังดูผลลัพธ์</p><h3 id="fhc-next-steps-title" className="mt-1 text-xl font-bold text-foreground">อ่านผลลัพธ์ให้เชื่อมกับแผนการเงิน</h3></div><ul className="space-y-3 text-sm leading-relaxed text-muted-foreground"><li className="border-l border-primary/50 pl-4">หากมีส่วนต่างมากกว่า 0 บาท หมายถึงทรัพยากรที่กรอกยังต่ำกว่าภาระตามสมมติฐานชุดนี้</li><li className="border-l border-primary/50 pl-4">หากส่วนต่างเป็น 0 บาท หมายถึงทรัพยากรที่กรอกไม่น้อยกว่าภาระตามสมมติฐานนี้ แต่ไม่ได้ยืนยันว่าความคุ้มครองหรือแผนการเงินทั้งหมดเพียงพอ</li><li className="border-l border-primary/50 pl-4">ทบทวนต่อเรื่องเงินสำรองฉุกเฉิน หนี้ ความเสี่ยงโรคร้ายแรง ความพร้อมลงทุน และเกษียณ ก่อนตัดสินใจ</li></ul></section>
    <div className="form-glass space-y-3 p-5 text-center md:p-6">
      <FHCLifeResultImageDownloadButton summary={{ familySupport: result.familySupport, debtAndEducation: values.debt + values.education, resources: result.resources, gap: result.gap }} />
      <div>
        <h3 className="text-xl font-bold text-foreground">คุยต่อกับ CCPun ทาง LINE OA</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">ส่งภาพสรุปนี้เพื่อคุยรายละเอียดเพิ่มเติมได้เมื่อพร้อม</p>
      </div>
      <a href="https://lin.ee/tqLCs4f" target="_blank" rel="noreferrer" aria-label="คุยกับ CCPun ทาง LINE OA (เปิดในแท็บใหม่)" onClick={() => trackEvent('fhc_contact_click', { tool_name: 'fhc', contact_channel: 'line', cta_location: 'fhc_result', surface_group: 'fhc' })} className="gold-button liquid-shine inline-flex min-h-14 w-full items-center justify-center gap-2 px-6 py-3 sm:w-auto">
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
        คุยกับ CCPun ทาง LINE OA
      </a>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => { setShowResult(false); setError(''); setErrorField(''); }} className="glass-button flex flex-1 items-center justify-center gap-2"><Edit3 className="h-4 w-4" aria-hidden="true" /><span>แก้ไขข้อมูล</span></button><button type="button" onClick={() => { setValues(initialValues); setStep(1); setShowResult(false); setError(''); setErrorField(''); startedRef.current = false; completedRef.current = false; trackedStepsRef.current.clear(); }} className="glass-button flex flex-1 items-center justify-center gap-2"><RefreshCw className="h-4 w-4" aria-hidden="true" /><span>เริ่มใหม่</span></button></div>
  </section>;

  return <section aria-labelledby="life-calculator-title">
    <div className="mb-8 text-center"><p className="text-sm font-semibold text-primary">เครื่องคำนวณทุนประกันชีวิต</p><h2 id="life-calculator-title" className="mt-2 text-2xl font-bold text-foreground">เริ่มจากภาระที่คนข้างหลังต้องดูแล</h2><p className="mt-2 text-sm text-muted-foreground">2 ขั้นตอน · กรอกเท่าที่ทราบ ช่องที่ไม่มีก็เว้นได้</p><div role="progressbar" aria-label={`ขั้นตอนที่ ${step} จาก 2`} aria-valuemin={1} aria-valuemax={2} aria-valuenow={step} className="mt-5 h-1 rounded bg-border/40"><div className="h-full rounded bg-primary transition-all" style={{ width: `${step * 50}%` }} /></div></div>
    {error && <p id="life-calculator-error" role="alert" className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
    <div ref={stepPanelRef} data-w43-motion-step={subtleMotion ? step : undefined} className="form-glass mt-7 space-y-8 p-5 md:p-8 lg:p-10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          {step === 1 ? <Wallet className="h-5 w-5 text-primary" aria-hidden="true" /> : <Shield className="h-5 w-5 text-primary" aria-hidden="true" />}
        </div>
        <div><h3 className="text-xl font-bold text-foreground">{step === 1 ? 'ภาระที่คนข้างหลังต้องดูแล' : 'ทรัพยากรที่ตั้งใจใช้ในแผนนี้'}</h3><p className="text-sm text-muted-foreground">{step === 1 ? 'เริ่มจากข้อมูลที่แน่ใจก่อน ช่องที่ไม่มีก็เว้นได้' : 'กรอกเท่าที่ทราบ หรือเว้นไว้ได้หากยังไม่มี'}</p></div>
      </div>
      <div className="space-y-6">
        {step === 1 ? <>
          <MoneyField id="householdMonthly" label="ค่าใช้จ่ายครัวเรือนต่อเดือนที่ยังต้องดูแล" help="กรอกหลังหักรายได้อื่นที่ยังมีอยู่แล้ว" value={values.householdMonthly} onChange={(value) => updateValue('householdMonthly', value)} error={errorField === 'householdMonthly'} />
          <fieldset className="space-y-3"><legend className="text-sm font-semibold text-foreground">จำนวนปีที่ต้องการให้เงินก้อนรองรับ</legend><div className="flex items-center justify-between gap-4"><span className="text-sm text-muted-foreground">1 ปี</span><output htmlFor="supportYears" className="text-lg font-bold tabular-nums text-primary">{values.supportYears} ปี</output><span className="text-sm text-muted-foreground">20 ปี</span></div><input id="supportYears" type="range" min="1" max="20" step="1" value={values.supportYears} onChange={(event) => updateValue('supportYears', Number(event.target.value))} aria-invalid={errorField === 'supportYears' || undefined} aria-describedby={errorField === 'supportYears' ? 'supportYears-help life-calculator-error' : 'supportYears-help'} aria-label="จำนวนปีที่ต้องการให้เงินก้อนรองรับ" className="min-h-11 w-full cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /><p id="supportYears-help" className="text-sm leading-relaxed text-muted-foreground">ค่าเริ่มต้น 10 ปี ปรับได้ตั้งแต่ 1–20 ปีตามระยะเวลาที่ครอบครัวต้องการเงินก้อนรองรับ</p></fieldset>
          <section aria-labelledby="fhc-debt-title" className="rounded-xl border border-border/30 bg-background/20 p-4"><h4 id="fhc-debt-title" className="mb-4 text-sm font-semibold text-foreground">ภาระหนี้ที่ยังเหลือ (ถ้ามี)</h4><MoneyField id="debt" label="ยอดหนี้คงเหลือทั้งหมด" help="รวมยอดบ้าน รถ บัตรเครดิต และสินเชื่ออื่นที่ต้องการให้เงินก้อนนี้รองรับ" value={values.debt} onChange={(value) => updateValue('debt', value)} error={errorField === 'debt'} /></section>
          <section aria-labelledby="fhc-education-title" className="rounded-xl border border-border/30 bg-background/20 p-4"><h4 id="fhc-education-title" className="mb-4 text-sm font-semibold text-foreground">แผนการศึกษาบุตร (ถ้ามี)</h4><MoneyField id="education" label="ทุนการศึกษารวมที่ต้องการเตรียม" help="รวมค่าเล่าเรียนและค่าใช้จ่ายที่ตั้งใจดูแลจนจบช่วงการศึกษาที่วางแผนไว้" value={values.education} onChange={(value) => updateValue('education', value)} error={errorField === 'education'} /></section>
        </> : <><MoneyField id="existingLifeCoverage" label="ทุนประกันชีวิตที่มีอยู่" help="กรอกเฉพาะทุนที่ตั้งใจให้ครอบครัวใช้ตามแผนนี้" value={values.existingLifeCoverage} onChange={(value) => updateValue('existingLifeCoverage', value)} error={errorField === 'existingLifeCoverage'} /><MoneyField id="liquidAssets" label="สินทรัพย์สภาพคล่องที่ตั้งใจใช้" help="ไม่หักเงินสำรองฉุกเฉินโดยอัตโนมัติ เพื่อไม่ให้นับเงินก้อนเดียวซ้ำ" value={values.liquidAssets} onChange={(value) => updateValue('liquidAssets', value)} error={errorField === 'liquidAssets'} /></>}
      </div>
    </div>
    <div className="mt-8 flex items-center justify-between border-t border-border/30 pt-6">{step === 1 ? <span /> : <button type="button" onClick={() => { setStep(1); setError(''); setErrorField(''); }} className="glass-button inline-flex min-h-11 items-center gap-2"><ChevronLeft className="h-4 w-4" aria-hidden="true" />ย้อนกลับ</button>}<button type="button" onClick={next} className="gold-button inline-flex min-h-11 items-center gap-2">{step === 1 ? 'ถัดไป' : 'ดูผลการคำนวณ'}<ChevronRight className="h-4 w-4" aria-hidden="true" /></button></div>
  </section>;
}
