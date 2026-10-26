import Link from "next/link";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { readPostPublishHealth } from "@/lib/admin/seo-intelligence/post-publish-read-model";
const date = (value: unknown) => value ? new Date(String(value)).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"}) : "ยังไม่มีข้อมูล";
export default async function PostPublishHealthCard() {
  const identity = await requireAdminPermission("settings:read");
  if (identity.role !== "owner") return null;
  const health = await readPostPublishHealth();
  return <section data-seo-publish-health="" className="rounded-3xl border border-white/10 p-5 md:p-6">
    <h2 className="text-lg font-semibold">SEO หลังเผยแพร่</h2>
    {health ? <dl className="mt-3 grid gap-2 text-sm text-white/70"><div>รับการเผยแพร่ล่าสุด: {date(health.last_webhook)}</div><div>ตรวจรอบล่าสุด: {date(health.last_worker)}</div><div>รอตรวจซ้ำ: {health.retries}</div><div>ต้องตรวจผลกับผู้ให้บริการ: {health.reconciliation}</div></dl> : <p className="mt-3 text-sm text-white/70">ยังอ่านสถานะงานไม่ได้</p>}
    <Link className="mt-3 inline-flex min-h-11 items-center text-[#e0c985] underline" href="/seo/post-publish/">ดูผลหลังเผยแพร่</Link>
  </section>;
}
