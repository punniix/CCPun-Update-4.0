import Link from "next/link";

export default function ControlPlaneNotFound() {
  return <section className="glass-card p-6 text-center"><p className="text-sm font-semibold text-gold-500">ไม่พบหน้านี้</p><h1 className="mt-2 text-2xl font-semibold">หน้าที่ต้องการอาจย้ายไปแล้วหรือยังไม่เปิดให้ใช้</h1><Link href="/dashboard/" className="gold-button mt-6 inline-flex min-h-11 items-center px-5 py-3 text-sm">กลับหน้าภาพรวม</Link></section>;
}
