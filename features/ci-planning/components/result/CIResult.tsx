'use client';
import { usePublicCopy } from '@/components/ui/PublicCopyProvider';
import { CI_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';


import { useEffect, useRef, useState } from 'react';
import { Edit3, ExternalLink, MessageCircle, RefreshCw } from 'lucide-react';
import MoneyComparison from '@/components/ui/MoneyComparison';
import { trackEvent } from '@/lib/analytics';
import {
  CI_LINE_OA_URL,
  CI_ASSESSMENT_VERSION,
} from '@/features/ci-planning/calculator/constants';
import type { CIEstimationMethod, CIResult as CIResultType } from '@/features/ci-planning/calculator/types';
import ResultImageDownloadButton from '@/features/ci-planning/components/ResultImageDownloadButton';
import { CI_RECOVERY_SOURCES } from '@/features/ci-planning/recovery-evidence';

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
  const t = usePublicCopy(CI_COPY_DEFAULTS);

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

  const methodLabel = t(activeMethod === 'income' ? 'ci.method.income' : 'ci.method.expense');
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
    ? t("ci.result.differenceLabel")
    : displayedSurplus > 0
      ? t("ci.result.differenceLabel2")
      : t("ci.result.differenceLabel3");

  const recoveryRowCandidates: Array<[string, number]> = [
    [t("ci.result.recoveryRowCandidates").replaceAll("{recoveryTreatmentVisits}", String(result.recoveryTreatmentVisits)).replaceAll("{value2}", String(baht(result.recoveryTreatmentVisitUnitCost))), result.recoveryVisitNeed],
    [t("ci.result.recoveryRowCandidates2").replaceAll("{recoveryCaregiverHomeDays}", String(result.recoveryCaregiverHomeDays)).replaceAll("{value2}", String(baht(result.recoveryCaregiverDailyCost))), result.recoveryCaregiverHomeNeed],
    [t("ci.result.recoveryRowCandidates3").replaceAll("{recoveryRehabSessions}", String(result.recoveryRehabSessions)).replaceAll("{value2}", String(baht(result.recoveryRehabUnitCost))), result.recoveryRehabNeed],
    [t("ci.recovery.pulseOximeter.label"), result.recoveryPulseOximeter],
    [t("ci.recovery.bloodPressureMonitor.label"), result.recoveryBloodPressureMonitor],
    [t("ci.recovery.thermometer.label"), result.recoveryThermometer],
    [t("ci.recovery.walker.label"), result.recoveryWalker],
    [t("ci.recovery.wheelchair.label"), result.recoveryWheelchair],
    [t("ci.recovery.showerChair.label"), result.recoveryShowerChair],
    [t("ci.recovery.rowCandidates4"), result.recoveryGrabRailAndSafety],
    [t("ci.recovery.hospitalBed.label"), result.recoveryHospitalBed],
    [t("ci.recovery.rowCandidates5"), result.recoveryConsumables],
    [t("ci.recovery.rowCandidates6"), result.recoveryHomeAdaptation],
    [t("ci.recovery.majorHousing.label"), result.recoveryMajorHousing],
    [t("ci.recovery.contingency.label"), result.recoveryContingency],
    [t("ci.recovery.otherRecoveryCosts.label"), result.recoveryOtherCosts],
  ];
  const recoveryRows = recoveryRowCandidates.filter(([, amount]) => amount > 0);

  return <div data-ui="human-centered-ci-result" className="ccpun-calculator-result ccpun-motion-result-reveal">
    <section className="ccpun-calculator-result-lead">
      <p className="ccpun-calculator-result-eyebrow">{t("ci.result.description")}</p>
      <h2
        ref={resultHeadingRef}
        tabIndex={-1}
        className="ccpun-calculator-result-title scroll-mt-28 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("ci.result.heading")}{methodLabel}
      </h2>
      <output className="ccpun-calculator-result-amount" aria-live="polite" aria-atomic="true">{baht(selectedNeed)}</output>
      <p className="ccpun-calculator-result-body">
        {t("ci.result.description2")}{baht(selectedBaseNeed)} {t("ci.result.description3")}{activeMethod === 'expense' ? t("ci.result.label") : t("ci.result.label2")} + Recovery Reserve {baht(result.recoveryReserveNeed)}{result.protectedAssetsNeed > 0 ? t("ci.result.label3").replaceAll("{value1}", String(baht(result.protectedAssetsNeed))) : ''} {t("ci.result.description4")}</p>
    </section>

    {availableMethods.length > 1 ? <fieldset className="space-y-3" aria-describedby="ci-estimation-method-help">
      <legend className="ccpun-calculator-result-panel-title">{t("ci.result.groupLabel")}</legend>
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
              <span className="text-sm font-medium">{t(method === 'income' ? 'ci.method.income' : 'ci.method.expense')}</span>
            </span>
            <span className="text-sm tabular-nums" style={{ color: 'var(--w43-muted)' }}>{baht(value)}</span>
          </label>;
        })}
      </div>
      <p id="ci-estimation-method-help" className="ccpun-calculator-result-body">
        {t("ci.result.estimationMethodHelp.description")}{result.protectedAssetsNeed > 0 ? t("ci.result.label4") : ''}
      </p>
    </fieldset> : null}

    <MoneyComparison
      need={selectedNeed}
      resources={result.availableResources}
      title={t("ci.result.title").replaceAll("{methodLabel}", String(methodLabel))}
      needLabel={methodLabel}
      resourcesLabel={t("ci.result.resourcesLabel")}
    />

    <section className="ccpun-calculator-result-panel">
      <p className="ccpun-calculator-result-eyebrow">{differenceLabel}</p>
      <p className="ccpun-calculator-result-difference mt-1 font-semibold tabular-nums">{baht(difference)}</p>
      <p className="ccpun-calculator-result-body">
        {t("ci.result.description5")}{baht(result.availableResources)} {t("ci.result.description6")}</p>
      {result.protectedAssetsNeed > 0 ? <p className="ccpun-calculator-result-body">
        {t("ci.result.description7")}{baht(result.protectedAssetsNeed)} {t("ci.result.description8")}</p> : null}
      {displayedSurplus > 0 ? <p className="ccpun-calculator-result-body">
        {t("ci.result.description9")}</p> : null}
      <details className="ccpun-calculator-result-details">
        <summary className="focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("ci.result.expandLabel")}</summary>
        <div className="mt-4">
          {activeMethod === 'expense' ? <dl className="ccpun-calculator-result-rows ccpun-calculator-result-breakdown">
            <div className="ccpun-calculator-result-row"><dt>{t("ci.result.metricLabel")}</dt><dd>{baht(result.householdNeed)}</dd></div>
            <div className="ccpun-calculator-result-row"><dt>{t("ci.result.metricLabel2")}</dt><dd>{baht(result.educationNeed)}</dd></div>
            <div className="ccpun-calculator-result-row"><dt>{t("ci.expenses.metricLabel3")}</dt><dd>{baht(result.debtNeed)}</dd></div>
            <div className="ccpun-calculator-result-row"><dt>{t("ci.expenses.metricLabel5")}</dt><dd>{baht(result.recoveryReserveNeed)}</dd></div>
            {result.protectedAssetsNeed > 0 ? <div className="ccpun-calculator-result-row"><dt>{t("ci.result.metricLabel3")}</dt><dd>{baht(result.protectedAssetsNeed)}</dd></div> : null}
          </dl> : <dl className="ccpun-calculator-result-rows ccpun-calculator-result-breakdown">
            <div className="ccpun-calculator-result-row"><dt>{t("ci.expenses.metricLabel4")}</dt><dd>{baht(incomeBaseNeed)}</dd></div>
            <div className="ccpun-calculator-result-row"><dt>{t("ci.expenses.metricLabel5")}</dt><dd>{baht(result.recoveryReserveNeed)}</dd></div>
            {result.protectedAssetsNeed > 0 ? <div className="ccpun-calculator-result-row"><dt>{t("ci.result.metricLabel3")}</dt><dd>{baht(result.protectedAssetsNeed)}</dd></div> : null}
          </dl>}
        </div>
      </details>
    </section>

    <section className="ccpun-calculator-result-panel" aria-labelledby="ci-recovery-result-title">
      <p className="ccpun-calculator-result-eyebrow">{t("ci.recovery.description")}</p>
      <h3 id="ci-recovery-result-title" className="ccpun-calculator-result-panel-title mt-1">
        {t(`ci.recovery.mode.${result.recoveryMode}`)}
      </h3>
      <p className="mt-2 text-3xl font-semibold tabular-nums" style={{ color: 'var(--w43-gold)' }}>
        {baht(result.recoveryReserveNeed)}
      </p>
      <p className="ccpun-calculator-result-body">
        {t("ci.result.description10")}</p>

      {result.recoveryReserveNeed > 0 ? (
        <details className="mt-4 border-t pt-4" style={{ borderColor: 'var(--w43-border)' }}>
          <summary className="cursor-pointer text-sm font-medium focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {t("ci.result.expandLabel2")}</summary>
          <div className="mt-4 space-y-4">
            <dl className="ccpun-calculator-result-rows">
              {recoveryRows.map(([label, amount]) => (
                <div key={label} className="ccpun-calculator-result-row">
                  <dt>{label}</dt>
                  <dd>{baht(amount)}</dd>
                </div>
              ))}
              <div className="ccpun-calculator-result-row">
                <dt>{t("ci.recovery.metricLabel")}</dt>
                <dd>{baht(result.recoveryBreakdownTotal)}</dd>
              </div>
            </dl>

            {result.recoveryUnallocated > 0 ? <p className="ccpun-calculator-result-body">
              {t("ci.result.description11")}{baht(result.recoveryUnallocated)}
            </p> : null}

            {result.recoveryOverBudget > 0 ? <p className="ccpun-calculator-result-body" style={{ color: 'var(--destructive)' }}>
              {t("ci.result.description12")}{baht(result.recoveryOverBudget)} {t("ci.result.description13")}</p> : null}

            {result.recoveryMajorHousing > 0 ? <p className="ccpun-calculator-result-body">
              {t("ci.result.description14")}</p> : null}
          </div>
        </details>
      ) : <p className="ccpun-calculator-result-body">{t("ci.result.description15")}</p>}

      <details className="mt-4 border-t pt-4" style={{ borderColor: 'var(--w43-border)' }}>
        <summary className="cursor-pointer text-sm font-medium">{t("ci.recovery.expandLabel3")}</summary>
        <div className="mt-3 space-y-3 text-xs leading-5" style={{ color: 'var(--w43-muted)' }}>
          <p>
            {t("ci.result.description16")}</p>
          {CI_RECOVERY_SOURCES.map((source) => <p key={source.id}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1"
              style={{ color: 'var(--w43-gold)' }}
            >
              {t(`ci.recovery.source.${source.id}.publisher` as keyof typeof CI_COPY_DEFAULTS)} · {source.year}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <br />
            {t(`ci.recovery.source.${source.id}.note` as keyof typeof CI_COPY_DEFAULTS)}
          </p>)}
        </div>
      </details>
    </section>

    <div className="ccpun-calculator-result-cta ccpun-ci-result-cta">
      <div className="ccpun-ci-result-cta-inner">
        <h3>{t("ci.result.heading2")}</h3>
        <p className="ccpun-ci-result-cta-copy">{t("ci.result.description17")}</p>
        <ResultImageDownloadButton result={result} selectedMethod={activeMethod} />
        <a
          href={CI_LINE_OA_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("ci.result.ariaLabel")}
          className="gold-button ccpun-motion-tactile ccpun-ci-result-cta-line inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3"
          onClick={() => trackEvent('ci_contact_click', {
            tool_name: 'ci_planning',
            cta_location: 'ci_result',
            contact_channel: 'line',
            calculator_version: CI_ASSESSMENT_VERSION,
          })}
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          {t("ci.result.linkLabel")}</a>
      </div>
    </div>

    <p className="ccpun-calculator-result-notice">
      {t("ci.result.description18")}</p>

    <div className="grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={onEditData} className="glass-button ccpun-motion-tactile flex min-h-12 items-center justify-center gap-2">
        <Edit3 className="h-4 w-4" />
        <span>{t("ci.result.label5")}</span>
      </button>
      <button type="button" onClick={onReset} className="glass-button ccpun-motion-tactile flex min-h-12 items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4" />
        <span>{t("ci.result.label6")}</span>
      </button>
    </div>
  </div>;
}
