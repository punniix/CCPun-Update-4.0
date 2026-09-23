import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { getSocialAnalyticsIngestionRuntimeStatus } from "@/lib/admin/social/analytics-ingestion";
import { SYNTHETIC_META_CONNECTION } from "@/lib/admin/social/providers/meta/connection";
import { getSocialProviderReadiness } from "@/lib/admin/social/provider-readonly";
import { MetaReadOnlyPanel } from "./provider-readonly-panels";

export const metadata: Metadata = { title: "การเชื่อมต่อ Meta" };

const statusLabel = {
  "not-connected": "ยังไม่ได้เชื่อมต่อ",
  "reconnect-required": "ต้องเชื่อมต่อใหม่",
  "no-page": "ไม่พบ Facebook Page",
  "selection-required": "ต้องเลือก Facebook Page",
  connected: "พร้อมอ่านข้อมูล",
} as const;

export default async function MetaConnectionUatPage() {
  await requireAdminPermission("social:read");
  const runtime = getSocialOperationsRuntimeStatus();
  if (!runtime.enabled) notFound();
  const showFixture = runtime.environment === "admin-uat";
  const connection = SYNTHETIC_META_CONNECTION;
  const readiness = getSocialProviderReadiness("meta");
  const missing = readiness.required.filter((item) => !item.valid).map((item) => item.name);

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">การเชื่อมต่อโซเชียล</p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">การเชื่อมต่อ Meta</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
            อ่าน Facebook Page, Instagram และตัวเลขของโพสต์ล่าสุดเมื่อคุณกดดึงข้อมูลเท่านั้น
          </p>
        </div>
        <Link href="/social/posts/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5">
          กลับไปจัดการโพสต์
        </Link>
      </div>

      {showFixture ? <><section className="mt-7 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-white/55">สถานะ</div>
          <div className="mt-2 font-semibold text-emerald-200">{statusLabel[connection.status]}</div>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-white/55">Facebook Page ที่พบ</div>
          <div className="mt-2 font-semibold">{connection.pages.length}</div>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-white/55">การอ่านข้อมูล</div>
          <div className="mt-2 font-semibold text-amber-200">{readiness.status === "manual-sync-ready" ? "กดเองเท่านั้น" : "รอตั้งค่า"}</div>
        </article>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">เพจตัวอย่างที่ระบบพบ</h2>
        <p className="mt-2 text-sm text-white/60">หากพบหลายเพจ ต้องเลือกให้ชัดเจนก่อน ระบบจะไม่เลือกแทนเจ้าของ</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {connection.pages.map((page) => (
            <article key={page.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{page.name}</h3>
                {page.selected ? <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">เลือกแล้ว</span> : null}
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-white/45">Instagram</dt>
                  <dd className="mt-1 text-white/75">{page.instagram.status === "linked" ? `@${page.instagram.username}` : "ยังไม่ได้เชื่อม"}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section role="note" className="mt-7 rounded-3xl border border-amber-200/20 bg-amber-200/[0.05] p-5 text-sm leading-6 text-amber-50/80">
        ข้อมูลตัวอย่างนี้ใช้สิทธิ์อ่านเท่านั้น ไม่มีสิทธิ์เผยแพร่ และไม่มีรหัสเชื่อมต่อจริง
        <details className="mt-2 text-xs"><summary className="cursor-pointer">ดูสิทธิ์ตัวอย่างสำหรับทีมเทคนิค</summary><p className="mt-1">{connection.grantedScopes.join(" + ")}</p></details>
      </section></> : null}
      <MetaReadOnlyPanel ready={readiness.status === "manual-sync-ready"} analyticsReady={getSocialAnalyticsIngestionRuntimeStatus().enabled} missing={missing} />
    </div>
  );
}
