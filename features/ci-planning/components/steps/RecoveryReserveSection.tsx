'use client';

import { ExternalLink, RotateCcw } from 'lucide-react';
import CurrencyInput from '@/components/ui/CurrencyInput';
import { calcRecoveryReserveNeed } from '@/features/ci-planning/calculator/calculator';
import type { CIRecoveryCosts, CIRecoveryMode } from '@/features/ci-planning/calculator/types';
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

const AMOUNT_FIELDS: Array<{ field: AmountField; label: string; help?: string }> = [
  { field: 'pulseOximeter', label: 'เครื่องวัดออกซิเจนปลายนิ้ว' },
  { field: 'bloodPressureMonitor', label: 'เครื่องวัดความดัน' },
  { field: 'thermometer', label: 'เครื่องวัดอุณหภูมิ' },
  { field: 'walker', label: 'Walker / อุปกรณ์ช่วยเดิน' },
  { field: 'wheelchair', label: 'Wheelchair' },
  { field: 'showerChair', label: 'เก้าอี้อาบน้ำ / อุปกรณ์ห้องน้ำ' },
  { field: 'grabRailAndSafety', label: 'ราวจับและอุปกรณ์ความปลอดภัยในบ้าน' },
  { field: 'hospitalBed', label: 'เตียงผู้ป่วย / อุปกรณ์ก้อนใหญ่' },
  { field: 'consumables', label: 'ของใช้สิ้นเปลืองช่วงพักฟื้น' },
  { field: 'homeAdaptation', label: 'ปรับบ้านเดิม / ห้องน้ำ / ทางลาด / พื้นที่ใช้งาน', help: 'เป็นงบเผื่อสำหรับการปรับบ้าน ไม่ใช่ราคาก่อสร้างตายตัว' },
  { field: 'majorHousing', label: 'Major Housing Reserve', help: 'เผื่อกรณีต่อเติมครั้งใหญ่ เปลี่ยนพื้นที่อยู่อาศัย หรือต้องจัดที่อยู่อาศัยใหม่ ไม่รวมราคาที่ดิน' },
  { field: 'contingency', label: 'เงินเผื่อความคลาดเคลื่อน' },
  { field: 'otherRecoveryCosts', label: 'ค่าใช้จ่ายอื่นช่วงพักฟื้น' },
];

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" tabIndex={-1} className="text-sm text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {message}
    </p>
  );
}

