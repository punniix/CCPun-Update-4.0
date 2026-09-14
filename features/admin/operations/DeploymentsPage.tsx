import { headers } from "next/headers";
import { readAdminDeployments, type DeploymentHistoryItem } from "@/lib/admin/operations/deployment-read-model";
import { requireAdminPermission } from "@/lib/admin/require-permission";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function StatusBadge({ state }: { state: string }) {
  const good = state === "success";
  const pending = ["queued", "pending", "in_progress"].includes(state);
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${good ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : pending ? "border-amber-200/20 bg-amber-200/10 text-amber-50" : "border-white/10 bg-white/[0.04] text-white/65"}`}>{state}</span>;
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
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">OWNER DIAGNOSTICS</p>
      <h1 className="mt-2 text-3xl font-semibold">Deployments</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">ยืนยัน deployment ที่กำลังตอบ `admin.ccpun.com` ด้วย Vercel system environment และ cross-check source SHA กับ GitHub deployment metadata โดยไม่ต้องเก็บ Vercel API token ใน Admin</p>

      <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-white/55">Active Production</p><h2 className="mt-1 text-xl font-semibold">{healthy ? "ตรงกับ source SHA ที่ถูก promote" : "ต้องตรวจเพิ่มเติม"}</h2></div><StatusBadge state={healthy ? "success" : model.status} /></div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div><dt className="text-xs text-white/45">Request host</dt><dd className="mt-1 break-all text-sm text-white/85">{model.requestHost ?? "—"}</dd></div>
          <div><dt className="text-xs text-white/45">Git branch</dt><dd className="mt-1 text-sm text-white/85">{model.gitBranch ?? "—"}</dd></div>
          <div><dt className="text-xs text-white/45">Source SHA</dt><dd className="mt-1 break-all font-mono text-xs text-white/85">{model.gitSha ?? "—"}</dd></div>
          <div><dt className="text-xs text-white/45">Vercel region</dt><dd className="mt-1 text-sm text-white/85">{model.region ?? "—"}</dd></div>
        </dl>
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm leading-6 text-white/65">
          {exact ? <>GitHub มี Production Admin deployment <strong className="text-white">#{exact.id}</strong> ที่สำเร็จสำหรับ SHA เดียวกับ runtime นี้เมื่อ {formatDate(exact.createdAt)}.</> : <>ยัง cross-check SHA ปัจจุบันกับ Production deployment metadata ไม่สำเร็จ ระบบจึงไม่เดาว่า deployment ล่าสุดคือ Production{model.error ? ` · ${model.error}` : ""}</>}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Production Admin history</h2><p className="mt-1 text-sm text-white/55">อ่านจาก GitHub deployment records ที่ Vercel เขียนไว้ ไม่ใช้ branch alias เป็นหลักฐานแทน SHA</p></div><p className="text-xs text-white/40">{model.source}</p></div>
        {model.history.length ? <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10"><table className="min-w-[760px] w-full text-left"><thead className="bg-black/15 text-xs text-white/45"><tr><th className="px-4 py-3">SHA</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Ref</th><th className="px-4 py-3">เวลา</th><th className="px-4 py-3">Deployment</th></tr></thead><tbody>{model.history.map((item) => <DeploymentRow key={item.id} item={item} />)}</tbody></table></div> : <p className="mt-5 rounded-2xl border border-white/10 p-4 text-sm text-white/60">ยังอ่านประวัติ Production Admin deployment ไม่ได้ แต่ runtime identity ด้านบนยังมาจาก deployment ปัจจุบันโดยตรง</p>}
      </section>
    </div>
  );
}
