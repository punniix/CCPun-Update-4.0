"use client";

import { useEffect, useMemo, useState } from "react";
import { loadSocialWorkspace, type ApprovedVariantApi, type SocialDraftApiItem } from "@/features/admin/social/social-workspace-client";

const platformLabel = { facebook: "Facebook", instagram: "Instagram" } as const;
const statusLabel: Record<string, string> = {
  drafting: "กำลังร่าง", "content-review": "รอตรวจเนื้อหา", "fact-check": "รอตรวจข้อเท็จจริง",
  "compliance-review": "รอตรวจข้อกำกับ", "ready-for-coo": "พร้อมให้ผู้อนุมัติตรวจ", approved: "อนุมัติแล้ว",
  queued: "รอส่ง", "native-scheduled": "นัดหมายแล้ว", "awaiting-native-finish": "รอทำต่อในแอป",
  processing: "กำลังดำเนินการ", published: "เผยแพร่แล้ว", failed: "ไม่สำเร็จ", cancelled: "ยกเลิก", superseded: "มีรุ่นใหม่แทน",
};

type Workspace = Awaited<ReturnType<typeof loadSocialWorkspace>>;

function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void loadSocialWorkspace(controller.signal).then(setWorkspace);
    return () => controller.abort();
  }, []);
  return workspace;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "ยังไม่กำหนด";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function publishingModeLabel(value: string | null | undefined) {
  if (value === "native-scheduled") return "ตั้งเวลาที่ Meta";
  if (value === "direct") return "ส่งตรงหลังอนุมัติ";
  if (value === "native-finish") return "ทำต่อบนมือถือ";
  return value ?? "ยังไม่กำหนด";
}

function workspaceNotice(workspace: Workspace | null) {
  if (!workspace) return "กำลังโหลดข้อมูล…";
  if (workspace.draftError && workspace.publicationError) return "โหลดฉบับร่างและสถานะการเผยแพร่ไม่สำเร็จ";
  if (workspace.draftError) return "อ่านสถานะการเผยแพร่ได้ แต่ยังอ่านฉบับร่างไม่ได้หรือบัญชีนี้ไม่มีสิทธิ์";
  if (workspace.publicationError) return "อ่านฉบับร่างได้ แต่ยังอ่านสถานะการเผยแพร่ไม่ได้";
  return "ข้อมูลจริงจากฉบับร่างใน Sanity และรายการเผยแพร่";
}

export function SocialOverviewSummary() {
  const workspace = useWorkspace();
  const counts = useMemo(() => {
    const drafts = workspace?.drafts ?? [];
    const publications = workspace?.publications.map((item) => item.publication).filter(Boolean) ?? [];
    return {
      drafts: drafts.length,
      review: drafts.filter((item) => item.reviewStatus !== "approved").length,
      approved: drafts.filter((item) => item.reviewStatus === "approved").length,
      scheduled: publications.filter((item) => item?.status === "native-scheduled" || item?.status === "queued" || item?.status === "approved").length,
      handoff: publications.filter((item) => item?.status === "awaiting-native-finish").length,
      published: publications.filter((item) => item?.status === "published").length,
    };
  }, [workspace]);

  return <>
    <p aria-live="polite" className="mt-4 text-xs text-white/55">{workspaceNotice(workspace)}</p>
    <section aria-label="สถานะงานโซเชียล" className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {[
        ["ฉบับร่างใน Sanity", counts.drafts], ["อยู่ระหว่างตรวจ", counts.review], ["อนุมัติแล้ว", counts.approved],
        ["พร้อม/นัดหมาย", counts.scheduled], ["รอทำต่อบนมือถือ", counts.handoff], ["เผยแพร่แล้ว", counts.published],
      ].map(([label, value]) => <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="text-xs text-white/65">{label}</div><div className="mt-2 text-2xl font-semibold">{Number(value).toLocaleString("th-TH")}</div></article>)}
    </section>
    <section className="mt-6 rounded-3xl border border-[#e0c985]/25 bg-[#e0c985]/[0.06] p-5">
      <p className="text-xs text-white/65">เนื้อหาหลักที่อนุมัติแล้ว</p>
      <div className="mt-2 text-2xl font-semibold text-[#f4df9b]">{workspace ? workspace.masterContentChoices.length.toLocaleString("th-TH") : "—"} รายการ</div>
      {workspace?.masterContentChoices.length ? <ul className="mt-3 grid gap-2 text-sm text-white/75 sm:grid-cols-2">{workspace.masterContentChoices.slice(0, 4).map((item) => <li key={item.id} className="rounded-xl border border-white/10 px-3 py-2"><div className="font-medium text-white/90">{item.title}</div>{item.summary ? <p className="mt-1 line-clamp-2 text-xs text-white/55">{item.summary}</p> : null}</li>)}</ul> : <p className="mt-2 text-sm text-white/60">ยังไม่มีรายการที่ผู้มีสิทธิ์ตรวจและอนุมัติ หรือระบบฉบับร่างยังไม่พร้อม</p>}
    </section>
  </>;
}

