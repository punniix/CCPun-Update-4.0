import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { getSocialAnalyticsIngestionRuntimeStatus } from "@/lib/admin/social/analytics-ingestion";
import { getSocialProviderReadiness } from "@/lib/admin/social/provider-readonly";
import { YouTubeReadOnlyPanel } from "./provider-readonly-panels";

export const metadata: Metadata = { title: "YouTube Connection" };

export default async function YouTubeConnectionUatPage() {
  await requireAdminPermission("social:read");
  const runtime = getSocialOperationsRuntimeStatus();
  if (!runtime.enabled || runtime.environment === "production-admin") notFound();
  const readiness = getSocialProviderReadiness("youtube");
  const missing = readiness.required.filter((item) => !item.valid).map((item) => item.name);
  return <div>
    <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">WEBSITE 4.2 · READ-ONLY UAT</p>
    <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold">YouTube Connection</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">เตรียม YouTube Data API สำหรับอ่าน Channel และสถิติวิดีโอล่าสุดเมื่อเจ้าของกดเท่านั้น</p>
      </div>
      <Link href="/social/posts/" className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5">กลับ Social Operations</Link>
    </div>
    <YouTubeReadOnlyPanel ready={readiness.status === "manual-sync-ready"} analyticsReady={getSocialAnalyticsIngestionRuntimeStatus().enabled} missing={missing} />
    <section role="note" className="mt-7 rounded-3xl border border-amber-200/20 bg-amber-200/[0.05] p-5 text-sm leading-6 text-amber-50/80">
      Scope ที่ยอมรับเท่านั้น: {readiness.scopes.join(" + ")} · upload, update และ delete ถูกปฏิเสธ
    </section>
  </div>;
}
