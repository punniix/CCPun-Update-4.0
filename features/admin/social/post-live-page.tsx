import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { SYNTHETIC_POST_LIVE_REPORT } from "@/lib/admin/social/post-live";

export const metadata: Metadata = { title: "Post-Live Analytics UAT" };

const providerStateLabel = {
  available: "มีข้อมูลย้อนหลัง",
  unavailable: "ผู้ให้บริการยังส่งข้อมูลไม่ได้",
  unsupported: "แพลตฟอร์มยังไม่รองรับ metric นี้",
} as const;

export default async function PostLiveAnalyticsUatPage() {
  await requireAdminPermission("social:read");
  const runtime = getSocialOperationsRuntimeStatus();
  if (!runtime.enabled || runtime.environment === "production-admin") notFound();
  const report = SYNTHETIC_POST_LIVE_REPORT;

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">WEBSITE 4.2 · MANUAL POST-LIVE UAT</p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">สถิติย้อนหลังหลัง Live</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">อ่านข้อมูลหลัง Live จบเท่านั้น ไม่มี Real-time polling, background sync หรือการเรียก Provider ในรอบนี้</p>
        </div>
        <Link href="/social/posts/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5">กลับ Social Operations</Link>
      </div>

      {report.snapshots.map((snapshot) => (
        <article key={snapshot.snapshotId} className="mt-7 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[#e0c985]">{snapshot.platform} · {snapshot.collectionMode}</div>
              <h2 className="mt-2 text-xl font-semibold">{providerStateLabel[snapshot.providerState]}</h2>
            </div>
            <span className="rounded-full bg-amber-200/10 px-3 py-1 text-xs text-amber-100">Real-time ปิด</span>
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-white/45">Master Content</dt><dd className="mt-1 text-white/75">{snapshot.masterContentId}</dd></div>
            <div><dt className="text-white/45">Live จบ</dt><dd className="mt-1 text-white/75">{snapshot.liveEndedAt.slice(0, 16).replace("T", " ")} UTC</dd></div>
            <div><dt className="text-white/45">ข้อมูล ณ</dt><dd className="mt-1 text-white/75">{snapshot.fetchedAt.slice(0, 16).replace("T", " ")} UTC</dd></div>
          </dl>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <section>
              <h3 className="font-semibold">Native metrics จากต้นทาง</h3>
              <dl className="mt-3 space-y-3">
                {snapshot.nativeMetrics.map((metric) => (
                  <div key={metric.key} className="flex items-end justify-between gap-3 border-b border-white/5 pb-3">
                    <div><dt className="text-sm text-white/70">{metric.label}</dt><dd className="mt-1 text-xs text-white/40">{metric.key}</dd></div>
                    <div className="font-semibold">{metric.value.toLocaleString("th-TH")}</div>
                  </div>
                ))}
              </dl>
            </section>
            <section>
              <h3 className="font-semibold">Normalized metrics สำหรับเทียบภายใน CCPun</h3>
              <dl className="mt-3 space-y-3">
                {snapshot.normalizedMetrics.map((metric) => (
                  <div key={metric.key} className="flex items-end justify-between gap-3 border-b border-white/5 pb-3">
                    <div><dt className="text-sm text-white/70">{metric.label}</dt><dd className="mt-1 text-xs text-white/40">{metric.dimension}</dd></div>
                    <div className="font-semibold">{metric.value.toLocaleString("th-TH")}</div>
                  </div>
                ))}
              </dl>
            </section>
          </div>
          <p className="mt-5 text-xs leading-5 text-white/45">{snapshot.limitations[0]}</p>
        </article>
      ))}
    </div>
  );
}
