'use client';

import CurrencyInput from '@/components/ui/CurrencyInput';
import type { CIFormData } from '@/features/ci-planning/calculator/types';

interface StepProps {
  data: CIFormData;
  updateData: (section: keyof CIFormData, value: CIFormData[keyof CIFormData]) => void;
  errors: Record<string, string>;
}

export default function StepExistingCI({ data, updateData, errors }: StepProps) {
  const existingCI = data.existingCI;
  const handleAmount = (field: 'lumpSum' | 'liquidAssets', value: number) => {
    updateData('existingCI', { ...existingCI, [field]: value });
  };

  return <div className="space-y-5" data-ui="human-centered-ci-resources">
    <div className="space-y-2">
      <label htmlFor="ci-lump-sum" className="text-sm font-medium text-foreground">เงินก้อนจากประกันโรคร้ายแรงที่มี</label>
      <CurrencyInput id="ci-lump-sum" value={existingCI.lumpSum} onChange={(value) => handleAmount('lumpSum', value)} placeholder="เช่น 1,000,000" error={Boolean(errors.lumpSum)} aria-describedby={errors.lumpSum ? 'ci-lump-sum-help ci-lump-sum-error' : 'ci-lump-sum-help'} />
      {errors.lumpSum && <p id="ci-lump-sum-error" role="alert" tabIndex={-1} className="text-sm text-destructive">{errors.lumpSum}</p>}
      <p id="ci-lump-sum-help" className="text-xs leading-5 text-white/45">ดูจำนวนเงินก้อนจากกรมธรรม์ที่คาดว่าจะได้รับเมื่อเป็นไปตามเงื่อนไข</p>
    </div>

    <div className="space-y-2">
      <label htmlFor="ci-liquid-assets" className="text-sm font-medium text-foreground">สินทรัพย์สภาพคล่องที่พร้อมใช้</label>
      <CurrencyInput id="ci-liquid-assets" value={existingCI.liquidAssets} onChange={(value) => handleAmount('liquidAssets', value)} showZero placeholder="เช่น 500,000" error={Boolean(errors.liquidAssets)} aria-describedby={errors.liquidAssets ? 'ci-liquid-assets-help ci-liquid-assets-error' : 'ci-liquid-assets-help'} />
      {errors.liquidAssets && <p id="ci-liquid-assets-error" role="alert" tabIndex={-1} className="text-sm text-destructive">{errors.liquidAssets}</p>}
      <p id="ci-liquid-assets-help" className="text-xs leading-5 text-white/45">นับเฉพาะเงินสด เงินฝาก หรือสินทรัพย์ที่ตั้งใจนำมาใช้จริง บ้าน รถ หรือทรัพย์สินจำเป็นที่ไม่ตั้งใจขายไม่ต้องกรอก</p>
    </div>

    <p className="border-t border-white/10 pt-4 text-xs leading-5 text-white/45">ระบบรวมสองส่วนนี้เป็น “ทรัพยากรที่พร้อมใช้” แล้วนำไปเทียบกับประมาณการของวิธีที่คุณเลือก โดยไม่ส่งตัวเลขเหล่านี้ไปยัง Analytics</p>
  </div>;
}