function BreakdownRows({ recovery: value }: { recovery: CIRecoveryCosts }) {
  const preview = calcRecoveryReserveNeed(value);
  const rows: Array<[string, number]> = [
    [`ติดตามรักษา ${preview.treatmentVisits} ครั้ง × ${baht(preview.treatmentVisitUnitCost)}`, preview.visitNeed],
    [`ผู้ดูแล ${preview.caregiverHomeDays} วัน × ${baht(preview.caregiverDailyCost)}`, preview.caregiverHomeNeed],
    [`กายภาพ/ฟื้นฟู ${preview.rehabSessions} ครั้ง × ${baht(preview.rehabUnitCost)}`, preview.rehabNeed],
    ['เครื่องวัดออกซิเจนปลายนิ้ว', preview.pulseOximeter],
    ['เครื่องวัดความดัน', preview.bloodPressureMonitor],
    ['เครื่องวัดอุณหภูมิ', preview.thermometer],
    ['Walker / อุปกรณ์ช่วยเดิน', preview.walker],
    ['Wheelchair', preview.wheelchair],
    ['เก้าอี้อาบน้ำ / อุปกรณ์ห้องน้ำ', preview.showerChair],
    ['ราวจับและอุปกรณ์ความปลอดภัย', preview.grabRailAndSafety],
    ['เตียงผู้ป่วย / อุปกรณ์ก้อนใหญ่', preview.hospitalBed],
    ['ของใช้สิ้นเปลือง', preview.consumables],
    ['ปรับบ้านเดิม / พื้นที่ใช้งาน', preview.homeAdaptation],
    ['Major Housing Reserve', preview.majorHousing],
    ['เงินเผื่อความคลาดเคลื่อน', preview.contingency],
    ['ค่าใช้จ่ายอื่น', preview.otherRecoveryCosts],
  ].filter(([, amount]) => amount > 0);

  return (
    <dl className="space-y-2 text-xs">
      {rows.map(([label, amount]) => (
        <div key={label} className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-2 last:border-b-0 last:pb-0">
          <dt className="min-w-0 text-white/60">{label}</dt>
          <dd className="shrink-0 font-medium tabular-nums text-foreground">{baht(amount)}</dd>
        </div>
      ))}
      <div className="flex items-start justify-between gap-4 pt-2">
        <dt className="font-medium text-foreground">รวมรายละเอียด</dt>
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
        <p className="text-xs font-medium text-primary">เงินสำรองสำหรับรักษา ฟื้นฟู และปรับการใช้ชีวิต</p>
        <h4 id="ci-recovery-title" className="text-base font-medium text-foreground">Recovery Reserve</h4>
        <p className="text-xs leading-5 text-white/60">
          ก้อนนี้แยกจากรายได้ ค่าใช้จ่ายประจำ ค่าเรียน และหนี้ เลือกชุดประมาณการที่ใกล้กับสิ่งที่อยากเผื่อไว้ก่อน
          แล้วค่อยเปิดดูรายละเอียด หรือเลือกกำหนดเองเพื่อแก้รายการย่อยได้
        </p>
      </div>

      <fieldset className="mt-5 space-y-3">
        <legend className="sr-only">เลือก Recovery Reserve</legend>
        <div className="grid gap-3 lg:grid-cols-2">
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
                    <span className="block text-sm font-medium text-foreground">{preset.title}</span>
                    <span className="mt-1 block text-2xl font-semibold tabular-nums text-primary">{baht(preset.reserve)}</span>
                    <span className="mt-1 block text-xs leading-5 text-white/55">{preset.shortDescription}</span>
                  </span>
                </label>

                <details className="mt-3 border-t border-white/10 pt-3">
                  <summary className="cursor-pointer text-xs font-medium text-white/70 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    ดูรายละเอียดการคำนวณ
                  </summary>
                  <div className="mt-3 space-y-3">
                    <BreakdownRows recovery={preset.recovery} />
                    <button
                      type="button"
                      onClick={() => onChangeRecovery(copyPresetToCustom(mode))}
                      className="glass-button inline-flex min-h-11 w-full items-center justify-center px-4 text-xs"
                    >
                      ใช้ชุดนี้แล้วปรับเอง
                    </button>
                  </div>
                </details>
              </article>
            );
          })}

          <article className={`rounded-2xl border p-4 transition-colors ${selected === 'custom' ? 'border-primary/60 bg-primary/[0.08]' : 'border-white/10 bg-white/[0.02]'}`}>
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
                <span className="block text-sm font-medium text-foreground">กำหนดเงินสำรองเอง</span>
                <span className="mt-1 block text-xs leading-5 text-white/55">
                  เริ่มจากจำนวนเงินที่อยากเผื่อ แล้วให้ระบบจัดตัวอย่างให้ ก่อนแก้วัน ครั้ง ราคา หรือรายการย่อยตามสถานการณ์ของคุณ
                </span>
              </span>
            </label>

            <div className="mt-4 space-y-2">
              <label htmlFor="ci-recovery-custom-target" className="text-xs text-white/65">เงินสำรองที่อยากเผื่อ</label>
              <CurrencyInput
                id="ci-recovery-custom-target"
                value={selected === 'custom' ? recovery.targetReserve : 0}
                onChange={(value) => onChangeRecovery({ ...recovery, mode: 'custom', targetReserve: value })}
                placeholder="เช่น 300,000"
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
                จัดตัวอย่างรายการตามยอดนี้
              </button>
            </div>

            {selected === 'custom' ? (
              <details className="mt-3 border-t border-white/10 pt-3">
                <summary className="cursor-pointer text-xs font-medium text-white/70 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  ดูและแก้ไขรายการย่อย
                </summary>
                <div className="mt-4 space-y-5">
                  <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <div className="flex items-start justify-between gap-4 text-xs">
                      <span className="text-white/55">เงินสำรองที่ตั้งไว้</span>
                      <strong className="tabular-nums text-primary">{baht(recovery.targetReserve)}</strong>
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-4 text-xs">
                      <span className="text-white/55">รวมรายละเอียดที่กรอก</span>
                      <strong className="tabular-nums text-foreground">{baht(recoveryPreview.breakdownTotal)}</strong>
                    </div>
                    {recoveryPreview.unallocated > 0 ? (
                      <p className="mt-2 text-xs leading-5 text-white/55">
                        ยังไม่ได้จัดสรร <strong className="text-foreground">{baht(recoveryPreview.unallocated)}</strong> จากเงินก้อนที่ตั้งไว้
                      </p>
                    ) : null}
                    {recoveryPreview.overBudget > 0 ? (
                      <p className="mt-2 text-xs leading-5 text-destructive">
                        รายละเอียดที่ปรับสูงกว่าเงินก้อนที่ตั้งไว้ <strong>{baht(recoveryPreview.overBudget)}</strong>
                      </p>
                    ) : null}
                  </div>

                  <section className="space-y-4" aria-labelledby="ci-recovery-custom-services">
                    <h5 id="ci-recovery-custom-services" className="text-sm font-medium text-foreground">การติดตาม การดูแล และการฟื้นฟู</h5>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor="ci-recovery-treatment-visits" className="text-xs text-white/65">ติดตามรักษา · จำนวนครั้ง</label>
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
                        <label htmlFor="ci-recovery-treatment-rate" className="text-xs text-white/65">ประมาณต่อครั้ง</label>
                        <CurrencyInput id="ci-recovery-treatment-rate" value={recovery.treatmentVisitUnitCost} onChange={(value) => updateCustomNumber('treatmentVisitUnitCost', value)} />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="ci-recovery-caregiver-days" className="text-xs text-white/65">ผู้ดูแล · จำนวนวัน</label>
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
                        <label htmlFor="ci-recovery-caregiver-rate" className="text-xs text-white/65">ประมาณต่อวัน</label>
                        <CurrencyInput id="ci-recovery-caregiver-rate" value={recovery.caregiverDailyCost} onChange={(value) => updateCustomNumber('caregiverDailyCost', value)} />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="ci-recovery-rehab-sessions" className="text-xs text-white/65">กายภาพ/ฟื้นฟู · จำนวนครั้ง</label>
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
                        <label htmlFor="ci-recovery-rehab-rate" className="text-xs text-white/65">ประมาณต่อครั้ง</label>
                        <CurrencyInput id="ci-recovery-rehab-rate" value={recovery.rehabUnitCost} onChange={(value) => updateCustomNumber('rehabUnitCost', value)} />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3 border-t border-white/10 pt-4" aria-labelledby="ci-recovery-custom-items">
                    <h5 id="ci-recovery-custom-items" className="text-sm font-medium text-foreground">อุปกรณ์ บ้าน และเงินเผื่อ</h5>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {AMOUNT_FIELDS.map(({ field, label, help }) => (
                        <div key={field} className="space-y-2">
                          <label htmlFor={`ci-recovery-${field}`} className="text-xs text-white/65">{label}</label>
                          <CurrencyInput
                            id={`ci-recovery-${field}`}
                            value={recovery[field]}
                            onChange={(value) => updateCustomAmount(field, value)}
                            showZero
                          />
                          {help ? <p className="text-[11px] leading-4 text-white/45">{help}</p> : null}
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
                      ล้างรายการย่อย
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeRecovery({ ...recovery, targetReserve: recoveryPreview.breakdownTotal })}
                      disabled={recoveryPreview.breakdownTotal <= 0}
                      className="glass-button inline-flex min-h-11 items-center px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ใช้ยอดรวมจากรายละเอียด
                    </button>
                  </div>
                </div>
              </details>
            ) : null}
          </article>
        </div>
      </fieldset>

      {selected !== 'none' ? (
        <div className="mt-5 rounded-xl border border-primary/30 bg-primary/[0.08] p-4">
          <p className="text-xs font-medium text-primary">Recovery Reserve ที่เลือก</p>
          <output className="mt-1 block text-2xl font-semibold tabular-nums text-primary" aria-live="polite">
            {baht(recoveryPreview.reserveNeed)}
          </output>
          <p className="mt-2 text-xs leading-5 text-white/60">
            ระบบจะนำเงินก้อนนี้ไปบวกเพิ่มเพียง 1 ครั้งในวิธีคำนวณที่คุณใช้ โดยไม่รวมซ้ำกับรายได้ ค่าใช้จ่ายประจำ ค่าเรียน หรือหนี้
          </p>
          <button
            type="button"
            onClick={() => onChangeRecovery({ ...EMPTY_CI_RECOVERY })}
            className="mt-3 inline-flex min-h-11 items-center text-xs text-white/60 underline decoration-white/30 underline-offset-4"
          >
            ยังไม่รวม Recovery Reserve
          </button>
        </div>
      ) : (
        <p className="mt-4 text-xs leading-5 text-white/45">
          ยังไม่ได้เลือกเงินสำรองก้อนนี้ หากไม่เลือก ระบบจะคำนวณเฉพาะฐานรายได้หรือรายจ่ายและภาระที่กรอก
        </p>
      )}

      <details className="mt-4 border-t border-white/10 pt-4">
        <summary className="cursor-pointer text-xs font-medium text-white/60 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          ที่มาของตัวเลขประมาณการ
        </summary>
        <div className="mt-3 space-y-3 text-xs leading-5 text-white/50">
          <p>
            ตัวเลขใน 3 ชุดแรกเป็น planning benchmark ที่ปัดเผื่อเพื่อใช้วางเงินสำรอง ไม่ใช่ราคาค่าบริการตายตัว
            และไม่ใช่คำแนะนำทางการแพทย์ว่าทุกคนจำเป็นต้องใช้อุปกรณ์หรือปรับบ้านเหมือนกัน
          </p>
          {CI_RECOVERY_SOURCES.map((source) => (
            <p key={source.id}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline decoration-primary/40 underline-offset-4"
              >
                {source.publisher} · {source.year}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              <br />
              {source.note}
            </p>
          ))}
        </div>
      </details>
    </section>
  );
}
