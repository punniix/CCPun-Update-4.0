"use client";

import { useState } from "react";

const errorLabel: Record<string, string> = {
  "provider-not-connected": "ยังเชื่อมต่อแพลตฟอร์มไม่ครบ",
  "provider-auth-required": "สิทธิ์เชื่อมต่อหมดอายุหรือไม่ครบ",
  "provider-rate-limited": "แพลตฟอร์มจำกัดการเรียกชั่วคราว",
  "provider-timeout": "แพลตฟอร์มตอบช้าเกินกำหนด",
  "provider-invalid-response": "ข้อมูลจากแพลตฟอร์มอยู่ในรูปแบบที่ระบบอ่านไม่ได้",
  "provider-selection-required": "พบหลายบัญชี กรุณาระบุบัญชีที่จะเก็บสถิติก่อน",
  "provider-unavailable": "แพลตฟอร์มยังไม่พร้อมใช้งาน",
  "database-not-ready": "ฐานข้อมูลยังไม่พร้อมรับสถิติ",
  "database-auth-required": "ระบบเชื่อมฐานข้อมูลไม่ได้ กรุณาติดต่อผู้ดูแล",
  "database-forbidden": "ระบบไม่มีสิทธิ์อ่านหรือบันทึกสถิติ กรุณาติดต่อผู้ดูแล",
  "database-unavailable": "ฐานข้อมูลติดต่อไม่ได้ชั่วคราว",
  "sync-in-progress": "กำลังดึงข้อมูลอยู่",
};

async function manualSync(endpoint: string) {
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" } });
  const body = await response.json().catch(() => null) as { error?: string; discovery?: unknown; persistence?: {
    matchedSnapshots: number; providerContentsSeen?: number; syncMode?: string;
    metricsOverlapDays?: number | null; metricsWindowDays?: number | null;
    metadataRefreshAttempted?: number; metadataRefreshSucceeded?: number; metadataRefreshBatchSize?: number | null;
  } } | null;
  if (!response.ok || !body?.discovery) throw new Error(errorLabel[body?.error ?? ""] ?? "ดึงข้อมูลไม่สำเร็จ");
  return body;
}

function DecisionCards({ items }: { items: Array<{ label: string; value: string; note: string }> }) {
  return <dl className="mt-5 grid gap-3 sm:grid-cols-3">{items.map((item) => (
    <div key={item.label} className="rounded-2xl border border-white/10 bg-black/10 p-4">
      <dt className="text-xs text-white/50">{item.label}</dt>
      <dd className="mt-2 text-xl font-semibold">{item.value}</dd>
      <dd className="mt-1 text-xs leading-5 text-white/45">{item.note}</dd>
    </div>
  ))}</dl>;
}

function engagementRate(views: number, engagements: number) {
  return views > 0 ? `${((engagements / views) * 100).toLocaleString("th-TH", { maximumFractionDigits: 1 })}%` : "—";
}

