import Link from "next/link";

export default function SocialSheetsExport() {
  return (
    <section aria-labelledby="social-sheets-export-title" className="mb-5 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="social-sheets-export-title" className="text-lg font-semibold">ส่งออก Social / SEO</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/65">
            ใช้ Export Center กลางเพื่อดาวน์โหลด CSV หรือสร้าง Google Sheet ผ่าน Agent OS + n8n โดยใช้ข้อมูล Social clean mart และ SEO Search Intelligence ชุดเดียวกับหน้า Admin
          </p>
        </div>
        <Link
          href="/analytics/exports/"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#9eebce] px-4 py-2.5 text-sm font-semibold text-[#101820] hover:bg-[#b6f3dc] focus:outline-none focus:ring-2 focus:ring-[#e0c985]"
        >
          เปิด Export Center
        </Link>
      </div>
      <p className="mt-3 text-xs leading-5 text-white/45">
        Google Sheet จะสร้างเป็นแท็บ “ภาพรวม” และ “ข้อมูล” พร้อม filter, header ค้าง และคอลัมน์ที่เอาไป pivot/วิเคราะห์ต่อได้
      </p>
    </section>
  );
}
