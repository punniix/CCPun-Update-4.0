"use client";

import { useEffect, useMemo, useState } from "react";
import { loadSocialWorkspace, type SocialDraftApiItem, type SocialMediaReference } from "./social-workspace-client";

type EditableDraft = SocialDraftApiItem & { mediaReferences: SocialMediaReference[] };

type SaveResponse = {
  draft?: { variantId: string; revision: string; version: number; reviewStatus: string };
  error?: string;
};

function secondsValue(reference: SocialMediaReference) {
  return reference.thumbnailTimestampMs == null ? "" : String(reference.thumbnailTimestampMs / 1_000);
}

function normalizeTimestamp(value: string, durationMs: number | null) {
  if (!value.trim()) return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  const milliseconds = Math.round(seconds * 1_000);
  if (durationMs === null || milliseconds >= durationMs) return undefined;
  return milliseconds;
}

export default function SocialMediaMetadataPanel() {
  const [drafts, setDrafts] = useState<EditableDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [timestampInputs, setTimestampInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    void loadSocialWorkspace(controller.signal)
      .then((workspace) => {
        if (workspace.draftError) setLoadError(workspace.draftError);
        setDrafts(workspace.drafts.filter((draft) => draft.mediaReferences.length > 0));
        const next: Record<string, string> = {};
        for (const draft of workspace.drafts) {
          for (const reference of draft.mediaReferences) {
            next[`${draft.variantId}:${reference.assetId}`] = secondsValue(reference);
          }
        }
        setTimestampInputs(next);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "request-failed"))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const invalidTimestampKeys = useMemo(() => {
    const invalid = new Set<string>();
    for (const draft of drafts) {
      for (const reference of draft.mediaReferences) {
        if (reference.mimeType !== "video/mp4") continue;
        const key = `${draft.variantId}:${reference.assetId}`;
        const parsed = normalizeTimestamp(timestampInputs[key] ?? "", reference.durationMs);
        if ((timestampInputs[key] ?? "").trim() && parsed === undefined) invalid.add(key);
      }
    }
    return invalid;
  }, [drafts, timestampInputs]);

  function patchReference(variantId: string, assetId: string, patch: Partial<SocialMediaReference>) {
    setDrafts((current) => current.map((draft) => draft.variantId !== variantId ? draft : {
      ...draft,
      mediaReferences: draft.mediaReferences.map((reference) => reference.assetId === assetId ? { ...reference, ...patch } : reference),
    }));
  }

  async function saveDraft(draft: EditableDraft) {
    const invalid = draft.mediaReferences.some((reference) => invalidTimestampKeys.has(`${draft.variantId}:${reference.assetId}`));
    if (invalid) {
      setNotice("Thumbnail timestamp ต้องเป็นวินาทีที่อยู่ภายใน duration ของวิดีโอ");
      return;
    }

    const mediaReferences = draft.mediaReferences.map((reference) => {
      const key = `${draft.variantId}:${reference.assetId}`;
      const timestamp = reference.mimeType === "video/mp4"
        ? normalizeTimestamp(timestampInputs[key] ?? "", reference.durationMs)
        : null;
      return {
        ...reference,
        altText: reference.altText?.trim() || null,
        thumbnailTimestampMs: timestamp === undefined ? null : timestamp,
      };
    });

    setBusyId(draft.variantId);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/social/drafts/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          variantId: draft.variantId,
          expectedRevision: draft.revision,
          masterContentId: draft.masterContentId,
          title: draft.title,
          caption: draft.caption,
          linkUrl: draft.linkUrl,
          channel: draft.channel,
          format: draft.format,
          publishingMode: draft.publishingMode,
          mediaReferences,
          commentSeriesMode: draft.commentSeriesMode,
          commentSeries: draft.commentSeries,
        }),
      });
      const payload = await response.json().catch(() => null) as SaveResponse | null;
      if (!response.ok || !payload?.draft) throw new Error(payload?.error ?? "metadata-save-failed");
      setDrafts((current) => current.map((item) => item.variantId === draft.variantId ? {
        ...item,
        revision: payload.draft!.revision,
        version: payload.draft!.version,
        reviewStatus: payload.draft!.reviewStatus,
        mediaReferences,
      } : item));
      setNotice(`${draft.title}: บันทึก media metadata แล้ว และ reset review เป็น Drafting ตาม revision ใหม่`);
    } catch (error) {
      setNotice(error instanceof Error ? `${draft.title}: ${error.message}` : `${draft.title}: บันทึกไม่สำเร็จ`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="social-media-metadata-title" className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">MEDIA METADATA</p>
          <h2 id="social-media-metadata-title" className="mt-2 text-xl font-semibold">Alt text & video poster frame</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
            แก้ metadata บน Sanity Draft เดิมเท่านั้น การบันทึกสร้าง revision ใหม่และ reset review จึงไม่สามารถเปลี่ยนสื่อหลังอนุมัติแบบเงียบ ๆ ได้
          </p>
        </div>
        <span className="text-xs text-white/40">Thumbnail time ใช้หน่วยวินาที</span>
      </div>

      {notice ? <p role="status" aria-live="polite" className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">{notice}</p> : null}
      {loading ? <p className="mt-5 text-sm text-white/50">กำลังโหลด Draft media…</p> : null}
      {loadError ? <p role="alert" className="mt-5 rounded-xl border border-amber-200/20 bg-amber-200/[0.05] px-4 py-3 text-sm text-amber-50/80">Media metadata editor ใช้ไม่ได้: {loadError}</p> : null}

      <div className="mt-5 space-y-4">
        {drafts.map((draft) => (
          <article key={draft.variantId} className="rounded-2xl border border-white/[0.08] bg-black/10 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="truncate font-medium text-white/90">{draft.title}</h3>
                <p className="mt-1 text-xs text-white/40">{draft.channel} · {draft.format} · v{draft.version} · {draft.reviewStatus}</p>
              </div>
              <button
                type="button"
                disabled={busyId !== null || draft.mediaReferences.some((reference) => invalidTimestampKeys.has(`${draft.variantId}:${reference.assetId}`))}
                onClick={() => void saveDraft(draft)}
                className="min-h-11 shrink-0 rounded-xl border border-[#e0c985]/35 px-4 text-sm font-medium text-[#f4df9b] hover:bg-[#e0c985]/10 focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busyId === draft.variantId ? "กำลังบันทึก…" : "Save metadata"}
              </button>
            </div>

            <ol className="mt-4 space-y-3">
              {draft.mediaReferences.map((reference, index) => {
                const key = `${draft.variantId}:${reference.assetId}`;
                const invalidTimestamp = invalidTimestampKeys.has(key);
                return (
                  <li key={key} className="rounded-xl border border-white/[0.08] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/45">
                      <span>{reference.order ?? index + 1}. {reference.mimeType ?? "unknown MIME"}</span>
                      <span className="break-all">{reference.assetId}</span>
                    </div>
                    <label className="mt-3 block text-xs text-white/60">
                      Alt text
                      <textarea
                        value={reference.altText ?? ""}
                        maxLength={2_000}
                        onChange={(event) => patchReference(draft.variantId, reference.assetId, { altText: event.target.value })}
                        rows={2}
                        placeholder="อธิบายสิ่งสำคัญในภาพ/วิดีโอเพื่อ accessibility"
                        className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-navy-900 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#e0c985]"
                      />
                    </label>
                    {reference.mimeType === "video/mp4" ? (
                      <label className="mt-3 block text-xs text-white/60">
                        Poster / thumbnail timestamp (seconds)
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          max={reference.durationMs ? Math.max(0, (reference.durationMs - 1) / 1_000) : undefined}
                          value={timestampInputs[key] ?? ""}
                          onChange={(event) => setTimestampInputs((current) => ({ ...current, [key]: event.target.value }))}
                          aria-invalid={invalidTimestamp || undefined}
                          className="mt-1.5 min-h-11 w-full rounded-xl border border-white/10 bg-navy-900 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]"
                        />
                        <span className={`mt-1 block ${invalidTimestamp ? "text-amber-100" : "text-white/40"}`}>
                          {reference.durationMs ? `Duration ${(reference.durationMs / 1_000).toFixed(1)}s · ต้องเลือกค่าที่น้อยกว่า duration` : "ยังไม่มี duration ที่ verify แล้ว จึงไม่ควรกำหนด poster timestamp"}
                        </span>
                      </label>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </article>
        ))}
        {!loading && !loadError && drafts.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/50">ยังไม่มี Social Draft ที่มี media reference</p> : null}
      </div>
    </section>
  );
}