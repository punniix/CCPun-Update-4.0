import Link from "next/link";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export async function SettingsPage({ items, eyebrow, title }: { items: readonly (readonly [string, string, string])[]; eyebrow: string; title: string }) {
  await requireAdminPermission("settings:read");
  const account = items.find(([href]) => href === "/settings/access/");
  const integrations = items.find(([href]) => href === "/settings/integrations/");
  const advanced = items.filter(([href]) => href !== account?.[0] && href !== integrations?.[0]);
  const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e0c985]";
  return <div>
    <p className="text-sm leading-[22px] font-semibold tracking-[0.12em] text-gold-500">{eyebrow}</p>
    <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
    <p className="mt-3 max-w-3xl text-base leading-6 text-white/80">ดูบัญชี การเชื่อมต่อ และงานเบื้องหลัง เลือกเรื่องที่ต้องจัดการเพื่อดูสถานะและขั้นตอนถัดไป</p>
    <div className="mt-6 divide-y divide-white/15 border-y border-white/15">
      {account ? <section className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div><h2 className="text-xl font-semibold">บัญชี</h2><p className="mt-2 text-base leading-6 text-white/75">{account[2]}</p></div>
        <Link href={account[0]} className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 py-2 text-base leading-6 text-white/85 ${focus}`}>ดูบัญชีและสิทธิ์</Link>
      </section> : null}
      {integrations ? <section className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div><h2 className="text-xl font-semibold">การเชื่อมต่อ</h2><p className="mt-2 text-base leading-6 text-white/75">{integrations[2]}</p></div>
        <Link href={integrations[0]} className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 py-2 text-base leading-6 text-white/85 ${focus}`}>ตรวจการเชื่อมต่อ</Link>
      </section> : null}
      <section className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div><h2 className="text-xl font-semibold">งานเบื้องหลัง</h2><p className="mt-2 text-base leading-6 text-white/75">ดูงานล่าสุด ผลที่ยืนยันแล้ว และงานที่ต้องตรวจผลก่อนดำเนินการต่อ</p></div>
        <Link href="/operations/jobs/" className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 py-2 text-base leading-6 text-white/85 ${focus}`}>ดูสถานะงาน</Link>
      </section>
    </div>
    {advanced.length ? <details className="mt-6 border-b border-white/15 pb-3">
      <summary className={`min-h-11 cursor-pointer py-2 text-base leading-6 text-white/80 ${focus}`}>ข้อมูลระบบเพิ่มเติม</summary>
      <div className="mt-2 divide-y divide-white/10">{advanced.map(([href, itemTitle, description]) => <Link key={href} href={href} className={`block min-h-11 rounded-lg py-4 text-base leading-6 ${focus}`}><h2 className="font-semibold text-gold-400">{itemTitle}</h2><p className="mt-1 text-sm leading-[22px] text-white/75">{description}</p></Link>)}</div>
    </details> : null}
  </div>;
}
