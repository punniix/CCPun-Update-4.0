'use client';
import { usePublicCopy } from '@/components/ui/PublicCopyProvider';
import { CI_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';


import { ExternalLink, RotateCcw } from 'lucide-react';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { calcRecoveryReserveNeed } from '@/features/ci-planning/calculator/calculator';
import type { CIRecoveryCosts } from '@/features/ci-planning/calculator/types';
import {
  buildCustomRecoveryFromTarget,
  CI_RECOVERY_PRESETS,
  CI_RECOVERY_SOURCES,
  copyPresetToCustom,
  EMPTY_CI_RECOVERY,
  getRecoveryPreset,
} from '@/features/ci-planning/recovery-evidence';
import { baht, safeRecoveryPreview } from './StepExpenses.model';

type RecoveryPreview = ReturnType<typeof safeRecoveryPreview>;

type Props = {
  recovery: CIRecoveryCosts;
  errors: Record<string, string>;
  recoveryPreview: RecoveryPreview;
  onChangeRecovery: (nextRecovery: CIRecoveryCosts) => void;
};

type AmountField =
  | 'pulseOximeter'
  | 'bloodPressureMonitor'
  | 'thermometer'
  | 'walker'
  | 'wheelchair'
  | 'showerChair'
  | 'grabRailAndSafety'
  | 'hospitalBed'
  | 'consumables'
  | 'homeAdaptation'
  | 'majorHousing'
  | 'contingency'
  | 'otherRecoveryCosts';

const PRESET_ORDER: Array<'basic' | 'continued' | 'longTerm'> = ['basic', 'continued', 'longTerm'];



function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" tabIndex={-1} className="text-sm text-[#ffb4b4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {message}
    </p>
  );
}

function BreakdownRows({ recovery: value }: { recovery: CIRecoveryCosts }) {
  const t = usePublicCopy(CI_COPY_DEFAULTS);

  const preview = calcRecoveryReserveNeed(value);
  const rowCandidates: Array<[string, number]> = [
    [t("ci.recovery.rowCandidates").replaceAll("{treatmentVisits}", String(preview.treatmentVisits)).replaceAll("{value2}", String(baht(preview.treatmentVisitUnitCost))), preview.visitNeed],
    [t("ci.recovery.rowCandidates2").replaceAll("{caregiverHomeDays}", String(preview.caregiverHomeDays)).replaceAll("{value2}", String(baht(preview.caregiverDailyCost))), preview.caregiverHomeNeed],
    [t("ci.recovery.rowCandidates3").replaceAll("{rehabSessions}", String(preview.rehabSessions)).replaceAll("{value2}", String(baht(preview.rehabUnitCost))), preview.rehabNeed],
    [t("ci.recovery.pulseOximeter.label"), preview.pulseOximeter],
    [t("ci.recovery.bloodPressureMonitor.label"), preview.bloodPressureMonitor],
    [t("ci.recovery.thermometer.label"), preview.thermometer],
    [t("ci.recovery.walker.label"), preview.walker],
    [t("ci.recovery.wheelchair.label"), preview.wheelchair],
    [t("ci.recovery.showerChair.label"), preview.showerChair],
    [t("ci.recovery.rowCandidates4"), preview.grabRailAndSafety],
    [t("ci.recovery.hospitalBed.label"), preview.hospitalBed],
    [t("ci.recovery.rowCandidates5"), preview.consumables],
    [t("ci.recovery.rowCandidates6"), preview.homeAdaptation],
    [t("ci.recovery.majorHousing.label"), preview.majorHousing],
    [t("ci.recovery.contingency.label"), preview.contingency],
    [t("ci.recovery.rowCandidates7"), preview.otherRecoveryCosts],
  ];
  const rows = rowCandidates.filter(([, amount]) => amount > 0);

  return (
    <dl className="space-y-2 text-xs">
      {rows.map(([label, amount]) => (
        <div key={label} className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-2 last:border-b-0 last:pb-0">
          <dt className="min-w-0 text-muted-foreground">{label}</dt>
          <dd className="shrink-0 font-medium tabular-nums text-foreground">{baht(amount)}</dd>
        </div>
      ))}
      <div className="flex items-start justify-between gap-4 pt-2">
        <dt className="font-medium text-foreground">{t.node("ci.recovery.metricLabel")}</dt>
        <dd className="shrink-0 font-semibold tabular-nums text-primary">{baht(preview.breakdownTotal)}</dd>
      </div>
    </dl>
  );
}

