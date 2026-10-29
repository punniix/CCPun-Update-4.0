import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const sha = source => createHash('sha256').update(source).digest('hex');
// CI19: only the complete reviewed local-preview component and two additive CMS labels.
// Every older source identity/golden remains frozen; unknown bytes never normalize.
export const ciPreviewSourcePins = Object.freeze({
  "features/ci-planning/components/ResultImageDownloadButton.tsx": {
    "before": "2cae8b9c5b7a6d9bd0828781957c0011319b2fdace56bad8554863f785af5ab7",
    "after": "fff8573d8862d7de8a2e7a4e8d6a9e9280eb6f5a5b772b997238fba8efdcc2ad",
    "edits": [
      [
        "\nimport { useCallback, useEffect, useRef, useState } from 'react';\nimport { Download, Eye, Share2 } from 'lucide-react';\nimport { trackEvent } from '@/lib/analytics';\n",
        "\nimport { useEffect, useState } from 'react';\nimport { Download, Share2 } from 'lucide-react';\nimport { trackEvent } from '@/lib/analytics';\n"
      ],
      [
        "import type { CIEstimationMethod, CIResult } from '@/features/ci-planning/calculator/types';\nimport styles from './ResultImageDownloadButton.module.css';\n\n",
        "import type { CIEstimationMethod, CIResult } from '@/features/ci-planning/calculator/types';\n\n"
      ],
      [
        "  const [state, setState] = useState<ActionState>('idle');\n  const [prepared, setPrepared] = useState<{ result: CIResult; method: CIEstimationMethod; file: File | null } | null>(null);\n  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);\n  const previewDialog = useRef<HTMLDialogElement>(null);\n  const previewUrl = useRef<string | null>(null);\n  const releasePreviewUrl = useCallback(() => {\n    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);\n    previewUrl.current = null;\n  }, []);\n  const imageFile = prepared?.result === result && prepared.method === selectedMethod ? prepared.file : null;\n  const preparationFailed = prepared?.result === result && prepared.method === selectedMethod && !prepared.file;\n  const canShareFile = imageFile && typeof navigator !== 'undefined'\n",
        "  const [state, setState] = useState<ActionState>('idle');\n  const [prepared, setPrepared] = useState<{ result: CIResult; method: CIEstimationMethod; file: File } | null>(null);\n  const imageFile = prepared?.result === result && prepared.method === selectedMethod ? prepared.file : null;\n  const canShareFile = imageFile && typeof navigator !== 'undefined'\n"
      ],
      [
        "      .then((file) => { if (current) setPrepared({ result, method: selectedMethod, file }); })\n      .catch(() => { if (current) setPrepared({ result, method: selectedMethod, file: null }); });\n    return () => { current = false; };\n  }, [result, selectedMethod, t, imageText]);\n\n  useEffect(() => releasePreviewUrl, [releasePreviewUrl]);\n  useEffect(() => {\n    if (preview && preview.file !== imageFile) previewDialog.current?.close();\n  }, [imageFile, preview]);\n\n  function handlePreview(): void {\n    const dialog = previewDialog.current;\n    if (!imageFile || !dialog || dialog.open) return;\n    const url = URL.createObjectURL(imageFile);\n    previewUrl.current = url;\n    try {\n      dialog.showModal();\n      setPreview({ file: imageFile, url });\n      setState('idle');\n    } catch {\n      releasePreviewUrl();\n      setState('error');\n    }\n  }\n\n",
        "      .then((file) => { if (current) setPrepared({ result, method: selectedMethod, file }); })\n      .catch(() => { if (current) setPrepared(null); });\n    return () => { current = false; };\n  }, [result, selectedMethod, t, imageText]);\n\n"
      ],
      [
        "\n  const statusMessage = !imageFile && state === 'idle'\n    ? t(preparationFailed ? \"ci.download.statusMessage5\" : \"ci.download.statusMessage\")\n    : state === 'downloading'\n    ? t(\"ci.download.statusMessage\")\n",
        "\n  const statusMessage = state === 'downloading'\n    ? t(\"ci.download.statusMessage\")\n"
      ],
      [
        "    <div className=\"ccpun-ci-result-image-actions\">\n      <div className={canShareFile ? 'grid gap-3 sm:grid-cols-3' : 'grid gap-3 sm:grid-cols-2'}>\n        <button\n          type=\"button\"\n          onClick={handlePreview}\n          disabled={!imageFile || state === 'downloading' || state === 'sharing'}\n          aria-busy={!imageFile && !preparationFailed}\n          aria-haspopup=\"dialog\"\n          aria-describedby=\"ci-result-image-privacy ci-result-image-status\"\n          className=\"glass-button inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3\"\n        >\n          <Eye className=\"h-5 w-5\" aria-hidden=\"true\" />\n          {t.node(\"ci.download.preview\")}\n        </button>\n        <button\n",
        "    <div className=\"ccpun-ci-result-image-actions\">\n      <div className={canShareFile ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3'}>\n        <button\n"
      ],
      [
        "      </div>\n      <dialog ref={previewDialog} className={styles.dialog} aria-labelledby=\"ci-result-image-preview-title\" aria-describedby=\"ci-result-image-privacy\" onClose={() => { releasePreviewUrl(); setPreview(null); }}>\n        <div className={styles.header}>\n          <h2 id=\"ci-result-image-preview-title\">{t.node(\"ci.download.preview\")}</h2>\n          <button type=\"button\" className=\"glass-button min-h-11 px-4 py-2\" onClick={() => previewDialog.current?.close()}>{t.node(\"ci.download.closePreview\")}</button>\n        </div>\n        {preview && preview.file === imageFile ? (\n          // The prepared local PNG is the download/share file, not a network image to optimize.\n          // eslint-disable-next-line @next/next/no-img-element\n          <img className={styles.image} src={preview.url} alt={t(\"ci.download.preview\")} />\n        ) : null}\n      </dialog>\n      <p id=\"ci-result-image-privacy\" className=\"text-xs leading-relaxed text-muted-foreground\">\n",
        "      </div>\n      <p id=\"ci-result-image-privacy\" className=\"text-xs leading-relaxed text-muted-foreground\">\n"
      ]
    ]
  },
  "lib/content/tool-copy-defaults.ts": {
    "before": "722753e452481b63ffe8c0102cf1457c177fccd97e24aa59dcfae1fbe6d5993f",
    "after": "f05b7fb37501a630a9dbb3b1aecbd9c617a05b25e1d37efa714249b6f0e76b34",
    "edits": [
      [
        "  \"ci.download.label4\": \"แชร์ภาพผลลัพธ์\",\n  \"ci.download.preview\": \"ตัวอย่างภาพสรุป\",\n  \"ci.download.closePreview\": \"ปิดตัวอย่างภาพ\",\n  \"ci.download.resultImagePrivacy.description\": \"ภาพมีตัวเลขจากการประเมินและสร้างบนอุปกรณ์นี้ เว็บไม่อัปโหลดข้อมูลที่คุณกรอก ก่อนส่งให้ตรวจสอบผู้รับใน LINE\",\n",
        "  \"ci.download.label4\": \"แชร์ภาพผลลัพธ์\",\n  \"ci.download.resultImagePrivacy.description\": \"ภาพมีตัวเลขจากการประเมินและสร้างบนอุปกรณ์นี้ เว็บไม่อัปโหลดข้อมูลที่คุณกรอก ก่อนส่งให้ตรวจสอบผู้รับใน LINE\",\n"
      ]
    ]
  }
});
export function ciPreviewSourcePredecessor(file, source) {
  const pin = Object.hasOwn(ciPreviewSourcePins, file) ? ciPreviewSourcePins[file] : null;
  if (!pin || typeof source !== 'string' || sha(source) !== pin.after) return source;
  for (const [current, prior] of pin.edits) {
    assert.equal(source.split(current).length, 2, 'One complete reviewed CI preview source edit');
    source = source.replace(current, prior);
  }
  assert.equal(sha(source), pin.before, 'Every original CI source byte reconstructed');
  return source;
}

export function ciPreviewLocationsPredecessor(source) {
  if (typeof source !== 'string' || sha(source) !== '2ede32e9f081011ea9418518272cd39c19fc731ce1f351aac46b0ec7e894e765') return source;
  const locations = JSON.parse(source), ci = locations.ci;
  assert.equal(Object.keys(ci.entries).length, 307);
  for (const key of ['ci.download.preview','ci.download.closePreview']) {
    assert.ok(Object.hasOwn(ci.entries, key));
    delete ci.entries[key];
  }
  ci.sections = ci.sections.filter(section => section !== 'ตัวอย่างภาพสรุป');
  ci.entries = Object.fromEntries(Object.entries(ci.entries).map(([key, value], order) => [key, { ...value, order }]));
  const prior = JSON.stringify(locations) + '\n';
  assert.equal(sha(prior), 'f1f110371ce02eb8dfb9e20360b71795d2c55e105c1603c5d95d1f637f6a6e79', 'Every original generated location-map byte reconstructed');
  return prior;
}
