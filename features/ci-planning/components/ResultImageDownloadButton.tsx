'use client';

import { useEffect, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { CI_ASSESSMENT_VERSION } from '@/features/ci-planning/calculator/constants';
import type { CIEstimationMethod, CIResult } from '@/features/ci-planning/calculator/types';

interface ResultImageDownloadButtonProps {
  result: CIResult;
  selectedMethod: CIEstimationMethod;
}

type ActionState = 'idle' | 'downloading' | 'downloaded' | 'sharing' | 'share-opened' | 'error';

async function createResultFile(result: CIResult, selectedMethod: CIEstimationMethod): Promise<File> {
  const { createCIResultImageSummary, renderCIResultImage } = await import('@/features/ci-planning/result-image');
  const summary = createCIResultImageSummary(result, selectedMethod, CI_ASSESSMENT_VERSION);
  const blob = await renderCIResultImage(summary);
  return new File([blob], `ccpun-critical-illness-summary-${new Date().toISOString().slice(0, 10)}.png`, { type: 'image/png' });
}

export default function ResultImageDownloadButton({
  result,
  selectedMethod,
}: ResultImageDownloadButtonProps) {
  const [state, setState] = useState<ActionState>('idle');
  const [prepared, setPrepared] = useState<{ result: CIResult; method: CIEstimationMethod; file: File } | null>(null);
  const imageFile = prepared?.result === result && prepared.method === selectedMethod ? prepared.file : null;
  const canShareFile = imageFile && typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [imageFile] });

  useEffect(() => {
    let current = true;
    void createResultFile(result, selectedMethod)
      .then((file) => { if (current) setPrepared({ result, method: selectedMethod, file }); })
      .catch(() => { if (current) setPrepared(null); });
    return () => { current = false; };
  }, [result, selectedMethod]);

  async function handleDownload(): Promise<void> {
    if (state === 'downloading' || state === 'sharing') return;
    setState('downloading');

    try {
      const file = imageFile ?? await createResultFile(result, selectedMethod);
      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = file.name;
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
      setState('downloaded');
    } catch (error) {
      console.error('Result image generation failed', error);
      setState('error');
    }
  }

  async function handleShare(): Promise<void> {
    if (!imageFile || !canShareFile || state === 'downloading' || state === 'sharing') return;
    setState('sharing');
    try {
      // ponytail: the file is prepared first so the native share call keeps its user gesture.
      await navigator.share({ files: [imageFile] });
      setState('share-opened');
    } catch (error) {
      setState(error instanceof DOMException && error.name === 'AbortError' ? 'idle' : 'error');
    }
  }

  const statusMessage = state === 'downloading'
    ? 'กำลังเตรียมภาพสำหรับบันทึก'
    : state === 'sharing'
      ? 'กำลังเปิดเมนูแชร์ภาพ'
      : state === 'downloaded'
      ? 'เริ่มดาวน์โหลดภาพสรุปแล้ว'
      : state === 'share-opened'
        ? 'ตรวจสอบผู้รับใน LINE และกดส่งด้วยตัวเอง'
      : state === 'error'
        ? 'ดำเนินการไม่สำเร็จ ลองบันทึกภาพแล้วแนบใน LINE'
        : '';

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        onClick={handleDownload}
        disabled={state === 'downloading' || state === 'sharing'}
        aria-busy={state === 'downloading'}
        aria-describedby="ci-result-image-privacy ci-result-image-status"
        className="glass-button inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3 sm:w-auto"
      >
        <Download className="h-5 w-5" aria-hidden="true" />
        {state === 'downloading' ? 'กำลังสร้างภาพ…' : 'บันทึกภาพสรุป'}
      </button>
      {canShareFile ? <button
        type="button"
        onClick={handleShare}
        disabled={state === 'downloading' || state === 'sharing'}
        aria-busy={state === 'sharing'}
        aria-describedby="ci-result-image-privacy ci-result-image-status"
        className="glass-button inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3 sm:w-auto"
      >
        <Share2 className="h-5 w-5" aria-hidden="true" />
        {state === 'sharing' ? 'กำลังเปิด…' : 'แชร์ภาพผลลัพธ์'}
      </button> : null}
      </div>
      <p id="ci-result-image-privacy" className="text-xs leading-relaxed text-muted-foreground">
        ภาพมีตัวเลขจากการประเมินและสร้างบนอุปกรณ์นี้ เว็บไม่อัปโหลดข้อมูลที่คุณกรอก ก่อนส่งให้ตรวจสอบผู้รับใน LINE
      </p>
      <p id="ci-result-image-status" className="min-h-5 text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>
    </div>
  );
}