export function MetaReadOnlyPanel({ ready, analyticsReady, missing }: { ready: boolean; analyticsReady: boolean; missing: string[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<null | {
    status: string;
    pages: Array<{ id: string; name: string; selected: boolean; instagram: { status: string; username: string | null } }>;
    fetchedAt: string;
    facebookPosts: Array<{ id: string; text: string; publishedAt: string; metrics: { likes?: number; comments?: number; shares?: number } }>;
    instagramMedia: Array<{ id: string; text: string; publishedAt: string; metrics: { likes?: number; comments?: number } }>;
  }>(null);
  const [stored, setStored] = useState<number | null>(null);
  const [syncDetail, setSyncDetail] = useState<string | null>(null);
  async function sync() {
    setLoading(true);
    setError(null);
    setSyncDetail(null);
    try {
      const response = await manualSync(analyticsReady ? "/api/admin/social/analytics/sync/meta/" : "/api/admin/social/providers/meta/discovery/");
      setResult(response.discovery as typeof result);
      setStored(response.persistence?.providerContentsSeen ?? response.persistence?.matchedSnapshots ?? null);
      const persistence = response.persistence;
      if (persistence?.metricsOverlapDays) {
        setSyncDetail(`เทียบข้อมูลย้อนหลัง ${persistence.metricsOverlapDays} วัน · รอบนี้อ่าน ${persistence.metricsWindowDays ?? persistence.metricsOverlapDays} วัน · อัปเดตรายละเอียด ${persistence.metadataRefreshSucceeded ?? 0}/${persistence.metadataRefreshAttempted ?? 0} รายการ`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ดึงข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="mt-8 rounded-3xl border border-emerald-200/15 bg-emerald-200/[0.04] p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-200">Meta · อ่านข้อมูลเมื่อกดเท่านั้น</div>
      <p className="mt-2 text-sm text-white/65">อ่าน Facebook Page, Instagram และตัวเลขของโพสต์ล่าสุด เพื่อหาเนื้อหาที่ควรต่อยอด โดยไม่โพสต์หรือแก้ข้อมูลต้นทาง</p>
      {!ready ? <p className="mt-3 text-xs text-amber-200">รอตั้งค่า: {missing.join(", ")}</p> : null}
      <button type="button" disabled={!ready || loading} onClick={sync} className="mt-4 min-h-11 rounded-xl bg-emerald-200 px-4 py-2.5 text-sm font-semibold text-[#111827] disabled:cursor-not-allowed disabled:opacity-40">
        {loading ? "กำลังอ่าน…" : analyticsReady ? "ดึงเนื้อหาและสถิติย้อนหลัง" : "อ่านข้อมูล Meta"}
      </button>
      {error ? <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p> : null}
      {stored !== null ? <p role="status" className="mt-3 text-sm text-emerald-200">บันทึกเนื้อหาและสถิติจาก Meta แล้ว {stored} รายการ</p> : null}
      {syncDetail ? <p className="mt-1 text-xs text-white/45">{syncDetail}</p> : null}
      {result ? <div className="mt-5">
        <p className="text-xs text-white/45">อัปเดตล่าสุด {new Date(result.fetchedAt).toLocaleString("th-TH")}</p>
        <DecisionCards items={[
          { label: "การมีส่วนร่วมบน Facebook", value: result.facebookPosts.reduce((sum, item) => sum + (item.metrics.likes ?? 0) + (item.metrics.comments ?? 0) + (item.metrics.shares ?? 0), 0).toLocaleString("th-TH"), note: `จาก ${result.facebookPosts.length} โพสต์ในรอบนี้` },
          { label: "การมีส่วนร่วมบน Instagram", value: result.instagramMedia.reduce((sum, item) => sum + (item.metrics.likes ?? 0) + (item.metrics.comments ?? 0), 0).toLocaleString("th-TH"), note: `จาก ${result.instagramMedia.length} ชิ้นในรอบนี้` },
          { label: "สิ่งที่ควรทำต่อ", value: result.facebookPosts.length + result.instagramMedia.length > 0 ? "ดูเนื้อหาที่ดีที่สุด" : "เลือกเพจ", note: result.pages.some((page) => page.selected) ? "ใช้รูปแบบและหัวข้อของชิ้นที่มีส่วนร่วมสูงสุด" : "กรุณาเลือกเพจเมื่อพบบัญชีมากกว่าหนึ่งรายการ" },
        ]} />
        <div className="mt-4 grid gap-3 lg:grid-cols-2">{result.pages.map((page) => (
        <article key={page.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="font-semibold">{page.name}</div>
          <div className="mt-2 text-sm text-white/60">{page.instagram.status === "linked" ? `Instagram @${page.instagram.username}` : "ยังไม่มี Instagram ที่เชื่อม"}</div>
        </article>
        ))}</div>
      </div> : null}
    </section>
  );
}

export function YouTubeReadOnlyPanel({ ready, analyticsReady, missing }: { ready: boolean; analyticsReady: boolean; missing: string[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<null | {
    fetchedAt: string;
    channel: { title: string; metrics: { viewCount: number; subscriberCount?: number; videoCount: number } };
    videos: Array<{ id: string; title: string; publishedAt: string; metrics: { views?: number; likes?: number; comments?: number } }>;
  }>(null);
  const [stored, setStored] = useState<number | null>(null);
  async function sync() {
    setLoading(true);
    setError(null);
    try {
      const response = await manualSync(analyticsReady ? "/api/admin/social/analytics/sync/youtube/" : "/api/admin/social/providers/youtube/discovery/");
      setResult(response.discovery as typeof result);
      setStored(response.persistence?.matchedSnapshots ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ดึงข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }
  const recentViews = result?.videos.reduce((sum, video) => sum + (video.metrics.views ?? 0), 0) ?? 0;
  const recentEngagements = result?.videos.reduce((sum, video) => sum + (video.metrics.likes ?? 0) + (video.metrics.comments ?? 0), 0) ?? 0;
  const topVideo = result?.videos.reduce<(typeof result.videos)[number] | null>((best, video) => !best || (video.metrics.views ?? 0) > (best.metrics.views ?? 0) ? video : best, null);
  return (
    <section className="mt-7 rounded-3xl border border-red-200/15 bg-red-200/[0.04] p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-red-200">YouTube · อ่านข้อมูลเมื่อกดเท่านั้น</div>
      <p className="mt-2 text-sm text-white/65">อ่านช่องและวิดีโอล่าสุดเพื่อดูยอดรับชมและการมีส่วนร่วม โดยไม่อัปโหลด แก้ไข หรือลบวิดีโอ</p>
      {!ready ? <p className="mt-3 text-xs text-amber-200">รอตั้งค่า: {missing.join(", ")}</p> : null}
      <button type="button" disabled={!ready || loading} onClick={sync} className="mt-4 min-h-11 rounded-xl bg-red-200 px-4 py-2.5 text-sm font-semibold text-[#111827] disabled:cursor-not-allowed disabled:opacity-40">
        {loading ? "กำลังอ่าน…" : analyticsReady ? "ดึงและบันทึกสถิติย้อนหลัง" : "อ่านข้อมูล YouTube"}
      </button>
      {error ? <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p> : null}
      {stored !== null ? <p role="status" className="mt-3 text-sm text-emerald-200">บันทึกข้อมูลที่ตรงกับวิดีโอ CCPun แล้ว {stored} รายการ</p> : null}
      {result ? <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">{result.channel.title}</div><div className="text-xs text-white/45">อัปเดต {new Date(result.fetchedAt).toLocaleString("th-TH")}</div></div>
        <DecisionCards items={[
          { label: "ยอดดู · 20 วิดีโอล่าสุด", value: recentViews.toLocaleString("th-TH"), note: "ไม่รวมเป็นยอดเดียวกับแพลตฟอร์มอื่น" },
          { label: "สัดส่วนการมีส่วนร่วม", value: engagementRate(recentViews, recentEngagements), note: "ยอดถูกใจและคอมเมนต์ เทียบกับยอดดู" },
          { label: "วิดีโอที่ควรต่อยอด", value: topVideo?.title ?? "ยังไม่มีข้อมูล", note: topVideo ? `${(topVideo.metrics.views ?? 0).toLocaleString("th-TH")} ครั้ง` : "ลองดึงข้อมูลเมื่อมีวิดีโอ" },
        ]} />
      </div> : null}
    </section>
  );
}

export function TikTokReadOnlyPanel({ ready, analyticsReady, missing }: { ready: boolean; analyticsReady: boolean; missing: string[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<null | {
    profile: { displayName: string };
    videos: Array<{ id: string; title: string; publishedAt: string; metrics: { viewCount?: number; likeCount?: number; commentCount?: number; shareCount?: number } }>;
  }>(null);
  const [stored, setStored] = useState<number | null>(null);
  async function sync() {
    setLoading(true);
    setError(null);
    try {
      const response = await manualSync(analyticsReady
        ? "/api/admin/social/analytics/sync/tiktok/"
        : "/api/admin/social/providers/tiktok/discovery/");
      setResult(response.discovery as typeof result);
      setStored(response.persistence?.matchedSnapshots ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ดึงข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="mt-7 rounded-3xl border border-cyan-200/15 bg-cyan-200/[0.04] p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-cyan-200">TikTok · อ่านข้อมูลเมื่อกดเท่านั้น</div>
      <p className="mt-2 text-sm text-white/65">อ่านโปรไฟล์ วิดีโอล่าสุด และตัวเลขจาก TikTok โดยไม่อัปโหลดหรือโพสต์</p>
      {!ready ? <p className="mt-3 text-xs text-amber-200">รอตั้งค่า: {missing.join(", ")}</p> : null}
      <button type="button" disabled={!ready || loading} onClick={sync} className="mt-4 min-h-11 rounded-xl bg-cyan-200 px-4 py-2.5 text-sm font-semibold text-[#111827] disabled:cursor-not-allowed disabled:opacity-40">
        {loading ? "กำลังอ่าน…" : analyticsReady ? "ดึงและบันทึกสถิติย้อนหลัง" : "อ่านข้อมูล TikTok"}
      </button>
      {error ? <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p> : null}
      {stored !== null ? <p role="status" className="mt-3 text-sm text-emerald-200">บันทึกข้อมูลที่ตรงกับโพสต์ CCPun แล้ว {stored} รายการ</p> : null}
      {result ? <div className="mt-5">
        <div className="font-semibold">{result.profile.displayName}</div>
        <DecisionCards items={(() => {
          const views = result.videos.reduce((sum, video) => sum + (video.metrics.viewCount ?? 0), 0);
          const engagements = result.videos.reduce((sum, video) => sum + (video.metrics.likeCount ?? 0) + (video.metrics.commentCount ?? 0) + (video.metrics.shareCount ?? 0), 0);
          const top = result.videos.reduce<(typeof result.videos)[number] | null>((best, video) => !best || (video.metrics.viewCount ?? 0) > (best.metrics.viewCount ?? 0) ? video : best, null);
          return [
            { label: "ยอดดู · 20 วิดีโอล่าสุด", value: views.toLocaleString("th-TH"), note: "ใช้ดูทิศทางผลงานภายใน TikTok" },
            { label: "สัดส่วนการมีส่วนร่วม", value: engagementRate(views, engagements), note: "ยอดถูกใจ คอมเมนต์ และแชร์ เทียบกับยอดดู" },
            { label: "วิดีโอที่ควรต่อยอด", value: top?.title || "ยังไม่มีข้อมูล", note: top ? `${(top.metrics.viewCount ?? 0).toLocaleString("th-TH")} ครั้ง` : "ลองดึงข้อมูลเมื่อมีวิดีโอ" },
          ];
        })()} />
        <div className="mt-3 grid gap-3 lg:grid-cols-2">{result.videos.map((video) => (
          <article key={video.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="font-semibold">{video.title || "วิดีโอไม่มีชื่อ"}</div>
            <div className="mt-2 text-xs text-white/45">{video.publishedAt.slice(0, 10)}</div>
            <div className="mt-3 text-sm text-white/65">ยอดดู {video.metrics.viewCount?.toLocaleString("th-TH") ?? "—"} · ถูกใจ {video.metrics.likeCount?.toLocaleString("th-TH") ?? "—"}</div>
          </article>
        ))}</div>
      </div> : null}
    </section>
  );
}
