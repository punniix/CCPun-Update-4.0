"use client";

import type { SITE_COPY_DEFAULTS } from "@/lib/content/site-copy-defaults";
import { usePublicCopy } from '@/components/ui/PublicCopyProvider';
import { CI_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';


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

async function createResultFile(result: CIResult, selectedMethod: CIEstimationMethod, t: (key: keyof typeof CI_COPY_DEFAULTS) => string, imageText: (key: keyof typeof SITE_COPY_DEFAULTS) => string): Promise<File> {
  const { createCIResultImageSummary, renderCIResultImage } = await import('@/features/ci-planning/result-image');
  const summary = createCIResultImageSummary(result, selectedMethod, CI_ASSESSMENT_VERSION, undefined, t);
  const blob = await renderCIResultImage(summary, undefined, undefined, t, imageText);
  return new File([blob], `ccpun-critical-illness-summary-${new Date().toISOString().slice(0, 10)}.png`, { type: 'image/png' });
}

export default function ResultImageDownloadButton({
  result,
  selectedMethod,
}: ResultImageDownloadButtonProps) {
  const t = usePublicCopy(CI_COPY_DEFAULTS);
  const imageText = usePublicCopy();

  const [state, setState] = useState<ActionState>('idle');
  const [prepared, setPrepared] = useState<{ result: CIResult; method: CIEstimationMethod; file: File } | null>(null);
  const imageFile = prepared?.result === result && prepared.method === selectedMethod ? prepared.file : null;
  const canShareFile = imageFile && typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [imageFile] });

  useEffect(() => {
    let current = true;
    void createResultFile(result, selectedMethod, t, imageText)
      .then((file) => { if (current) setPrepared({ result, method: selectedMethod, file }); })
      .catch(() => { if (current) setPrepared(null); });
    return () => { current = false; };
  }, [result, selectedMethod, t, imageText]);

  async function handleDownload(): Promise<void> {
    if (state === 'downloading' || state === 'sharing') return;
    setState('downloading');

    try {
      const file = imageFile ?? await createResultFile(result, selectedMethod, t, imageText);
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
    ? t("ci.download.statusMessage")
    : state === 'sharing'
      ? t("ci.download.statusMessage2")
      : state === 'downloaded'
      ? t("ci.download.statusMessage3")
      : state === 'share-opened'
        ? t("ci.download.statusMessage4")
      : state === 'error'
        ? t("ci.download.statusMessage5")
        : '';

  return (
    <div className="ccpun-ci-result-image-actions">
      <div className={canShareFile ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3'}>
        <button
          type="button"
          onClick={handleDownload}
          disabled={state === 'downloading' || state === 'sharing'}
          aria-busy={state === 'downloading'}
          aria-describedby="ci-result-image-privacy ci-result-image-status"
          className="glass-button inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3"
        >
          <Download className="h-5 w-5" aria-hidden="true" />
          {state === 'downloading' ? t("ci.download.label") : t("ci.download.label2")}
        </button>
        {canShareFile ? <button
          type="button"
          onClick={handleShare}
          disabled={state === 'downloading' || state === 'sharing'}
          aria-busy={state === 'sharing'}
          aria-describedby="ci-result-image-privacy ci-result-image-status"
          className="glass-button inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3"
        >
          <Share2 className="h-5 w-5" aria-hidden="true" />
          {state === 'sharing' ? t("ci.download.label3") : t("ci.download.label4")}
        </button> : null}
      </div>
      <p id="ci-result-image-privacy" className="text-xs leading-relaxed text-muted-foreground">
        {t("ci.download.resultImagePrivacy.description")}</p>
      <p id="ci-result-image-status" className="text-xs text-muted-foreground empty:sr-only" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>
    </div>
  );
}
