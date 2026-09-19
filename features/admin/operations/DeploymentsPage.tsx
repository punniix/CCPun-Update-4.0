import { headers } from "next/headers";
import { readAdminDeployments, type DeploymentHistoryItem } from "@/lib/admin/operations/deployment-read-model";
import { requireAdminPermission } from "@/lib/admin/require-permission";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function StatusBadge({ state }: { state: string }) {
  const good = state === "success";
  const pending = ["queued", "pending", "in_progress"].includes(state);
  const label = good ? "สำเร็จ" : pending ? "กำลังเตรียม" : state === "failure" || state === "error" ? "ไม่สำเร็จ" : "ต้องตรวจ";
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${good ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : pending ? "border-amber-200/20 bg-amber-200/10 text-amber-50" : "border-white/10 bg-white/[0.04] text-white/65"}`}>{label}</span>;
}

function DeploymentRow({ item }: { item: DeploymentHistoryItem }) {
  return (
    <tr className="border-t border-white/10 align-top">
      <td className="px-4 py-4"><div className="font-mono text-xs text-white/85">{item.sha.slice(0, 12)}</div>{item.isCurrentSha ? <div className="mt-1 text-xs text-[#e0c985]">กำลังรันบน Admin ตอนนี้</div> : null}</td>
      <td className="px-4 py-4"><StatusBadge state={item.state} /></td>
      <td className="px-4 py-4 text-sm text-white/65">{item.ref}</td>
      <td className="px-4 py-4 text-sm text-white/65">{formatDate(item.createdAt)}</td>
      <td className="px-4 py-4 text-sm text-white/55">#{item.id}</td>
    </tr>
  );
}

export default async function AdminDeploymentsPage() {
  await requireAdminPermission("settings:read");
  const requestHeaders = await headers();
  const model = await readAdminDeployments(requestHeaders.get("host"));
  const exact = model.exactShaProduction;
  const healthy = model.status === "ready";

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">สำหรับตรวจสถานะระบบ</p>
      <h1 className="mt-2 text-3xl font-semibold">เวอร์ชันที่ใช้งาน</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">ตรวจว่า admin.ccpun.com กำลังใช้โค้ดเวอร์ชันที่ผ่านการนำขึ้นระบบจริงแล้ว โดยไม่เก็บรหัสเข้าถึง Vercel ไว้ใน Admin</p>

      <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-white/55">ระบบจริงที่กำลังใช้งาน</p><h2 className="mt-1 text-xl font-semibold">{healthy ? "ตรงกับเวอร์ชันที่นำขึ้นระบบแล้ว" : "ต้องตรวจเพิ่มเติม"}</h2></div><StatusBadge state={healthy ? "success" : model.status} /></div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div><dt className="text-xs text-white/45">เว็บไซต์</dt><dd className="mt-1 break-all text-sm text-white/85">{model.requestHost ?? "—"}</dd></div>
          <div><dt className="text-xs text-white/45">สายงานที่ใช้</dt><dd className="mt-1 text-sm text-white/85">{model.gitBranch ?? "—"}</dd></div>
          <div><dt className="text-xs text-white/45">รหัสเวอร์ชัน</dt><dd className="mt-1 break-all font-mono text-xs text-white/85">{model.gitSha ?? "—"}</dd></div>
          <div><dt className="text-xs text-white/45">พื้นที่ให้บริการ</dt><dd className="mt-1 text-sm text-white/85">{model.region ?? "—"}</dd></div>
        </dl>
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm leading-6 text-white/65">
          {exact ? <>พบหลักฐานว่าเวอร์ชันนี้นำขึ้น Admin ระบบจริงสำเร็จเมื่อ {formatDate(exact.createdAt)} <span className="text-white/45">(รายการ #{exact.id})</span></> : <>ยังยืนยันเวอร์ชันปัจจุบันกับประวัติการนำขึ้นระบบจริงไม่ได้ ระบบจึงไม่สรุปเองว่าเป็นเวอร์ชันล่าสุด{model.error ? " กรุณาให้ทีมเทคนิคตรวจรายละเอียด" : ""}</>}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">ประวัติการนำขึ้นระบบจริง</h2><p className="mt-1 text-sm text-white/55">อ่านจากประวัติที่ GitHub และ Vercel บันทึกไว้ โดยเทียบรหัสเวอร์ชันจริงทุกครั้ง</p></div><p className="text-xs text-white/40">{model.source}</p></div>
        {model.history.length ? <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-[760px] w-full text-left"><thead className="bg-black/15 text-xs text-white/45"><tr><th className="px-4 py-3">รหัสเวอร์ชัน</th><th className="px-4 py-3">ผล</th><th className="px-4 py-3">สายงาน</th><th className="px-4 py-3">เวลา</th><th className="px-4 py-3">เลขรายการ</th></tr></thead><tbody>{model.history.map((item) => <DeploymentRow key={item.id} item={item} />)}</tbody></table></div> : <p className="mt-5 rounded-2xl border border-white/10 p-4 text-sm text-white/60">ยังอ่านประวัติการนำ Admin ขึ้นระบบจริงไม่ได้ แต่ข้อมูลเวอร์ชันด้านบนยังมาจากระบบที่กำลังทำงานโดยตรง</p>}
      </section>
    </div>
  );
}
