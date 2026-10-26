'use client';
import { usePublicCopy } from '@/components/ui/PublicCopyProvider';
import { FHC_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';


import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit3, MessageCircle, RefreshCw } from 'lucide-react';
import FHCLifeResultImageDownloadButton from '@/features/financial-health-check/components/FHCLifeResultImageDownloadButton';
import CurrencyInput from '@/components/ui/CurrencyInput';
import HumanCalculatorCard from '@/components/ui/HumanCalculatorCard';
import MoneyComparison from '@/components/ui/MoneyComparison';
import { trackEvent } from '@/lib/analytics';
import V5ChatLink from '@/components/layout/v5/V5ChatLink';
import { LINE_CHAT_DEFAULT_HEADLINE, resultChatHref } from '@/lib/line/chat-panel';
import { getConsentData } from '@/lib/cookie-consent';
import { calculateLifeCoverage, formatLifeCoverageMoney, LIFE_COVERAGE_INITIAL_VALUES, type LifeCoverageValues } from './lifeCoverageModel';


function MoneyField({ id, label, help, value, onChange, error }: { id: keyof LifeCoverageValues; label: string; help?: string; value: number; onChange: (value: number) => void; error?: boolean }) {
  const t = usePublicCopy(FHC_COPY_DEFAULTS);

  const helpId = help ? `${id}-help` : undefined;
  const describedBy = [helpId, error && 'life-calculator-error'].filter(Boolean).join(' ') || undefined;
  return <div className="space-y-2">
    <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
    <CurrencyInput id={id} value={value} onChange={onChange} placeholder={t("fhc.wizard.placeholder")} error={error} aria-describedby={describedBy} />
    {help && <p id={helpId} className="text-xs leading-5 text-muted-foreground">{help}</p>}
  </div>;
}

