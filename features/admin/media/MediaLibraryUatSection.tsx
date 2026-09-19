import {
  getMediaStorageProviderState,
  mediaLibrarySnapshotSchema,
  SYNTHETIC_MEDIA_LIBRARY,
} from "@/lib/admin/media/foundation";

const kindLabel = {
  image: "รูปภาพ",
  video: "วิดีโอ",
  caption: "คำบรรยาย",
} as const;

const lifecycleLabel = {
  registered: "บันทึกรายละเอียดไฟล์แล้ว",
  ready: "พร้อมนำไปใช้",
  archived: "เก็บถาวร",
} as const;

const uploadStatusLabel = {
  blocked: "ยังเริ่มไม่ได้",
  requested: "รออนุญาต",
  authorized: "อนุญาตแล้ว",
  uploading: "กำลังอัปโหลด",
  uploaded: "อัปโหลดแล้ว",
  verified: "ตรวจไฟล์แล้ว",
  failed: "ไม่สำเร็จ",
  expired: "หมดเวลา",
  cancelled: "ยกเลิกแล้ว",
} as const;

function formatBytes(byteSize: number) {
  if (byteSize >= 1_000_000) return `${(byteSize / 1_000_000).toFixed(1)} MB`;
  return `${Math.ceil(byteSize / 1_000)} KB`;
}

function uploadStatusFor(assetId: string, sessions: Array<{ assetId: string; status: keyof typeof uploadStatusLabel }>) {
  const status = sessions.find((session) => session.assetId === assetId)?.status;
  return status ? uploadStatusLabel[status] : "ยังไม่เริ่ม";
}

export default function MediaLibraryUatSection() {
  const snapshot = mediaLibrarySnapshotSchema.parse(SYNTHETIC_MEDIA_LIBRARY);
  const storage = getMediaStorageProviderState();

  return (
    <section aria-labelledby="media-library-title">
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">พื้นที่ทดสอบ UAT · ใช้ข้อมูลตัวอย่าง</p>
      <h1 id="media-library-title" className="mt-2 text-3xl font-semibold">คลังสื่อและการอัปโหลดไฟล์</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
        หน้านี้ใช้ตรวจรายละเอียดไฟล์และขั้นตอนเตรียมอัปโหลดเท่านั้น เมื่อเลือกบริการจัดเก็บและอนุมัติแล้ว เบราว์เซอร์จะส่งไฟล์ตรงไปยังบริการนั้น
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-white/60">บริการจัดเก็บไฟล์</div>
          <div className="mt-2 font-semibold text-amber-200">{storage.status === "not-connected" ? "ยังไม่เชื่อม" : "พร้อมใช้งาน"}</div>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-white/60">รูปแบบอัปโหลด</div>
          <div className="mt-2 font-semibold">ส่งตรงไปยังบริการจัดเก็บ</div>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-white/60">การอัปโหลดจริง</div>
          <div className="mt-2 font-semibold text-amber-200">ปิดอยู่</div>
        </article>
      </div>

      <section aria-labelledby="drive-selected-file-title" className="mt-6 rounded-3xl border border-[#e0c985]/20 bg-[#e0c985]/[0.045] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold tracking-[0.1em] text-[#e0c985]">GOOGLE DRIVE · เฉพาะไฟล์ที่เลือก</div>
            <h2 id="drive-selected-file-title" className="mt-2 text-xl font-semibold">ไฟล์ที่เจ้าของเลือกจาก Drive</h2>
            <p className="mt-2 text-sm leading-6 text-white/65">
              ระบบใช้เฉพาะรายละเอียด ลิงก์เปิดไฟล์ และภาพตัวอย่างที่ Drive ส่งให้ โดยไม่อ่านเนื้อหา ดาวน์โหลดไฟล์ หรือเก็บสิทธิ์ระยะยาว
            </p>
          </div>
          <span className="rounded-full border border-amber-200/20 bg-amber-200/[0.06] px-3 py-1 text-xs text-amber-100">
            รอเจ้าของบัญชีเชื่อมต่อและเลือกไฟล์
          </span>
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-black/10 p-4">
          <div className="text-sm font-medium text-white/80">ยังไม่ได้เลือกไฟล์</div>
          <p role="status" className="mt-2 text-sm leading-6 text-white/60">
            ต้องตั้งค่าตัวเลือกไฟล์ของ Google และให้เจ้าของอนุญาตสิทธิ์เฉพาะไฟล์แบบชั่วคราวก่อน ปุ่มจึงยังปิดอยู่
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" disabled aria-disabled="true" className="cursor-not-allowed rounded-xl border border-white/10 px-4 py-2 text-sm text-white/40">
              เลือกไฟล์จาก Google Drive
            </button>
            <button type="button" disabled aria-disabled="true" className="cursor-not-allowed rounded-xl border border-white/10 px-4 py-2 text-sm text-white/40">
              อัปเดตรายละเอียดไฟล์
            </button>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {snapshot.assets.map((asset) => (
          <article key={asset.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold tracking-wide text-[#e0c985]">{kindLabel[asset.kind]}</div>
                <h2 className="mt-2 break-all font-semibold text-white/90">{asset.originalFilename}</h2>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/65">{lifecycleLabel[asset.lifecycleState]}</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-white/55">ชนิดไฟล์</dt><dd className="mt-1 text-white/75">{asset.mimeType}</dd></div>
              <div><dt className="text-white/55">ขนาด</dt><dd className="mt-1 text-white/75">{formatBytes(asset.byteSize)}</dd></div>
              <div><dt className="text-white/55">มิติ</dt><dd className="mt-1 text-white/75">{asset.widthPx} × {asset.heightPx}</dd></div>
              <div><dt className="text-white/55">สถานะการอัปโหลด</dt><dd className="mt-1 text-white/75">{uploadStatusFor(asset.id, snapshot.uploadSessions)}</dd></div>
            </dl>
          </article>
        ))}
      </div>

      <div role="note" className="mt-6 rounded-3xl border border-amber-200/20 bg-amber-200/[0.05] p-5 text-sm leading-6 text-amber-50/80">
        ระบบจะไม่สร้างลิงก์อัปโหลดจนกว่าจะเลือกบริการจัดเก็บ อนุมัติค่าใช้จ่าย ตั้งค่าการเชื่อมต่อพื้นที่ทดสอบ และผ่านการตรวจความปลอดภัย รอบนี้ยังไม่มีการส่งไฟล์จริง
      </div>
    </section>
  );
}
