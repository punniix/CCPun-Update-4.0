'use client';

import { Shield } from 'lucide-react';
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

  return (
    <div className="form-glass space-y-8 p-5 md:p-8 lg:p-10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 tabIndex={-1} className="scroll-mt-28 rounded-sm text-xl font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">เงินก้อนและสินทรัพย์ที่พร้อมใช้</h2>
          <p className="text-sm text-muted-foreground">กรอกเท่าที่ทราบ หรือเว้นไว้ได้หากยังไม่มี</p>
        </div>
      </div>

      <div className="space-y-6" aria-label="ข้อมูลเงินก้อนและสินทรัพย์ที่พร้อมใช้">
        <div className="space-y-2">
          <label htmlFor="ci-lump-sum" className="text-sm font-semibold text-foreground">
            เงินก้อนจากประกันโรคร้ายแรงที่มี
          </label>
          <CurrencyInput
            id="ci-lump-sum"
            value={existingCI.lumpSum}
            onChange={(value) => handleAmount('lumpSum', value)}
            placeholder="เช่น 1,000,000"
            error={Boolean(errors.lumpSum)}
            aria-describedby={errors.lumpSum ? 'ci-lump-sum-help ci-lump-sum-error' : 'ci-lump-sum-help'}
          />
          {errors.lumpSum && <p id="ci-lump-sum-error" role="alert" tabIndex={-1} className="text-sm text-destructive">{errors.lumpSum}</p>}
          <p id="ci-lump-sum-help" className="text-sm leading-relaxed text-muted-foreground">
            ดูจำนวนเงินก้อนจากกรมธรรม์ที่คาดว่าจะได้รับเมื่อเป็นไปตามเงื่อนไข
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="ci-liquid-assets" className="text-sm font-semibold text-foreground">
            สินทรัพย์สภาพคล่องที่พร้อมใช้
          </label>
          <div id="ci-liquid-assets-guidance" role="note" className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">นับเฉพาะเงินที่ตั้งใจใช้ในแผนนี้</p>
            <p className="mt-1">กรอกเฉพาะสินทรัพย์สภาพคล่องที่พร้อมนำมาใช้ได้จริง บ้าน รถ หรือทรัพย์สินจำเป็นที่ไม่ตั้งใจขายไม่ต้องกรอก</p>
          </div>
          <CurrencyInput
            id="ci-liquid-assets"
            value={existingCI.liquidAssets}
            onChange={(value) => handleAmount('liquidAssets', value)}
            showZero
            placeholder="เช่น 500,000"
            error={Boolean(errors.liquidAssets)}
            aria-describedby={errors.liquidAssets ? 'ci-liquid-assets-guidance ci-liquid-assets-help ci-liquid-assets-error' : 'ci-liquid-assets-guidance ci-liquid-assets-help'}
          />
          {errors.liquidAssets && <p id="ci-liquid-assets-error" role="alert" tabIndex={-1} className="text-sm text-destructive">{errors.liquidAssets}</p>}
          <p id="ci-liquid-assets-help" className="text-sm leading-relaxed text-muted-foreground">
            หากยังไม่มีสินทรัพย์ที่ต้องการนำมาคิด กรอก 0 ได้
          </p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        ระบบนำสองส่วนนี้มารวมเป็นทรัพยากรที่พร้อมใช้ แล้วหักออกจากประมาณการของวิธีที่คุณเลือก
      </p>
    </div>
  );
}