type CalendarItem = {
  id: string;
  draft: SocialDraftApiItem | null;
  approved: ApprovedVariantApi | null;
};

export function SocialCalendarDashboard() {
  const workspace = useWorkspace();
  const [platform, setPlatform] = useState("all");
  const items = useMemo(() => {
    if (!workspace) return [];
    const approvedById = new Map(workspace.publications.map((item) => [item.variantId, item]));
    const rows: CalendarItem[] = workspace.drafts.map((draft) => ({ id: draft.variantId, draft, approved: approvedById.get(draft.variantId) ?? null }));
    const draftIds = new Set(rows.map((item) => item.id));
    rows.push(...workspace.publications.filter((item) => !draftIds.has(item.variantId)).map((approved) => ({ id: approved.variantId, draft: null, approved })));
    return rows.filter((item) => platform === "all" || (item.draft?.channel ?? item.approved?.platform) === platform)
      .sort((a, b) => Date.parse(a.approved?.publication?.scheduledAt ?? "9999-12-31") - Date.parse(b.approved?.publication?.scheduledAt ?? "9999-12-31"));
  }, [platform, workspace]);

  return <div className="mt-7">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <p aria-live="polite" className="text-xs text-white/55">{workspaceNotice(workspace)}</p>
      <label className="text-xs text-white/70">แพลตฟอร์ม<select value={platform} onChange={(event) => setPlatform(event.target.value)} className="mt-1 block min-h-11 rounded-xl border border-white/15 bg-[#151a20] px-3 text-sm text-white focus:border-[#e0c985] focus:outline-none"><option value="all">ทั้งหมด</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option></select></label>
    </div>
    <section className="mt-4 grid gap-4 lg:grid-cols-2" aria-label="รายการปฏิทินเนื้อหา">
      {items.map((item) => {
        const platformName = item.draft?.channel ?? item.approved?.platform ?? "facebook";
        const reviewStatus = item.draft?.reviewStatus ?? item.approved?.reviewStatus ?? "approved";
        const publication = item.approved?.publication;
        return <article key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="text-xs font-semibold text-[#e0c985]">{platformLabel[platformName]} · {item.draft?.format ?? item.approved?.format}</div><h2 className="mt-2 break-words font-semibold">{item.draft?.title ?? item.approved?.title}</h2></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">{statusLabel[publication?.status ?? reviewStatus] ?? publication?.status ?? reviewStatus}</span></div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-white/45">การตรวจเนื้อหา</dt><dd className="mt-1 text-white/75">{statusLabel[reviewStatus] ?? reviewStatus}</dd></div>
            <div><dt className="text-white/45">วิธีส่งโพสต์</dt><dd className="mt-1 text-white/75">{publishingModeLabel(item.draft?.publishingMode ?? item.approved?.publishingMode)}</dd></div>
            <div><dt className="text-white/45">เวลาที่กำหนด</dt><dd className="mt-1 text-white/75">{formatDate(publication?.scheduledAt)}</dd></div>
            <div><dt className="text-white/45">สถานะการเผยแพร่</dt><dd className="mt-1 text-white/75">{publication ? statusLabel[publication.status] ?? publication.status : "ยังไม่มีรายการ"}</dd></div>
          </dl>
          <details className="mt-4 break-all text-xs text-white/45"><summary className="cursor-pointer">ดูรายละเอียดสำหรับทีมเทคนิค</summary><p className="mt-1">รหัส {item.id} · {item.draft ? "ฉบับร่างใน Sanity" : "ฉบับที่อนุมัติแล้ว"}</p></details>
        </article>;
      })}
      {workspace && items.length === 0 ? <p className="rounded-2xl border border-white/10 p-5 text-sm text-white/65">ไม่มีฉบับร่างหรือรายการเผยแพร่ตามตัวกรอง</p> : null}
    </section>
  </div>;
}
