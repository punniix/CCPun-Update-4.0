'use client';
import type { SITE_COPY_DEFAULTS } from '@/lib/content/site-copy-defaults';
import { usePublicCopy } from '@/components/ui/PublicCopyProvider';
import { FHC_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';


import { useState } from 'react';
import { Download } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

type Summary = {
  familySupport: number;
  debtAndEducation: number;
  resources: number;
  gap: number;
};

function amount(value: number): string {
  return `${Math.round(value).toLocaleString('th-TH')} บาท`;
}

async function makeImage(summary: Summary, t: (key: keyof typeof FHC_COPY_DEFAULTS) => string, imageText: (key: keyof typeof SITE_COPY_DEFAULTS) => string): Promise<Blob> {
  const { renderResultShareImage } = await import('@/lib/shared/result-share-image');
  return renderResultShareImage({
    toolName: t("fhc.download.image.toolName"),
    resultLabel: t("fhc.download.image.resultLabel"),
    primaryAmount: amount(summary.gap),
    metrics: [
      { label: t("fhc.download.image.label3"), value: amount(summary.familySupport) },
      { label: t("fhc.download.image.label2"), value: amount(summary.debtAndEducation) },
      { label: t("fhc.download.image.label"), value: amount(summary.resources), emphasis: true },
    ],
    methodTitle: t("fhc.download.image.methodTitle"),
    methodDetail: t("fhc.download.image.methodDetail"),
    noticeTitle: t("fhc.download.image.noticeTitle"),
    noticeDetail: t("fhc.download.image.noticeDetail"),
    actionLabel: t("fhc.download.image.actionLabel"),
  }, '/assets/ccpun-text-logo.svg', '/assets/line-oa-qr.png', imageText);
}

export default function FHCLifeResultImageDownloadButton({ summary }: { summary: Summary }) {
  const t = usePublicCopy(FHC_COPY_DEFAULTS);
  const imageText = usePublicCopy();

  const [status, setStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle');

  async function download(): Promise<void> {
    if (status === 'working') return;
    setStatus('working');
    try {
      const blob = await makeImage(summary, t, imageText);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ccpun-life-coverage-summary-${new Date().toISOString().slice(0, 10)}.png`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      trackEvent('fhc_result_download', { tool_name: 'fhc', cta_location: 'fhc_result', surface_group: 'fhc' });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  return <div className="space-y-2">
    <button type="button" onClick={download} disabled={status === 'working'} aria-busy={status === 'working'} aria-describedby="fhc-image-privacy fhc-image-status" className="glass-button inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3 sm:w-auto"><Download className="h-5 w-5" aria-hidden="true" />{status === 'working' ? t("fhc.download.label") : t("fhc.download.label2")}</button>
    <p id="fhc-image-privacy" className="text-xs text-muted-foreground">{t("fhc.download.imagePrivacy.description")}</p>
    <p id="fhc-image-status" aria-live="polite" className="min-h-5 text-xs text-muted-foreground">{status === 'success' ? t("fhc.download.label3") : status === 'error' ? t("fhc.download.label4") : ''}</p>
  </div>;
}
