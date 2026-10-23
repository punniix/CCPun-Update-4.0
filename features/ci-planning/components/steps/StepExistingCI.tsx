'use client';
import { usePublicCopy } from '@/components/ui/PublicCopyProvider';
import { CI_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';


import CurrencyInput from '@/components/ui/CurrencyInput';
import type { CIFormData } from '@/features/ci-planning/calculator/types';

interface StepProps {
  data: CIFormData;
  updateData: (section: keyof CIFormData, value: CIFormData[keyof CIFormData]) => void;
  errors: Record<string, string>;
}

export default function StepExistingCI({ data, updateData, errors }: StepProps) {
  const t = usePublicCopy(CI_COPY_DEFAULTS);

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
      <label htmlFor="ci-lump-sum" className="text-sm font-medium text-foreground">{t.node("ci.resources.lumpSum.label")}</label>
      <CurrencyInput id="ci-lump-sum" value={existingCI.lumpSum} onChange={(value) => handleAmount('lumpSum', value)} placeholder={t("ci.resources.placeholder")} error={Boolean(errors.lumpSum)} aria-describedby={errors.lumpSum ? 'ci-lump-sum-help ci-lump-sum-error' : 'ci-lump-sum-help'} />
      {errors.lumpSum && <p id="ci-lump-sum-error" role="alert" tabIndex={-1} className="text-sm text-destructive">{errors.lumpSum}</p>}
      <p id="ci-lump-sum-help" className="text-xs leading-6 text-white/70">{t.node("ci.resources.lumpSumHelp.description")}</p>
    </div>

    <div className="space-y-2">
      <label htmlFor="ci-liquid-assets" className="text-sm font-medium text-foreground">{t.node("ci.resources.liquidAssets.label")}</label>
      <CurrencyInput id="ci-liquid-assets" value={existingCI.liquidAssets} onChange={(value) => handleAmount('liquidAssets', value)} showZero placeholder={t("ci.resources.placeholder2")} error={Boolean(errors.liquidAssets)} aria-describedby={errors.liquidAssets ? 'ci-liquid-assets-help ci-liquid-assets-error' : 'ci-liquid-assets-help'} />
      {errors.liquidAssets && <p id="ci-liquid-assets-error" role="alert" tabIndex={-1} className="text-sm text-destructive">{errors.liquidAssets}</p>}
      <p id="ci-liquid-assets-help" className="text-xs leading-6 text-white/70">{t.node("ci.resources.liquidAssetsHelp.description")}</p>
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
        <span className="block text-sm font-medium text-foreground">{t.node("ci.resources.label")}</span>
        <span className="mt-1 block text-xs leading-6 text-white/70">{t.node("ci.resources.label2")}</span>
      </span>
    </label>

    <p className="border-t border-white/10 pt-4 text-xs leading-6 text-white/70">{t.node("ci.resources.description")}</p>
  </div>;
}
