'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { CI_ASSESSMENT_VERSION } from '@/features/ci-planning/calculator/constants';
import type { CIEstimationMethod, CIResult } from '@/features/ci-planning/calculator/types';

interface ResultImageDownloadButtonProps {
  result: CIResult;
  selectedMethod: CIEstimationMethod;
}

type DownloadState = 'idle' | 'working' | 'success' | 'error';

export default function ResultImageDownloadButton({
  result,
  selectedMethod,
}: ResultImageDownloadButtonProps) {
  const [state, setState] = useState<DownloadState>('idle');

  async function handleDownload(): Promise<void> {
    if (state === 'working') return;
    setState('working');

    try {
      const { createCIResultImageSummary, renderCIResultImage } = await import('@/features/ci-planning/result-image');
      const summary = createCIResultImageSummary(result, selectedMethod, CI_ASSESSMENT_VERSION);
      const blob = await renderCIResultImage(summary);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `ccpun-critical-illness-summary-${new Date().toISOString().slice(0, 10)}.png`;
      anchor.hidden = true;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);

      trackEvent('result_image_download', {
        tool_name: 'ci_planning',
        cta_location: 'ci_result',
        destination: 'result_image',
        assessment_version: CI_ASSESSMENT_VERSION,
      });
      setState('success');
    } catch (error) {
      console.error('Result image generation failed', error);
      setState('error');
    }
  }

  const statusMessage = state === 'working'
    ? 'กำลังสร้างภาพสรุปบนอุปกรณ์นี้'
    : state === 'success'
      ? 'เริ่มดาวน์โหลดภาพสรุปแล้ว'
      : state === 'error'
        ? 'สร้างภาพไม่สำเร็จ กรุณาลองอีกครั้ง'
        : '';

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={state === 'working'}
        aria-busy={state === 'working'}
        aria-describedby="ci-result-image-privacy ci-result-image-status"
        className="glass-button inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3 sm:w-auto"
      >
        <Download className="h-5 w-5" aria-hidden="true" />
        {state === 'working' ? 'กำลังสร้างภาพ…' : 'บันทึกภาพสรุป'}
      </button>
      <p id="ci-result-image-privacy" className="text-xs leading-relaxed text-muted-foreground">
        ภาพสร้างบนอุปกรณ์นี้ ไม่มีการอัปโหลดข้อมูลที่คุณกรอก
      </p>
      <p id="ci-result-image-status" className="min-h-5 text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>
    </div>
  );
}
