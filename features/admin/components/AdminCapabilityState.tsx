import Link from "next/link";

export type AdminCapabilityStatus =
  | "loading"
  | "no-data"
  | "not-configured"
  | "disconnected"
  | "unauthorized"
  | "forbidden"
  | "provider-error"
  | "stale"
  | "partial"
  | "healthy-zero";

const STATUS_LABELS: Record<AdminCapabilityStatus, string> = {
  loading: "กำลังโหลด",
  "no-data": "ยังไม่มีข้อมูล",
  "not-configured": "ยังไม่ได้ตั้งค่า",
  disconnected: "ขาดการเชื่อมต่อ",
  unauthorized: "ยังไม่ได้เข้าสู่ระบบ",
  forbidden: "ไม่มีสิทธิ์",
  "provider-error": "แหล่งข้อมูลขัดข้อง",
  stale: "ข้อมูลเก่า",
  partial: "ข้อมูลบางส่วน",
  "healthy-zero": "ปกติ · ไม่มีรายการ",
};

export default function AdminCapabilityState({
  title,
  description,
  status,
  source,
  action,
}: {
  title: string;
  description: string;
  status: AdminCapabilityStatus;
  source: string;
  action?: { href: string; label: string };
}) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-500">CCPun Control Plane</p>
      <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
      <section role="status" className="glass-card mt-6 p-5 md:p-6">
        <p className="text-sm font-semibold text-gold-400">{STATUS_LABELS[status]}</p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">{description}</p>
        <dl className="mt-4 text-sm text-white/60">
          <dt className="inline">แหล่งข้อมูล: </dt>
          <dd className="inline text-white/80">{source}</dd>
        </dl>
        {action ? <Link href={action.href} className="glass-button-sm mt-5 inline-flex items-center text-sm text-white">{action.label}</Link> : null}
      </section>
    </div>
  );
}