export default function RecoveryReserveSection({
  recovery,
  errors,
  recoveryPreview,
  onChangeRecovery,
}: Props) {
  const t = usePublicCopy(CI_COPY_DEFAULTS);

const AMOUNT_FIELDS: Array<{ field: AmountField; label: string; help?: string }> = [
  { field: 'pulseOximeter', label: t("ci.recovery.pulseOximeter.label") },
  { field: 'bloodPressureMonitor', label: t("ci.recovery.bloodPressureMonitor.label") },
  { field: 'thermometer', label: t("ci.recovery.thermometer.label") },
  { field: 'walker', label: t("ci.recovery.walker.label") },
  { field: 'wheelchair', label: t("ci.recovery.wheelchair.label") },
  { field: 'showerChair', label: t("ci.recovery.showerChair.label") },
  { field: 'grabRailAndSafety', label: t("ci.recovery.grabRailAndSafety.label") },
  { field: 'hospitalBed', label: t("ci.recovery.hospitalBed.label") },
  { field: 'consumables', label: t("ci.recovery.consumables.label") },
  { field: 'homeAdaptation', label: t("ci.recovery.homeAdaptation.label"), help: t("ci.recovery.homeAdaptation.help") },
  { field: 'majorHousing', label: t("ci.recovery.majorHousing.label"), help: t("ci.recovery.majorHousing.help") },
  { field: 'contingency', label: t("ci.recovery.contingency.label") },
  { field: 'otherRecoveryCosts', label: t("ci.recovery.otherRecoveryCosts.label") },
];

  const choosePreset = (mode: 'basic' | 'continued' | 'longTerm') => {
    onChangeRecovery(getRecoveryPreset(mode));
  };

  const chooseCustom = () => {
    onChangeRecovery({
      ...recovery,
      mode: 'custom',
    });
  };

  const updateCustomNumber = (
    field: keyof Pick<
      CIRecoveryCosts,
      | 'treatmentVisits'
      | 'treatmentVisitUnitCost'
      | 'caregiverHomeDays'
      | 'caregiverDailyCost'
      | 'rehabSessions'
      | 'rehabUnitCost'
    >,
    value: number,
  ) => {
    onChangeRecovery({ ...recovery, mode: 'custom', [field]: value });
  };

  const updateCustomAmount = (field: AmountField, value: number) => {
    onChangeRecovery({ ...recovery, mode: 'custom', [field]: value });
  };

  const targetError = errors['recovery.targetReserve'];
  const selected = recovery.mode;

  return (
    <section className="border-t border-white/10 pt-5" data-ui="ci-recovery-reserve" aria-labelledby="ci-recovery-title">
      <div className="space-y-2">
        <p className="text-sm leading-6 text-foreground">{t.node("ci.recovery.description")}</p>
        <h4 id="ci-recovery-title" className="text-base font-medium text-foreground">{t.node("ci.expenses.metricLabel5")}</h4>
        <p className="text-xs leading-6 text-white/70">
          {t.node("ci.recovery.description2")}</p>
      </div>

      <fieldset className="mt-5 space-y-3">
        <legend className="sr-only">{t.node("ci.recovery.groupLabel")}</legend>
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {PRESET_ORDER.map((mode) => {
            const preset = CI_RECOVERY_PRESETS[mode];
            const isSelected = selected === mode;
            return (
              <article
                key={mode}
                className={`rounded-2xl border p-4 transition-colors ${isSelected ? 'border-primary/60 bg-primary/[0.08]' : 'border-white/10 bg-white/[0.02]'}`}
              >
                <label htmlFor={`ci-recovery-choice-${mode}`} className="flex min-h-11 cursor-pointer items-start gap-3">
                  <input
                    id={`ci-recovery-choice-${mode}`}
                    type="radio"
                    name="ci-recovery-choice"
                    value={mode}
                    checked={isSelected}
                    onChange={() => choosePreset(mode)}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{t(`ci.recovery.preset.${mode}.title`)}</span>
                    <span className="mt-1 block text-2xl font-semibold tabular-nums text-primary">{baht(preset.reserve)}</span>
                    <span className="mt-1 block text-xs leading-6 text-white/70">{t(`ci.recovery.preset.${mode}.shortDescription`)}</span>
                  </span>
                </label>

                <details className="mt-3 border-t border-white/10 pt-3">
                  <summary className="min-h-11 py-3 cursor-pointer text-xs font-medium text-white/70 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {t.node("ci.recovery.expandLabel")}</summary>
                  <div className="mt-3 space-y-3">
                    <BreakdownRows recovery={preset.recovery} />
                    <button
                      type="button"
                      onClick={() => onChangeRecovery(copyPresetToCustom(mode))}
                      className="glass-button inline-flex min-h-11 w-full items-center justify-center px-4 text-xs"
                    >
                      {t.node("ci.recovery.action")}</button>
                  </div>
                </details>
              </article>
            );
          })}

          <article className={`lg:col-span-2 rounded-2xl border p-4 transition-colors ${selected === 'custom' ? 'border-primary/60 bg-primary/[0.08]' : 'border-white/10 bg-white/[0.02]'}`}>
            <label htmlFor="ci-recovery-choice-custom" className="flex min-h-11 cursor-pointer items-start gap-3">
              <input
                id="ci-recovery-choice-custom"
                type="radio"
                name="ci-recovery-choice"
                value="custom"
                checked={selected === 'custom'}
                onChange={chooseCustom}
                className="mt-1 h-4 w-4 shrink-0 accent-primary"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{t.node("ci.recovery.label")}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {t.node("ci.recovery.label2")}</span>
              </span>
            </label>

            <div className="mt-4 space-y-2">
              <label htmlFor="ci-recovery-custom-target" className="block min-h-10 text-xs text-white/65">{t.node("ci.recovery.recoveryCustomTarget.label")}</label>
              <CurrencyInput
                id="ci-recovery-custom-target"
                value={selected === 'custom' ? recovery.targetReserve : 0}
                onChange={(value) => onChangeRecovery({ ...recovery, mode: 'custom', targetReserve: value })}
                placeholder={t("ci.recovery.placeholder")}
                error={Boolean(targetError)}
                aria-describedby={targetError ? 'ci-recovery-custom-target-error' : undefined}
              />
              <FieldError id="ci-recovery-custom-target-error" message={targetError} />
              <button
                type="button"
                disabled={selected !== 'custom' || recovery.targetReserve <= 0}
                onClick={() => onChangeRecovery(buildCustomRecoveryFromTarget(recovery.targetReserve))}
                className="glass-button inline-flex min-h-11 w-full items-center justify-center px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.node("ci.recovery.action2")}</button>
            </div>

            {selected === 'custom' ? (
              <details className="mt-3 border-t border-white/10 pt-3">
                <summary className="min-h-11 py-3 cursor-pointer text-xs font-medium text-white/70 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {t.node("ci.recovery.expandLabel2")}</summary>
                <div className="mt-4 space-y-5">
                  <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <div className="flex items-start justify-between gap-4 text-xs">
                      <span className="text-muted-foreground">{t.node("ci.recovery.label3")}</span>
                      <strong className="tabular-nums text-primary">{baht(recovery.targetReserve)}</strong>
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-4 text-xs">
                      <span className="text-muted-foreground">{t.node("ci.recovery.label4")}</span>
                      <strong className="tabular-nums text-foreground">{baht(recoveryPreview.breakdownTotal)}</strong>
                    </div>
                    {recoveryPreview.unallocated > 0 ? (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {t.node("ci.recovery.description3")}<strong className="text-foreground">{baht(recoveryPreview.unallocated)}</strong> {t.node("ci.recovery.description4")}</p>
                    ) : null}
                    {recoveryPreview.overBudget > 0 ? (
                      <p className="mt-2 text-xs leading-5 text-[#ffb4b4]">
                        {t.node("ci.recovery.description5")}<strong>{baht(recoveryPreview.overBudget)}</strong>
                      </p>
                    ) : null}
                  </div>

                  <section className="space-y-4" aria-labelledby="ci-recovery-custom-services">
                    <h5 id="ci-recovery-custom-services" className="text-sm font-medium text-foreground">{t.node("ci.recovery.recoveryCustomServices.heading")}</h5>
                    <div className="grid items-start gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor="ci-recovery-treatment-visits" className="block min-h-10 text-xs text-white/65">{t.node("ci.recovery.recoveryTreatmentVisits.label")}</label>
                        <input
                          id="ci-recovery-treatment-visits"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100}
                          step={1}
                          value={recovery.treatmentVisits || ''}
                          onChange={(event) => updateCustomNumber('treatmentVisits', event.target.value === '' ? 0 : Number(event.target.value))}
                          className="h-12 w-full rounded-md border border-border/50 bg-background/50 px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="ci-recovery-treatment-rate" className="block min-h-10 text-xs text-white/65">{t.node("ci.recovery.recoveryTreatmentRate.label")}</label>
                        <CurrencyInput id="ci-recovery-treatment-rate" value={recovery.treatmentVisitUnitCost} onChange={(value) => updateCustomNumber('treatmentVisitUnitCost', value)} />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="ci-recovery-caregiver-days" className="block min-h-10 text-xs text-white/65">{t.node("ci.recovery.recoveryCaregiverDays.label")}</label>
                        <input
                          id="ci-recovery-caregiver-days"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={730}
                          step={1}
                          value={recovery.caregiverHomeDays || ''}
                          onChange={(event) => updateCustomNumber('caregiverHomeDays', event.target.value === '' ? 0 : Number(event.target.value))}
                          className="h-12 w-full rounded-md border border-border/50 bg-background/50 px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="ci-recovery-caregiver-rate" className="block min-h-10 text-xs text-white/65">{t.node("ci.recovery.recoveryCaregiverRate.label")}</label>
                        <CurrencyInput id="ci-recovery-caregiver-rate" value={recovery.caregiverDailyCost} onChange={(value) => updateCustomNumber('caregiverDailyCost', value)} />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="ci-recovery-rehab-sessions" className="block min-h-10 text-xs text-white/65">{t.node("ci.recovery.recoveryRehabSessions.label")}</label>
                        <input
                          id="ci-recovery-rehab-sessions"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={200}
                          step={1}
                          value={recovery.rehabSessions || ''}
                          onChange={(event) => updateCustomNumber('rehabSessions', event.target.value === '' ? 0 : Number(event.target.value))}
                          className="h-12 w-full rounded-md border border-border/50 bg-background/50 px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="ci-recovery-rehab-rate" className="block min-h-10 text-xs text-white/65">{t.node("ci.recovery.recoveryTreatmentRate.label")}</label>
                        <CurrencyInput id="ci-recovery-rehab-rate" value={recovery.rehabUnitCost} onChange={(value) => updateCustomNumber('rehabUnitCost', value)} />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3 border-t border-white/10 pt-4" aria-labelledby="ci-recovery-custom-items">
                    <h5 id="ci-recovery-custom-items" className="text-sm font-medium text-foreground">{t.node("ci.recovery.recoveryCustomItems.heading")}</h5>
                    <div className="grid items-start gap-4 sm:grid-cols-2">
                      {AMOUNT_FIELDS.map(({ field, label, help }) => (
                        <div key={field} className="space-y-2">
                          <label htmlFor={`ci-recovery-${field}`} className="block min-h-10 text-xs text-white/65">{label}</label>
                          <CurrencyInput
                            id={`ci-recovery-${field}`}
                            value={recovery[field]}
                            onChange={(value) => updateCustomAmount(field, value)}
                            showZero
                          />
                          {help ? <p className="text-[11px] leading-4 text-muted-foreground">{help}</p> : null}
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                    <button
                      type="button"
                      onClick={() => onChangeRecovery({ ...EMPTY_CI_RECOVERY, mode: 'custom', targetReserve: recovery.targetReserve })}
                      className="glass-button inline-flex min-h-11 items-center gap-2 px-4 text-xs"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      {t.node("ci.recovery.action3")}</button>
                    <button
                      type="button"
                      onClick={() => onChangeRecovery({ ...recovery, targetReserve: recoveryPreview.breakdownTotal })}
                      disabled={recoveryPreview.breakdownTotal <= 0}
                      className="glass-button inline-flex min-h-11 items-center px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t.node("ci.recovery.action4")}</button>
                  </div>
                </div>
              </details>
            ) : null}
          </article>
        </div>
      </fieldset>

      {selected !== 'none' ? (
        <div className="mt-5 rounded-xl border border-primary/30 bg-primary/[0.08] p-4">
          <p className="text-sm leading-6 text-foreground">{t.node("ci.recovery.description6")}</p>
          <output className="mt-1 block text-2xl font-semibold tabular-nums text-primary" aria-live="polite">
            {baht(recoveryPreview.reserveNeed)}
          </output>
          <p className="mt-2 text-xs leading-6 text-white/70">
            {t.node("ci.recovery.description7")}</p>
          <button
            type="button"
            onClick={() => onChangeRecovery({ ...EMPTY_CI_RECOVERY })}
            className="mt-3 inline-flex min-h-11 items-center text-xs text-muted-foreground underline decoration-white/30 underline-offset-4"
          >
            {t.node("ci.recovery.action5")}</button>
        </div>
      ) : (
        <p className="mt-4 text-xs leading-6 text-white/70">
          {t.node("ci.recovery.description8")}</p>
      )}

      <details className="mt-4 border-t border-white/10 pt-4">
        <summary className="min-h-11 py-3 cursor-pointer text-xs font-medium text-muted-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t.node("ci.recovery.expandLabel3")}</summary>
        <div className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground">
          <p>
            {t.node("ci.recovery.description9")}</p>
          {CI_RECOVERY_SOURCES.map((source) => (
            <p key={source.id}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline decoration-primary/40 underline-offset-4"
              >
                {t(`ci.recovery.source.${source.id}.publisher` as keyof typeof CI_COPY_DEFAULTS)} · {source.year}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              <br />
              {t(`ci.recovery.source.${source.id}.note` as keyof typeof CI_COPY_DEFAULTS)}
            </p>
          ))}
        </div>
      </details>
    </section>
  );
}
