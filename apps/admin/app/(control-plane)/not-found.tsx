import Link from "next/link";

export default function ControlPlaneNotFound() {
  return <section className="glass-card p-6 text-center"><p className="text-sm font-semibold text-gold-500">404 · CCPun Control Plane</p><h1 className="mt-2 text-2xl font-semibold">ไม่พบหน้าหลังบ้านนี้</h1><Link href="/dashboard/" className="gold-button mt-6 inline-flex min-h-11 items-center px-5 py-3 text-sm">กลับ Dashboard</Link></section>;
}
