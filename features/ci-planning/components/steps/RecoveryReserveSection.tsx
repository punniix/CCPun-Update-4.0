'use client';

import { ExternalLink } from 'lucide-react';
import type { ChangeEvent } from 'react';
import CurrencyInput from '@/components/ui/CurrencyInput';
import type { CIRecoveryCosts } from '@/features/ci-planning/calculator/types';
import { CI_RECOVERY_REFERENCE, CI_RECOVERY_SOURCES } from '@/features/ci-planning/recovery-evidence';
import { baht, safeRecoveryPreview, type RecoveryAmountField, type RecoveryCountField } from './StepExpenses.model';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" tabIndex={-1} className="text-sm text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{message}</p>;
}

function RecoverySourceLink({ id, children }: { id: string; children: React.ReactNode }) {
  const source = CI_RECOVERY_SOURCES.find((item) => item.id === id);
  if (!source) return <>{children}</>;
  return <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary">{children}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a>;
}

type Props = {
  open: boolean;
  recovery: CIRecoveryCosts;
  errors: Record<string, string>;
  recoveryPreview: ReturnType<typeof safeRecoveryPreview>;
  handleRecoveryCount: (field: RecoveryCountField, event: ChangeEvent<HTMLInputElement>) => void;
  handleRecoveryAmount: (field: RecoveryAmountField, value: number) => void;
};

