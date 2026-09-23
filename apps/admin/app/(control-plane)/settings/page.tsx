import Link from "next/link";
import { requireAdminPermission } from "@/lib/admin/require-permission";

const ITEMS = [
  ["/settings/integrations/", "การเชื่อมต่อ", "ตรวจบริการและแหล่งข้อมูลที่ระบบกำลังใช้งาน"],
  ["/settings/access/", "สิทธิ์ผู้ใช้", "ตรวจบทบาทและขอบเขตสิทธิ์ของบัญชี"],
  ["/settings/system/", "ข้อมูลระบบ", "ดูสภาพแวดล้อมและเวอร์ชันที่กำลังใช้งาน"],
] as const;

export default async function SettingsPage() {
  await requireAdminPermission("settings:read");
  return <div><p className="text-xs font-semibold tracking-[0.12em] text-gold-500">ดูแลระบบ</p><h1 className="mt-2 text-3xl font-semibold">ตั้งค่า</h1><div className="mt-6 grid gap-3 md:grid-cols-3">{ITEMS.map(([href, title, description]) => <Link key={href} href={href} className="glass-card min-h-40 p-5"><h2 className="text-lg font-semibold text-gold-400">{title}</h2><p className="mt-2 text-sm leading-6 text-white/70">{description}</p></Link>)}</div></div>;
}
