import Link from "next/link";

export default function AdminNotFoundPage() {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-navy-900 px-5 py-16 text-white">
      <section className="glass-card w-full max-w-xl p-8 text-center md:p-10">
        <p className="text-sm font-semibold text-gold-500">404 · ศูนย์จัดการ CCPun</p>
        <h1 className="mt-3 text-3xl font-semibold">ไม่พบหน้าหลังบ้านนี้</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">ตรวจสอบลิงก์อีกครั้ง หรือกลับไปดูงานที่ต้องจัดการในหน้าภาพรวม</p>
        <Link href="/dashboard/" className="gold-button mt-7 inline-flex min-h-11 items-center justify-center px-6 py-3 text-sm">กลับหน้าภาพรวม</Link>
      </section>
    </main>
  );
}
