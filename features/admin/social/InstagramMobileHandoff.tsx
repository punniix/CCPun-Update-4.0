"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { requestGoogleDriveMemorySession } from "@/features/admin/social/social-workspace-client";
import { isGoogleDriveAuthorizationUsable, type SocialMediaReference } from "@/features/admin/social/social-workspace-media";
import {
  copyHandoffText,
  prepareInstagramHandoffAssets,
  searchInstagramAudioOptions,
  submitInstagramHandoffMedia,
  type InstagramAudioOption,
  type InstagramHandoffAsset,
  type InstagramHandoffDriveSession,
} from "@/features/admin/social/instagram-mobile-handoff";

type AudioMode = "original" | "instagram-audio" | "add-in-app";
type StoredAudio = {
  mode: AudioMode;
  audioId?: string;
  audioType?: "music" | "original_sound";
  title?: string;
  artist?: string | null;
  creator?: string | null;
  audioVolume: number;
  videoVolume: number;
};
type AudioConfigPayload = {
  audio?: {
    revision: string;
    version: number;
    reviewStatus?: string;
    configuration: StoredAudio;
  };
  error?: string;
};

function durationLabel(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function InstagramMobileHandoff(props: {
  variantId: string;
  revision: string | null;
  version: number;
  approvalRecorded: boolean;
  caption: string;
  format: string;
  mediaReferences: readonly SocialMediaReference[];
  driveOAuthClientId: string;
}) {
  const session = useRef<InstagramHandoffDriveSession | null>(null);
  const [assets, setAssets] = useState<InstagramHandoffAsset[]>([]);
  const [mediaState, setMediaState] = useState<"idle" | "running" | "ready" | "error">("idle");
  const [notice, setNotice] = useState("");

  const [audioMode, setAudioMode] = useState<AudioMode>("original");
  const [audioType, setAudioType] = useState<"music" | "original_sound">("music");
  const [audioQuery, setAudioQuery] = useState("");
  const [audioState, setAudioState] = useState<"idle" | "running" | "ready" | "error">("idle");
  const [audioOptions, setAudioOptions] = useState<InstagramAudioOption[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<InstagramAudioOption | null>(null);
  const [audioVolume, setAudioVolume] = useState(100);
  const [videoVolume, setVideoVolume] = useState(100);
  const [configState, setConfigState] = useState<"idle" | "loading" | "ready" | "saving" | "error">(
    props.format === "reel" ? "loading" : "idle",
  );
  const [draftRevision, setDraftRevision] = useState<string | null>(props.revision);
  const [draftVersion, setDraftVersion] = useState(props.version);
  const [approvalInvalidated, setApprovalInvalidated] = useState(false);

  const orderedReferences = useMemo(
    () => [...props.mediaReferences].sort((left, right) => (left.order ?? 1) - (right.order ?? 1)),
    [props.mediaReferences],
  );
  const approvalUsable = props.approvalRecorded && !approvalInvalidated;

  useEffect(() => {
    if (props.format !== "reel") return;
    const controller = new AbortController();
    const url = new URL("/api/admin/social/drafts/instagram-audio/", window.location.origin);
    url.searchParams.set("variantId", props.variantId);
    void fetch(url, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as AudioConfigPayload | null;
        if (!response.ok || !payload?.audio) throw new Error(payload?.error ?? "audio-config-unavailable");
        const stored = payload.audio.configuration;
        setDraftRevision(payload.audio.revision);
        setDraftVersion(payload.audio.version);
        if (props.revision && payload.audio.revision !== props.revision && props.approvalRecorded) setApprovalInvalidated(true);
        setAudioMode(stored.mode);
        setAudioVolume(stored.audioVolume);
        setVideoVolume(stored.videoVolume);
        if (stored.mode === "instagram-audio" && stored.audioId && stored.audioType && stored.title) {
          setAudioType(stored.audioType);
          setSelectedAudio({
            audioId: stored.audioId,
            audioType: stored.audioType,
            title: stored.title,
            artist: stored.artist ?? null,
            creator: stored.creator ?? null,
            durationMs: 0,
            artworkUrl: null,
            previewUrl: null,
            adsEligible: null,
          });
        }
        setConfigState("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setConfigState("error");
        setNotice(error instanceof Error ? `โหลด Audio configuration ไม่สำเร็จ: ${error.message}` : "โหลด Audio configuration ไม่สำเร็จ");
      });
    return () => controller.abort();
  }, [props.format, props.variantId, props.revision, props.approvalRecorded]);

  async function driveSession() {
    if (session.current && isGoogleDriveAuthorizationUsable(session.current.authorization)) return session.current;
    session.current = await requestGoogleDriveMemorySession(props.driveOAuthClientId);
    return session.current;
  }

  async function prepareMedia() {
    setMediaState("running");
    setNotice("");
    try {
      const next = await prepareInstagramHandoffAssets({ references: orderedReferences, session: await driveSession() });
      setAssets(next);
      setMediaState("ready");
      setNotice(`ตรวจ metadata ของไฟล์ ${next.length} ไฟล์แล้ว ระบบจะตรวจ revision ที่อนุมัติซ้ำก่อนส่งไฟล์`);
    } catch {
      session.current = null;
      setAssets([]);
      setMediaState("error");
      setNotice("เปิดไฟล์ไม่ได้ กรุณาอนุญาต Google Drive ใหม่และตรวจว่าไฟล์ยังอยู่ในโฟลเดอร์ที่ระบบอนุมัติ");
    }
  }

  async function transfer(reference: SocialMediaReference, mode: "inline" | "attachment") {
    setNotice("");
    try {
      if (!approvalUsable || !props.revision) throw new Error("instagram-handoff-approval-required");
      const currentSession = await driveSession();
      const asset = assets.find((item) => item.assetId === reference.assetId)
        ?? (await prepareInstagramHandoffAssets({ references: [reference], session: currentSession }))[0];
      if (!asset) throw new Error("instagram-media-required");
      submitInstagramHandoffMedia({
        asset,
        session: currentSession,
        mode,
        approvedVariant: { variantId: props.variantId, revision: props.revision, version: props.version },
      });
      setNotice(mode === "inline" ? "เปิดไฟล์ที่ตรวจแล้วในแท็บใหม่" : "เริ่มดาวน์โหลดไฟล์ที่ตรวจแล้ว");
    } catch {
      session.current = null;
      setNotice(approvalInvalidated
        ? "การตั้งค่าเสียงทำให้ฉบับเปลี่ยนแล้ว ต้องตรวจและอนุมัติฉบับใหม่ก่อนส่งต่อไปทำบนมือถือ"
        : "ไฟล์หรือสิทธิ์หมดอายุ กรุณากดเตรียมไฟล์บนมือถืออีกครั้ง");
    }
  }

  async function copy(value: string, success: string) {
    try {
      await copyHandoffText(value);
      setNotice(success);
    } catch {
      setNotice("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความและคัดลอกด้วยตนเอง");
    }
  }

  async function searchAudio() {
    setAudioState("running");
    setAudioOptions([]);
    try {
      const options = await searchInstagramAudioOptions({ audioType, searchQuery: audioQuery });
      setAudioOptions(options);
      setAudioState("ready");
    } catch (error) {
      setAudioState("error");
      setNotice(error instanceof Error ? `ค้นหาเสียงไม่สำเร็จ: ${error.message}` : "ค้นหาเสียงไม่สำเร็จ");
    }
  }

  async function saveAudioConfiguration() {
    if (!draftRevision) {
      setNotice("ยังไม่มี Draft revision ที่ใช้บันทึก Audio configuration");
      return;
    }
    if (audioMode === "instagram-audio" && !selectedAudio) {
      setNotice("เลือก Audio จากผลค้นหาก่อนบันทึก");
      return;
    }
    const configuration: StoredAudio = audioMode === "instagram-audio" && selectedAudio ? {
      mode: "instagram-audio",
      audioId: selectedAudio.audioId,
      audioType: selectedAudio.audioType,
      title: selectedAudio.title,
      artist: selectedAudio.artist,
      creator: selectedAudio.creator,
      audioVolume,
      videoVolume,
    } : { mode: audioMode, audioVolume, videoVolume };

    setConfigState("saving");
    setNotice("");
    try {
      const response = await fetch("/api/admin/social/drafts/instagram-audio/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId: props.variantId, expectedRevision: draftRevision, configuration }),
      });
      const payload = await response.json().catch(() => null) as AudioConfigPayload | null;
      if (!response.ok || !payload?.audio) throw new Error(payload?.error ?? "audio-config-save-failed");
      setDraftRevision(payload.audio.revision);
      setDraftVersion(payload.audio.version);
      setAudioMode(payload.audio.configuration.mode);
      setAudioVolume(payload.audio.configuration.audioVolume);
      setVideoVolume(payload.audio.configuration.videoVolume);
      setApprovalInvalidated(true);
      setConfigState("ready");
      setNotice("บันทึกการตั้งค่าเสียงแล้ว และ Meta ยืนยันเพลงอีกครั้งสำเร็จ งานกลับเป็นฉบับร่างและต้องตรวจอนุมัติใหม่ก่อนเผยแพร่");
    } catch (error) {
      setConfigState("error");
      setNotice(error instanceof Error ? `บันทึกเสียงไม่สำเร็จ: ${error.message}` : "บันทึกเสียงไม่สำเร็จ");
    }
  }

  return (
    <section id="instagram-handoff-guide" className="mt-5 border-t border-white/10 pt-5" aria-labelledby="instagram-handoff-title">
      <h3 id="instagram-handoff-title" className="font-semibold">ส่งตรงไป Instagram หรือทำต่อบนมือถือ</h3>
      <p className="mt-2 text-sm leading-6 text-white/70">
        หากต้องเลือกเพลงหรือใช้ความสามารถในแอป Instagram ระบบจะส่งต่องานไปทำบนมือถือ ส่วนการส่งตรงจะเปิดเฉพาะเมื่อแพลตฟอร์มและไฟล์รองรับครบ หากยืนยันไม่ได้ระบบจะหยุดไว้
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => copy(props.caption, "คัดลอกแคปชันแล้ว")} disabled={!props.caption.trim()}
          className="min-h-11 rounded-xl border border-white/15 px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:opacity-40">
          คัดลอกแคปชัน
        </button>
        <button type="button" onClick={prepareMedia} disabled={!approvalUsable || !props.revision || !props.driveOAuthClientId || !orderedReferences.length || mediaState === "running"}
          className="min-h-11 rounded-xl border border-[#e0c985]/50 px-3 py-2.5 text-sm font-semibold text-[#f4df9b] hover:bg-[#e0c985]/10 focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:opacity-40">
          {mediaState === "running" ? "กำลังตรวจไฟล์…" : "เตรียมไฟล์บนมือถือ"}
        </button>
      </div>
      {!props.driveOAuthClientId ? <p className="mt-2 text-xs leading-5 text-amber-100/80">ยังตั้งค่าการเชื่อมต่อ Google Drive ไม่ครบ จึงเปิดไฟล์บนอุปกรณ์นี้ไม่ได้</p> : null}
      {!approvalUsable || !props.revision ? <p className="mt-2 text-xs leading-5 text-amber-100/80">ต้องมีฉบับปัจจุบันที่ผู้มีสิทธิ์อนุมัติแล้ว จึงจะเปิดหรือดาวน์โหลดไฟล์เพื่อทำต่อบนมือถือได้</p> : null}
      {!orderedReferences.length ? <p className="mt-2 text-xs leading-5 text-amber-100/80">ยังไม่มีสื่อที่อนุมัติสำหรับ Instagram ชิ้นนี้</p> : null}

      {orderedReferences.length ? <ol className="mt-3 space-y-2">{orderedReferences.map((reference, index) => {
        const asset = assets.find((item) => item.assetId === reference.assetId);
        return <li key={`${reference.assetId}:${reference.order ?? index + 1}`} className="rounded-xl border border-white/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/65">
            <span>ไฟล์ {index + 1} · {asset?.name ?? reference.mimeType ?? "กำลังรอตรวจ"}</span>
            {reference.thumbnailTimestampMs != null ? <span>ภาพปกที่วินาที {(reference.thumbnailTimestampMs / 1_000).toFixed(1)}</span> : null}
          </div>
          {reference.altText ? <p className="mt-2 text-xs leading-5 text-white/45">คำอธิบายภาพ: {reference.altText}</p> : null}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => transfer(reference, "inline")} disabled={!approvalUsable || !props.revision} className="min-h-11 rounded-xl border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:opacity-40">เปิดสื่อ</button>
            <button type="button" onClick={() => transfer(reference, "attachment")} disabled={!approvalUsable || !props.revision} className="min-h-11 rounded-xl border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:opacity-40">ดาวน์โหลด</button>
          </div>
        </li>;
      })}</ol> : null}

      {props.format === "reel" ? <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white/90">เสียงสำหรับ Reel</h4>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-white/60">
              เลือกเสียงต้นฉบับ ค้นหาเฉพาะเสียงที่ Meta ส่งให้บัญชีที่เชื่อมต่อ หรือเลือกไปเพิ่มเพลงภายหลังใน Instagram ระบบไม่ได้อ้างว่าเข้าถึงคลังเพลงทั้งหมด
            </p>
          </div>
          <details className="text-[11px] text-white/40"><summary className="cursor-pointer">ดูรายละเอียดสำหรับทีมเทคนิค</summary><span>ฉบับร่าง v{draftVersion} · {configState}</span></details>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="วิธีเลือกเสียงสำหรับ Instagram">
          {([
            ["original", "ใช้เสียงต้นฉบับ", "คงเสียงต้นฉบับของวิดีโอ"],
            ["instagram-audio", "ค้นหาเสียงใน Instagram", "ใช้เฉพาะเสียงที่ Meta รองรับ"],
            ["add-in-app", "เพิ่มเพลงภายหลัง", "ไปเลือกเพลงในแอป Instagram"],
          ] as const).map(([mode, label, detail]) => (
            <button key={mode} type="button" role="radio" aria-checked={audioMode === mode} onClick={() => setAudioMode(mode)}
              className={`min-h-20 rounded-xl border p-3 text-left focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${audioMode === mode ? "border-[#e0c985]/55 bg-[#e0c985]/[0.08]" : "border-white/10 hover:bg-white/[0.03]"}`}>
              <span className="block text-sm font-medium text-white/85">{label}</span>
              <span className="mt-1 block text-xs leading-5 text-white/45">{detail}</span>
            </button>
          ))}
        </div>

        {audioMode === "instagram-audio" ? <div className="mt-4">
          <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
            <select value={audioType} onChange={(event) => setAudioType(event.target.value as typeof audioType)}
              aria-label="ประเภทเสียง"
              className="min-h-11 rounded-xl border border-white/15 bg-[#151a20] px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
              <option value="music">เพลง</option><option value="original_sound">เสียงต้นฉบับ</option>
            </select>
            <input value={audioQuery} onChange={(event) => setAudioQuery(event.target.value)} maxLength={100} placeholder="ชื่อเพลง ศิลปิน หรือผู้สร้าง"
              className="min-h-11 rounded-xl border border-white/15 bg-[#151a20] px-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#e0c985]" />
            <button type="button" onClick={searchAudio} disabled={audioState === "running"}
              className="min-h-11 rounded-xl border border-white/15 px-4 text-sm text-white/80 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:opacity-40">
              {audioState === "running" ? "กำลังค้นหา…" : "ค้นหา"}
            </button>
          </div>
          {audioState === "error" ? <p className="mt-2 text-xs text-rose-200">ค้นหาเสียงไม่ได้ในขณะนี้ คุณยังเลือกไปเพิ่มเพลงภายหลังบนมือถือได้</p> : null}
          {audioState === "ready" && !audioOptions.length ? <p className="mt-2 text-xs text-white/55">ไม่พบเสียงที่ตรงกับคำค้นนี้</p> : null}

          {audioOptions.length ? <div className="mt-3 grid gap-3 lg:grid-cols-2">{audioOptions.map((option) => {
            const selected = selectedAudio?.audioId === option.audioId;
            return <article key={option.audioId} className={`rounded-2xl border p-3 ${selected ? "border-[#e0c985]/55 bg-[#e0c985]/[0.06]" : "border-white/10 bg-white/[0.02]"}`}>
              <div className="flex gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                  {option.artworkUrl ? <img src={option.artworkUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-lg text-white/30" aria-hidden="true">♪</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white/90">{option.title}</div>
                  <div className="mt-1 truncate text-xs text-white/50">{option.artist ?? option.creator ?? "ไม่พบชื่อผู้สร้าง"}</div>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-white/35">
                    <span>{option.audioType === "music" ? "เพลง" : "เสียงต้นฉบับ"}</span>
                    <span>{durationLabel(option.durationMs)}</span>
                    <span>Meta แจ้งว่าใช้ได้ในขณะนี้</span>
                  </div>
                </div>
              </div>
              {option.previewUrl ? <audio className="mt-3 h-10 w-full" controls preload="none" src={option.previewUrl}>เบราว์เซอร์นี้ไม่รองรับการฟังตัวอย่างเสียง</audio> : <p className="mt-3 text-[11px] text-white/35">Meta ไม่มีลิงก์ให้ฟังตัวอย่างหรือดาวน์โหลดรายการนี้</p>}
              <button type="button" onClick={() => setSelectedAudio(option)} aria-pressed={selected}
                className={`mt-3 min-h-11 w-full rounded-xl border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#e0c985] ${selected ? "border-[#e0c985]/50 text-[#f4df9b]" : "border-white/15 text-white/75 hover:bg-white/5"}`}>
                {selected ? "เลือกแล้ว" : "เลือกเสียงนี้"}
              </button>
            </article>;
          })}</div> : null}

          {selectedAudio ? <div className="mt-3 rounded-xl border border-[#e0c985]/20 bg-[#e0c985]/[0.04] p-3 text-xs text-white/65">
            เลือกแล้ว: <strong className="font-medium text-white/85">{selectedAudio.title}</strong>{selectedAudio.artist ? ` — ${selectedAudio.artist}` : selectedAudio.creator ? ` — @${selectedAudio.creator}` : ""} ระบบจะตรวจว่าเพลงยังใช้ได้ก่อนบันทึกและก่อนส่งตรงทุกครั้ง
          </div> : null}
        </div> : null}

        <fieldset className="mt-4 grid gap-3 sm:grid-cols-2" disabled={configState === "saving"}>
          <legend className="sr-only">ตั้งค่าความดังเสียง</legend>
          <label className="rounded-xl border border-white/10 p-3 text-xs text-white/60">ความดังของเสียงที่เลือก · {audioVolume}%
            <input type="range" min="0" max="100" step="1" value={audioVolume} onChange={(event) => setAudioVolume(Number(event.target.value))} className="mt-2 w-full" />
          </label>
          <label className="rounded-xl border border-white/10 p-3 text-xs text-white/60">ความดังของเสียงในวิดีโอ · {videoVolume}%
            <input type="range" min="0" max="100" step="1" value={videoVolume} onChange={(event) => setVideoVolume(Number(event.target.value))} className="mt-2 w-full" />
          </label>
        </fieldset>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-white/45">
            {audioMode === "add-in-app" ? "ไปทำต่อบนมือถือ: เลือกเพลงจริงในแอป Instagram" : "การส่งตรงจะเปิดเมื่อไฟล์และสิทธิ์จากแพลตฟอร์มผ่านการตรวจครบแล้ว"}
          </p>
          <button type="button" onClick={saveAudioConfiguration} disabled={configState === "saving" || !draftRevision || (audioMode === "instagram-audio" && !selectedAudio)}
            className="min-h-11 shrink-0 rounded-xl border border-[#e0c985]/50 px-4 text-sm font-semibold text-[#f4df9b] hover:bg-[#e0c985]/10 focus:outline-none focus:ring-2 focus:ring-[#e0c985] disabled:opacity-40">
            {configState === "saving" ? "กำลังตรวจอีกครั้ง…" : "บันทึกการตั้งค่าเสียง"}
          </button>
        </div>
      </div> : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">เปิด Instagram</a>
        <a href="https://business.facebook.com/latest/home" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">เปิด Meta Business Suite</a>
      </div>
      {notice ? <p role="status" aria-live="polite" className="mt-3 text-xs leading-5 text-[#9ef0ce]">{notice}</p> : null}
    </section>
  );
}
