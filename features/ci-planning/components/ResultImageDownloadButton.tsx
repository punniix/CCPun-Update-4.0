"use client";

import type { SITE_COPY_DEFAULTS } from "@/lib/content/site-copy-defaults";
import { usePublicCopy } from '@/components/ui/PublicCopyProvider';
import { CI_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';


import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Eye, Share2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { CI_ASSESSMENT_VERSION } from '@/features/ci-planning/calculator/constants';
import type { CIEstimationMethod, CIResult } from '@/features/ci-planning/calculator/types';
import styles from './ResultImageDownloadButton.module.css';

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
  const [prepared, setPrepared] = useState<{ result: CIResult; method: CIEstimationMethod; file: File | null } | null>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const previewUrl = useRef<string | null>(null);
  const releasePreviewUrl = useCallback(() => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
  }, []);
  const imageFile = prepared?.result === result && prepared.method === selectedMethod ? prepared.file : null;
  const preparationFailed = prepared?.result === result && prepared.method === selectedMethod && !prepared.file;
  const canShareFile = imageFile && typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [imageFile] });

  useEffect(() => {
    let current = true;
    void createResultFile(result, selectedMethod, t, imageText)
      .then((file) => { if (current) setPrepared({ result, method: selectedMethod, file }); })
      .catch(() => { if (current) setPrepared({ result, method: selectedMethod, file: null }); });
    return () => { current = false; };
  }, [result, selectedMethod, t, imageText]);

  useEffect(() => releasePreviewUrl, [releasePreviewUrl]);
  useEffect(() => {
    if (preview && preview.file !== imageFile) previewDialog.current?.close();
  }, [imageFile, preview]);

  function handlePreview(): void {
    const dialog = previewDialog.current;
    if (!imageFile || !dialog || dialog.open) return;
    const url = URL.createObjectURL(imageFile);
    previewUrl.current = url;
    try {
      dialog.showModal();
      setPreview({ file: imageFile, url });
      setState('idle');
    } catch {
      releasePreviewUrl();
      setState('error');
    }
  }

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

  const statusMessage = !imageFile && state === 'idle'
    ? t(preparationFailed ? "ci.download.statusMessage5" : "ci.download.statusMessage")
    : state === 'downloading'
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
      <div className={canShareFile ? 'grid gap-3 sm:grid-cols-3' : 'grid gap-3 sm:grid-cols-2'}>
        <button
          type="button"
          onClick={handlePreview}
          disabled={!imageFile || state === 'downloading' || state === 'sharing'}
          aria-busy={!imageFile && !preparationFailed}
          aria-haspopup="dialog"
          aria-describedby="ci-result-image-privacy ci-result-image-status"
          className="glass-button inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3"
        >
          <Eye className="h-5 w-5" aria-hidden="true" />
          {t.node("ci.download.preview")}
        </button>
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
      <dialog ref={previewDialog} className={styles.dialog} aria-labelledby="ci-result-image-preview-title" aria-describedby="ci-result-image-privacy" onClose={() => { releasePreviewUrl(); setPreview(null); }}>
        <div className={styles.header}>
          <h2 id="ci-result-image-preview-title">{t.node("ci.download.preview")}</h2>
          <button type="button" className="glass-button min-h-11 px-4 py-2" onClick={() => previewDialog.current?.close()}>{t.node("ci.download.closePreview")}</button>
        </div>
        {preview && preview.file === imageFile ? (
          // The prepared local PNG is the download/share file, not a network image to optimize.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.image} src={preview.url} alt={t("ci.download.preview")} />
        ) : null}
      </dialog>
      <p id="ci-result-image-privacy" className="text-xs leading-relaxed text-muted-foreground">
        {t.node("ci.download.resultImagePrivacy.description")}</p>
      <p id="ci-result-image-status" className="text-xs text-muted-foreground empty:sr-only" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>
    </div>
  );
}