export default function RecoveryReserveSection({ open: hasRecoveryData, recovery, errors, recoveryPreview, handleRecoveryCount, handleRecoveryAmount }: Props) {
  return (
<details open={hasRecoveryData} className="group border-t border-white/10 pt-4" data-ui="ci-recovery-reserve">
      <summary className="cursor-pointer py-2 text-sm font-medium text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">ค่าใช้จ่ายช่วงรักษาและพักฟื้น (Recovery Reserve)</summary>
      <div className="mt-5 space-y-6">
        <p className="text-xs leading-5 text-white/60">ส่วนนี้เป็นประมาณการจากข้อมูล research สำหรับค่าใช้จ่ายนอกโรงพยาบาล คำนวณเป็นก้อนแยกเพื่อให้เห็นที่มาชัดเจน แล้วบวกเพิ่ม 1 ครั้งในยอดรวมของแต่ละวิธีที่มีฐานข้อมูล ระบบไม่ตั้งยอดมาตรฐานให้ทุกคน จำนวนครั้ง/วันและค่าใช้จ่ายเริ่มที่ 0 จนกว่าคุณจะกรอกเอง</p>

        <section className="space-y-3" aria-labelledby="ci-recovery-visits-title">
          <h4 id="ci-recovery-visits-title" className="text-sm font-medium text-foreground">ค่าใช้จ่ายต่อครั้งที่ไปรักษา/ติดตาม</h4>
          <p className="text-xs leading-5 text-white/60">อ้างอิงงานวิจัยไทยปี 2025: เดินทาง {baht(CI_RECOVERY_REFERENCE.treatmentVisit.transport)} + อาหาร {baht(CI_RECOVERY_REFERENCE.treatmentVisit.food)} + ค่ารักษาเพิ่มนอกสิทธิ {baht(CI_RECOVERY_REFERENCE.treatmentVisit.additionalMedicalOutOfPocket)} + รายได้ผู้ดูแลที่หายไป {baht(CI_RECOVERY_REFERENCE.treatmentVisit.caregiverLostIncome)} = <strong className="text-foreground">{baht(CI_RECOVERY_REFERENCE.treatmentVisit.total)}/ครั้ง</strong> · <RecoverySourceLink id="thai-breast-cancer-cost-2025">ที่มา</RecoverySourceLink></p>
          <div className="space-y-2"><label htmlFor="ci-recovery-treatment-visits" className="text-xs text-white/65">คาดว่าจะมีค่าใช้จ่ายลักษณะนี้กี่ครั้ง</label><input id="ci-recovery-treatment-visits" type="number" inputMode="numeric" min={0} max={100} step={1} value={recovery.treatmentVisits || ''} onChange={(event) => handleRecoveryCount('treatmentVisits', event)} placeholder="0" aria-invalid={Boolean(errors['recovery.treatmentVisits']) || undefined} className="h-12 w-full rounded-md border border-border/50 bg-background/50 px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /><FieldError id="ci-recovery-treatment-visits-error" message={errors['recovery.treatmentVisits']} /></div>
          <p className="text-xs text-white/60">รวมส่วนนี้ <strong className="text-foreground">{baht(recoveryPreview.visitNeed)}</strong></p>
        </section>

        <section className="space-y-3 border-t border-white/10 pt-5" aria-labelledby="ci-recovery-caregiver-title">
          <h4 id="ci-recovery-caregiver-title" className="text-sm font-medium text-foreground">ผู้ดูแลที่ต้องหยุดงานมาดูแลที่บ้าน</h4>
          <p className="text-xs leading-5 text-white/60">งานวิจัยไทยปี 2025 พบรายได้ผู้ดูแลที่หายไปจากการดูแลที่บ้านเฉลี่ย <strong className="text-foreground">{baht(CI_RECOVERY_REFERENCE.caregiverHomePerDay)}/วัน</strong> · <RecoverySourceLink id="thai-breast-cancer-cost-2025">ที่มา</RecoverySourceLink></p>
          <div className="space-y-2"><label htmlFor="ci-recovery-caregiver-days" className="text-xs text-white/65">คาดว่าจะกระทบกี่วัน</label><input id="ci-recovery-caregiver-days" type="number" inputMode="numeric" min={0} max={730} step={1} value={recovery.caregiverHomeDays || ''} onChange={(event) => handleRecoveryCount('caregiverHomeDays', event)} placeholder="0" aria-invalid={Boolean(errors['recovery.caregiverHomeDays']) || undefined} className="h-12 w-full rounded-md border border-border/50 bg-background/50 px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /><FieldError id="ci-recovery-caregiver-days-error" message={errors['recovery.caregiverHomeDays']} /></div>
          <p className="text-xs text-white/60">รวมส่วนนี้ <strong className="text-foreground">{baht(recoveryPreview.caregiverHomeNeed)}</strong></p>
        </section>

        <section className="space-y-3 border-t border-white/10 pt-5" aria-labelledby="ci-recovery-rehab-title">
          <h4 id="ci-recovery-rehab-title" className="text-sm font-medium text-foreground">กายภาพ/ฟื้นฟู</h4>
          <p className="text-xs leading-5 text-white/60">benchmark สปสช. ปี 2569: {baht(CI_RECOVERY_REFERENCE.rehabilitation.perSession)}/ครั้ง และถ้าให้บริการที่บ้านเพิ่ม {baht(CI_RECOVERY_REFERENCE.rehabilitation.homeServiceAddOnPerSession)}/ครั้ง ภายใต้กรอบไม่เกิน {CI_RECOVERY_REFERENCE.rehabilitation.benchmarkSessionLimit} ครั้ง · <RecoverySourceLink id="nhso-rehab-2026">ที่มา</RecoverySourceLink> (เป็นอัตราจ่ายบริการภาครัฐ ไม่ใช่ราคาคลินิกเอกชน)</p>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="ci-recovery-rehab-sessions" className="text-xs text-white/65">จำนวนครั้งกายภาพทั้งหมด</label><input id="ci-recovery-rehab-sessions" type="number" inputMode="numeric" min={0} max={20} step={1} value={recovery.rehabSessions || ''} onChange={(event) => handleRecoveryCount('rehabSessions', event)} placeholder="0" aria-invalid={Boolean(errors['recovery.rehabSessions']) || undefined} className="h-12 w-full rounded-md border border-border/50 bg-background/50 px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /><FieldError id="ci-recovery-rehab-sessions-error" message={errors['recovery.rehabSessions']} /></div><div className="space-y-2"><label htmlFor="ci-recovery-home-rehab-sessions" className="text-xs text-white/65">ในนี้เป็นบริการที่บ้านกี่ครั้ง</label><input id="ci-recovery-home-rehab-sessions" type="number" inputMode="numeric" min={0} max={20} step={1} value={recovery.homeRehabSessions || ''} onChange={(event) => handleRecoveryCount('homeRehabSessions', event)} placeholder="0" aria-invalid={Boolean(errors['recovery.homeRehabSessions']) || undefined} className="h-12 w-full rounded-md border border-border/50 bg-background/50 px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /><FieldError id="ci-recovery-home-rehab-sessions-error" message={errors['recovery.homeRehabSessions']} /></div></div>
          <p className="text-xs text-white/60">รวมส่วนนี้ <strong className="text-foreground">{baht(recoveryPreview.rehabNeed)}</strong></p>
        </section>

        <section className="space-y-3 border-t border-white/10 pt-5" aria-labelledby="ci-recovery-manual-title">
          <h4 id="ci-recovery-manual-title" className="text-sm font-medium text-foreground">อุปกรณ์ / ปรับบ้าน / ค่าใช้จ่ายอื่น</h4>
          <p className="text-xs leading-5 text-white/60">กรอกตามสถานการณ์จริง ระบบไม่เติมให้เอง ปัจจุบันโครงการปรับบ้านผู้สูงอายุของกรมกิจการผู้สูงอายุปี 2568 ใช้วงเงินสนับสนุนอ้างอิงสูงสุด <strong className="text-foreground">{baht(CI_RECOVERY_REFERENCE.homeModificationPublicProgramCeiling)}</strong>/หลัง · <RecoverySourceLink id="dop-home-2025">ที่มา</RecoverySourceLink> ซึ่งไม่ใช่ราคาตลาด</p>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="ci-recovery-equipment-home" className="text-xs text-white/65">อุปกรณ์และ/หรือปรับบ้าน</label><CurrencyInput id="ci-recovery-equipment-home" value={recovery.equipmentAndHomeModification} onChange={(value) => handleRecoveryAmount('equipmentAndHomeModification', value)} placeholder="กรอกตามที่คาด" error={Boolean(errors['recovery.equipmentAndHomeModification'])} /></div><div className="space-y-2"><label htmlFor="ci-recovery-other" className="text-xs text-white/65">ค่าใช้จ่ายช่วงพักฟื้นอื่น</label><CurrencyInput id="ci-recovery-other" value={recovery.otherRecoveryCosts} onChange={(value) => handleRecoveryAmount('otherRecoveryCosts', value)} placeholder="กรอกตามที่คาด" error={Boolean(errors['recovery.otherRecoveryCosts'])} /></div></div>
        </section>

        <div className="rounded-xl border border-primary/30 bg-primary/[0.08] p-4"><p className="text-xs font-medium text-primary">Recovery Reserve จากข้อมูลที่กรอก · คำนวณแยก</p><output className="mt-1 block text-2xl font-semibold tabular-nums text-primary" aria-live="polite">{baht(recoveryPreview.total)}</output><p className="mt-2 text-xs leading-5 text-white/60">ก้อนนี้จะถูกบวกเพิ่ม 1 ครั้งในยอดรวมของแต่ละวิธีที่มีฐานข้อมูล แต่ทุนตามรายจ่ายกับทุนตามรายได้จะยังแสดงแยกกันและไม่ถูกนำมาบวกเข้าหากัน</p></div>
      </div>
    </details>
  );
}
