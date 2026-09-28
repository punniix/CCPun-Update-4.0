import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AgentRuntimeJobStatus } from "@/features/admin/operations/AgentRuntimeJobStatus";
import { readAgentRuntimeJobDetail } from "@/lib/admin/operations/agent-os-runtime-detail";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export const metadata: Metadata = { title: "รายละเอียดงาน Agent OS" };

export default async function AgentRuntimeJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  await requireAdminPermission("settings:read");
  const { jobId } = await params;
  const result = await readAgentRuntimeJobDetail(jobId);

  if (result.state === "not_found") notFound();

  return (
    <div>
      <Link href="/operations/jobs/" className="text-sm text-white/55 hover:text-white">
        ← งานเบื้องหลัง
      </Link>
      <p className="mt-5 text-xs font-semibold tracking-[0.12em] text-[#e0c985]">สถานะงานอัตโนมัติ</p>
      <h1 className="mt-2 text-3xl font-semibold">รายละเอียดงานเบื้องหลัง</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
        ดูว่างานถึงขั้นไหนและใช้เวลานานกว่าปกติหรือไม่ โดยไม่แสดงข้อมูลส่วนตัวของลูกค้า
      </p>

      {result.state === "ready" && result.detail ? (
        <div className="mt-6">
          <AgentRuntimeJobStatus initial={result.detail} />
        </div>
      ) : (
        <section className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-5 text-sm leading-6 text-amber-50">
          ยังอ่านสถานะงานอัตโนมัติไม่ได้ ระบบจะไม่เดาผลหรือแสดงเป็นศูนย์
        </section>
      )}
    </div>
  );
}
