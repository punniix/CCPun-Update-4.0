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
    updateData('existingCI', {
      ...existingCI,
      [field]: value,
      ...(field === 'liquidAssets' && value <= 0 ? { protectLiquidAssets: false } : {}),
    });
  };

  return <div className="space-y-5" data-ui="human-centered-ci-resources">
    <div className="space-y-2">
      <label htmlFor="ci-lump-sum" className="text-sm font-medium text-foreground">เงินก้อนจากประกันโรคร้ายแรงที่มี</label>
      <CurrencyInput id="ci-lump-sum" value={existingCI.lumpSum} onChange={(value) => handleAmount('lumpSum', value)} placeholder="เช่น 1,000,000" error={Boolean(errors.lumpSum)} aria-describedby={errors.lumpSum ? 'ci-lump-sum-help ci-lump-sum-error' : 'ci-lump-sum-help'} />
      {errors.lumpSum && <p id="ci-lump-sum-error" role="alert" tabIndex={-1} className="text-sm text-destructive">{errors.lumpSum}</p>}
      <p id="ci-lump-sum-help" className="text-xs leading-6 text-white/70">ดูจำนวนเงินก้อนจากกรมธรรม์ที่คาดว่าจะได้รับเมื่อเป็นไปตามเงื่อนไข</p>
    </div>

    <div className="space-y-2">
      <label htmlFor="ci-liquid-assets" className="text-sm font-medium text-foreground">สินทรัพย์สภาพคล่องที่มี (ไม่ใช่ประกันโรคร้ายแรง)</label>
      <CurrencyInput id="ci-liquid-assets" value={existingCI.liquidAssets} onChange={(value) => handleAmount('liquidAssets', value)} showZero placeholder="เช่น 500,000" error={Boolean(errors.liquidAssets)} aria-describedby={errors.liquidAssets ? 'ci-liquid-assets-help ci-liquid-assets-error' : 'ci-liquid-assets-help'} />
      {errors.liquidAssets && <p id="ci-liquid-assets-error" role="alert" tabIndex={-1} className="text-sm text-destructive">{errors.liquidAssets}</p>}
      <p id="ci-liquid-assets-help" className="text-xs leading-6 text-white/70">เช่น เงินสดหรือเงินฝากที่มีอยู่ บ้าน รถ หรือทรัพย์สินที่แปลงเป็นเงินได้ยากยังไม่รวมในช่องนี้</p>
    </div>

    <label className={`flex items-start gap-3 rounded-xl border border-white/10 p-4 ${existingCI.liquidAssets > 0 ? 'cursor-pointer' : 'opacity-60'}`}>
      <input
        type="checkbox"
        checked={existingCI.protectLiquidAssets ?? false}
        disabled={existingCI.liquidAssets <= 0}
        onChange={(event) => updateData('existingCI', { ...existingCI, protectLiquidAssets: event.target.checked })}
        className="mt-1 h-5 w-5 accent-primary"
      />
      <span>
        <span className="block text-sm font-medium text-foreground">ต้องการรักษาสินทรัพย์สภาพคล่องก้อนนี้ไว้</span>
        <span className="mt-1 block text-xs leading-6 text-white/70">เมื่อเลือก ระบบจะเพิ่ม “เป้าหมายรักษาสินทรัพย์” เท่ากับยอดที่กรอกไว้ในทุนที่ต้องเตรียม เพื่อเผื่อให้ยังเหลือสินทรัพย์ก้อนนี้หลังรับมือค่าใช้จ่าย</span>
      </span>
    </label>

    <p className="border-t border-white/10 pt-4 text-xs leading-6 text-white/70">เงินก้อนประกันและสินทรัพย์ที่กรอกจะแสดงเป็นทุนที่มี หากเลือกปกป้องสินทรัพย์ ระบบเพิ่มเป้าหมายอีกหนึ่งครั้ง โดยไม่ส่งตัวเลขเหล่านี้ไปยัง Analytics</p>
  </div>;
}