export default function LifeCoverageWizard() {
  const t = usePublicCopy(FHC_COPY_DEFAULTS);

  const [step, setStep] = useState(1);
  const [values, setValues] = useState<LifeCoverageValues>(LIFE_COVERAGE_INITIAL_VALUES);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<keyof LifeCoverageValues | ''>('');
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
  const updateValue = (key: keyof LifeCoverageValues, value: number) => {
    trackStart();
    setValues((old) => ({ ...old, [key]: value }));
    setError('');
    setErrorField('');
  };

  const result = useMemo(() => calculateLifeCoverage(values), [values]);

  const fail = (field: keyof LifeCoverageValues, message: string) => {
    setError(message);
    setErrorField(field);
    window.requestAnimationFrame(() => document.getElementById(field)?.focus());
  };

  const runStepTransition = (commit: () => void) => commit();

  const next = () => {
    if (step === 1 && !values.householdMonthly) { fail('householdMonthly', t("fhc.wizard.next")); return; }
    if (step === 1 && (values.supportYears < 1 || values.supportYears > 20)) { fail('supportYears', t("fhc.wizard.next2")); return; }
    if (step === 1 && !Number.isSafeInteger(result.need)) { fail('householdMonthly', t("fhc.wizard.next3")); return; }
    trackStart();
    if (step === 2) {
      if (![result.resources, result.gap].every(Number.isSafeInteger)) { fail('existingLifeCoverage', t("fhc.wizard.next3")); return; }
      setShowResult(true);
      if (!completedRef.current) {
        completedRef.current = true;
        trackEvent('fhc_calculator_complete', { tool_name: 'fhc', step_number: 2, cta_location: 'fhc_result', surface_group: 'fhc' });
        trackEvent('fhc_result_view', { tool_name: 'fhc', cta_location: 'fhc_result', surface_group: 'fhc' });
      }
      return;
    }
    runStepTransition(() => {
      setStep(2);
      trackStep(2);
    });
  };

  if (showResult) return <section ref={viewRef} aria-labelledby="life-result-title" data-ui="human-centered-fhc-result" className="ccpun-calculator-result ccpun-motion-result-reveal">
    <div className="ccpun-calculator-result-lead">
      <p className="ccpun-calculator-result-eyebrow">{t.node("fhc.wizard.description")}</p>
      <h2 id="life-result-title" tabIndex={-1} className="ccpun-calculator-result-title scroll-mt-28 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t.node("fhc.wizard.lifeResultTitle.heading")}<span className="whitespace-nowrap">{t.node("fhc.wizard.label")}</span><span className="sr-only"> {formatLifeCoverageMoney(result.gap)} {t.node("fhc.wizard.label2")}</span></h2>
      <p className="ccpun-calculator-result-amount">{formatLifeCoverageMoney(result.gap)} <small>{t.node("fhc.wizard.label2")}</small></p>
      <p className="ccpun-calculator-result-body">{t.node("fhc.wizard.description2")}</p>
    </div>

    <dl className="mb-5 grid grid-cols-2 gap-3 border-y border-white/10 py-4 text-sm" aria-label={t("fhc.wizard.ariaLabel")}>
      <div><dt className="text-muted-foreground">{t.node("fhc.wizard.metricLabel")}</dt><dd>{formatLifeCoverageMoney(values.householdMonthly)} {t.node("fhc.wizard.label2")}</dd></div>
      <div><dt className="text-muted-foreground">{t.node("fhc.wizard.metricLabel2")}</dt><dd>{values.supportYears} {t.node("fhc.wizard.label3")}</dd></div>
    </dl>
    <MoneyComparison need={result.need} resources={result.resources} title={t("fhc.wizard.title")} needLabel={t("fhc.wizard.needLabel")} />

    <dl className="ccpun-calculator-result-rows">
      <div className="ccpun-calculator-result-row"><dt>{t.node("fhc.wizard.metricLabel3")}</dt><dd>{formatLifeCoverageMoney(result.familySupport)} {t.node("fhc.wizard.label2")}</dd></div>
      <div className="ccpun-calculator-result-row"><dt>{t.node("fhc.wizard.metricLabel4")}</dt><dd>{formatLifeCoverageMoney(values.debt + values.education)} {t.node("fhc.wizard.label2")}</dd></div>
      <div className="ccpun-calculator-result-row"><dt>{t.node("fhc.wizard.metricLabel5")}</dt><dd>{formatLifeCoverageMoney(result.resources)} {t.node("fhc.wizard.label2")}</dd></div>
    </dl>

    <div className="ccpun-calculator-result-notice">{t.node("fhc.wizard.label4")}</div>

    <div className="ccpun-calculator-result-cta">
      <FHCLifeResultImageDownloadButton summary={{ familySupport: result.familySupport, debtAndEducation: values.debt + values.education, resources: result.resources, gap: result.gap }} />
      <h3>{t.node("fhc.wizard.heading")}</h3>
      <p>{t.node("fhc.wizard.description3")}</p>
      <V5ChatLink href={resultChatHref("fhc")} resultTool="fhc" onActivate={() => trackEvent('fhc_contact_click', { tool_name: 'fhc', contact_channel: 'line', cta_location: 'fhc_result', surface_group: 'fhc' })} className="gold-button ccpun-motion-tactile mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3 sm:w-auto"><MessageCircle className="h-5 w-5" aria-hidden="true" />{LINE_CHAT_DEFAULT_HEADLINE}</V5ChatLink>
    </div>

    <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => { setShowResult(false); setError(''); setErrorField(''); }} className="glass-button ccpun-motion-tactile flex min-h-12 items-center justify-center gap-2"><Edit3 className="h-4 w-4" aria-hidden="true" />{t.node("fhc.wizard.action")}</button><button type="button" onClick={() => { setValues(LIFE_COVERAGE_INITIAL_VALUES); setStep(1); setShowResult(false); setError(''); setErrorField(''); startedRef.current = false; completedRef.current = false; trackedStepsRef.current.clear(); }} className="glass-button ccpun-motion-tactile flex min-h-12 items-center justify-center gap-2"><RefreshCw className="h-4 w-4" aria-hidden="true" />{t.node("fhc.wizard.action2")}</button></div>
  </section>;

  const educationOpen = values.education > 0 || errorField === 'education';
  const footer = <div className="flex items-center gap-3">{step === 2 ? <button type="button" onClick={() => runStepTransition(() => { setStep(1); setError(''); setErrorField(''); })} className="glass-button ccpun-motion-tactile inline-flex min-h-11 items-center gap-2 px-4"><ChevronLeft className="h-4 w-4" aria-hidden="true" />{t.node("fhc.wizard.action3")}</button> : <span className="flex-1" />}<button type="submit" className="gold-button ccpun-motion-tactile ml-auto inline-flex min-h-11 flex-1 items-center justify-center gap-2 px-5 sm:flex-none sm:min-w-44">{step === 1 ? t("fhc.wizard.footer") : t("fhc.wizard.footer2")}<ChevronRight className="h-4 w-4" aria-hidden="true" /></button></div>;

  return <section ref={viewRef} className="ccpun-motion-step-view">
    <form noValidate onSubmit={(event) => { event.preventDefault(); next(); }}>
      <HumanCalculatorCard step={step} total={2} labelledBy={`fhc-step-${step}-title`} title={step === 1 ? t("fhc.wizard.title2") : t("fhc.wizard.title3")} description={step === 1 ? t("fhc.wizard.description4") : t("fhc.wizard.description5")} footer={footer}>
        {error ? <p id="life-calculator-error" role="alert" className="ccpun-motion-validation rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-sm text-[#ffb4b4]">{error}</p> : null}
        {step === 1 ? <>
          <MoneyField id="householdMonthly" label={t("fhc.wizard.label5")} help={t("fhc.wizard.help")} value={values.householdMonthly} onChange={(value) => updateValue('householdMonthly', value)} error={errorField === 'householdMonthly'} />
          <fieldset className="space-y-2"><legend className="text-sm font-medium text-foreground">{t.node("fhc.wizard.groupLabel")}</legend><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{t.node("fhc.wizard.label6")}</span><output htmlFor="supportYears" className="text-base font-semibold tabular-nums text-primary">{values.supportYears} {t.node("fhc.wizard.label3")}</output><span>{t.node("fhc.wizard.label7")}</span></div><input id="supportYears" type="range" min="1" max="20" step="1" value={values.supportYears} onChange={(event) => updateValue('supportYears', Number(event.target.value))} aria-invalid={errorField === 'supportYears' || undefined} aria-describedby={errorField === 'supportYears' ? 'supportYears-help life-calculator-error' : 'supportYears-help'} aria-label={t("fhc.wizard.groupLabel")} className="min-h-11 w-full cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /><p id="supportYears-help" className="text-xs leading-5 text-muted-foreground">{t.node("fhc.wizard.supportYearsHelp.description")}</p></fieldset>
          <MoneyField id="debt" label={t("fhc.wizard.label8")} help={t("fhc.wizard.help2")} value={values.debt} onChange={(value) => updateValue('debt', value)} error={errorField === 'debt'} />
          <details open={educationOpen} className="group border-t border-white/10 pt-4"><summary className="min-h-11 py-3 cursor-pointer text-sm font-medium text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t.node("fhc.wizard.expandLabel")}</summary><div className="mt-4"><MoneyField id="education" label={t("fhc.wizard.label9")} help={t("fhc.wizard.help3")} value={values.education} onChange={(value) => updateValue('education', value)} error={errorField === 'education'} /></div></details>
        </> : <>
          <MoneyField id="existingLifeCoverage" label={t("fhc.wizard.label10")} help={t("fhc.wizard.help4")} value={values.existingLifeCoverage} onChange={(value) => updateValue('existingLifeCoverage', value)} error={errorField === 'existingLifeCoverage'} />
          <MoneyField id="liquidAssets" label={t("fhc.wizard.label11")} help={t("fhc.wizard.help5")} value={values.liquidAssets} onChange={(value) => updateValue('liquidAssets', value)} error={errorField === 'liquidAssets'} />
        </>}
      </HumanCalculatorCard>
    </form>
  </section>;
}
