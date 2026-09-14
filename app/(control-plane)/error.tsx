"use client";

import Link from "next/link";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section role="alert" className="mx-auto max-w-2xl rounded-3xl border border-amber-200/20 bg-amber-200/10 p-6 text-amber-50">
      <h1 className="text-2xl font-semibold">หน้านี้ยังเปิดไม่สำเร็จ</h1>
      <p className="mt-3 text-sm leading-6 text-amber-50/80">ข้อมูลของคุณไม่ได้ถูกเผยแพร่หรือส่งไป Production ลองใหม่ได้อย่างปลอดภัย</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="min-h-11 rounded-xl bg-[#e0c985] px-4 py-2.5 text-sm font-semibold text-[#17191d]">ลองอีกครั้ง</button>
        <Link href="/dashboard/" className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80">กลับหน้าเริ่มต้น</Link>
      </div>
    </section>
  );
}
