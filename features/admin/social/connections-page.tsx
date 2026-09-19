import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getSocialAnalyticsIngestionRuntimeStatus } from "@/lib/admin/social/analytics-ingestion";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { isSocialProviderExecutionGateEnabled } from "@/lib/admin/social/publishing";
import { getSocialProviderReadiness } from "@/lib/admin/social/provider-readonly";

export const metadata: Metadata = { title: "บัญชีโซเชียลที่เชื่อมต่อ" };

type ProviderName = "meta" | "youtube" | "tiktok";

const providerDetails: Record<ProviderName, {
  href: string;
  title: string;
  accounts: string;
  description: string;
}> = {
  meta: {
    href: "/social/accounts/meta/",
    title: "Meta",
    accounts: "Facebook Page · บัญชี Instagram",
    description: "ตรวจการเชื่อมต่อ ความพร้อมในการส่งโพสต์ ดูผลลัพธ์ และใช้เพลง Instagram โดยไม่แสดงรหัสลับ",
  },
  youtube: {
    href: "/social/accounts/youtube/",
    title: "YouTube",
    accounts: "YouTube Channel · Shorts · Live",
    description: "ขณะนี้อ่านผลลัพธ์ได้อย่างเดียว จนกว่าจะผ่านการทดสอบและกำหนดสิทธิ์การแก้ไขอย่างชัดเจน",
  },
  tiktok: {
    href: "/social/accounts/tiktok/",
    title: "TikTok",
    accounts: "TikTok profile",
    description: "ขณะนี้อ่านผลลัพธ์ได้อย่างเดียว และยังไม่ส่งหรือแก้โพสต์บนระบบจริง",
  },
};

function StatePill({ ok, good, bad }: { ok: boolean; good: string; bad: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${ok ? "border-emerald-200/20 bg-emerald-200/[0.06] text-emerald-100/85" : "border-amber-200/20 bg-amber-200/[0.05] text-amber-50/80"}`}>
      {ok ? good : bad}
    </span>
  );
}

export default async function SocialConnectionsPage() {
  await requireAdminPermission("social:read");
  const runtime = getSocialOperationsRuntimeStatus();
  if (!runtime.enabled) notFound();

  const providers: ProviderName[] = runtime.environment === "admin-uat" ? ["meta", "youtube", "tiktok"] : ["meta"];
  const readiness = Object.fromEntries(providers.map((provider) => [provider, getSocialProviderReadiness(provider)])) as Record<ProviderName, ReturnType<typeof getSocialProviderReadiness>>;
  const providerWriteEnabled = isSocialProviderExecutionGateEnabled();
  const analyticsEnabled = getSocialAnalyticsIngestionRuntimeStatus().enabled;

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">โซเชียล</p>
      <h1 className="mt-2 text-3xl font-semibold">บัญชีที่เชื่อมต่อ</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
        ดูว่าบัญชีใดเชื่อมต่ออยู่ อ่านผลลัพธ์ได้หรือไม่ และส่งโพสต์ได้หรือยัง โดยไม่แสดงรหัสลับของบัญชี
      </p>

      <section aria-label="บัญชีโซเชียลที่เชื่อมต่อ" className="mt-7 space-y-4">
        {providers.map((provider) => {
          const detail = providerDetails[provider];
          const state = readiness[provider];
          const connected = state.status === "manual-sync-ready";
          const publishingAvailable = provider === "meta" && providerWriteEnabled;
          const analyticsAvailable = analyticsEnabled && connected;
          const audioAvailable = provider === "meta" && connected;
          const missing = state.required.filter((item) => !item.valid).map((item) => item.name);

          return (
            <article key={provider} className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold tracking-[0.1em] text-[#e0c985]">{detail.accounts}</div>
                  <h2 className="mt-2 text-xl font-semibold">{detail.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">{detail.description}</p>
                </div>
                <Link href={detail.href} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/85 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]">
                  เปิดรายละเอียด
                </Link>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.08] p-3.5">
                  <div className="text-xs text-white/40">การเชื่อมต่อ</div>
                  <div className="mt-2"><StatePill ok={connected} good="เชื่อมต่อแล้ว" bad="ต้องเชื่อมต่อหรือตั้งค่าเพิ่ม" /></div>
                </div>
                <div className="rounded-2xl border border-white/[0.08] p-3.5">
                  <div className="text-xs text-white/40">การส่งโพสต์</div>
                  <div className="mt-2"><StatePill ok={publishingAvailable} good="พร้อมหลังอนุมัติ" bad={provider === "meta" ? "ยังปิดอยู่" : "อ่านข้อมูลได้อย่างเดียว"} /></div>
                </div>
                <div className="rounded-2xl border border-white/[0.08] p-3.5">
                  <div className="text-xs text-white/40">ผลลัพธ์</div>
                  <div className="mt-2"><StatePill ok={analyticsAvailable} good="อ่านได้" bad="ยังอ่านไม่ได้" /></div>
                </div>
                <div className="rounded-2xl border border-white/[0.08] p-3.5">
                  <div className="text-xs text-white/40">สิทธิ์ของบัญชี</div>
                  <div className="mt-2"><StatePill ok={connected} good="ตั้งค่าแล้ว · ตรวจอีกครั้งเมื่อดึงข้อมูล" bad="ต้องเชื่อมต่อใหม่" /></div>
                </div>
              </div>

              {provider === "meta" ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/[0.08] p-3.5"><div className="text-xs text-white/40">เพลงใน Instagram</div><div className="mt-2 text-sm text-white/75">{audioAvailable ? "พร้อมค้นหา และจะตรวจสิทธิ์อีกครั้งก่อนใช้" : "ยังใช้ไม่ได้"}</div></div>
                  <div className="rounded-2xl border border-white/[0.08] p-3.5"><div className="text-xs text-white/40">Facebook Page</div><div className="mt-2 text-sm text-white/75">เปิดรายละเอียดเพื่อยืนยันเพจที่เลือก</div></div>
                  <div className="rounded-2xl border border-white/[0.08] p-3.5"><div className="text-xs text-white/40">บัญชี Instagram</div><div className="mt-2 text-sm text-white/75">ระบบจะตรวจบัญชีอีกครั้งก่อนทำรายการ</div></div>
                  <div className="rounded-2xl border border-white/[0.08] p-3.5"><div className="text-xs text-white/40">การดึงข้อมูลล่าสุด</div><div className="mt-2 text-sm text-white/75">แสดงผลหลังคุณกดดึงข้อมูลจากแพลตฟอร์ม</div></div>
                </div>
              ) : null}

              <details className="mt-4 border-t border-white/[0.08] pt-4 text-xs leading-5 text-white/50"><summary className="cursor-pointer text-white/65">ดูรายละเอียดสิทธิ์สำหรับทีมเทคนิค</summary><div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><span className="text-white/35">รหัสสิทธิ์:</span> {state.scopes.join(" · ")}</div><div className={missing.length ? "text-amber-50/65" : "text-emerald-100/60"}>{missing.length ? `ตั้งค่าไม่ครบ: ${missing.join(", ")}` : "ตั้งค่าที่จำเป็นครบแล้ว"}</div></div></details>
            </article>
          );
        })}
      </section>

      {runtime.environment === "production-admin" ? (
        <section role="status" className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white/65">
          YouTube และ TikTok ยังไม่เปิดในระบบจริง เพราะยังอยู่ระหว่างทดสอบแบบอ่านข้อมูลอย่างเดียวและยังไม่อนุญาตให้ส่งหรือแก้โพสต์
        </section>
      ) : null}

      <section role="note" className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/[0.05] px-4 py-3 text-sm leading-6 text-amber-50/85">
        การอนุญาตหรือเชื่อมต่อบัญชีใหม่ต้องทำโดยเจ้าของบัญชีเอง ระบบไม่เก็บหรือแสดงรหัสลับบนหน้าจอหรือในประวัติ และจะหยุดไว้หากยืนยันสิทธิ์ไม่ได้
      </section>
    </div>
  );
}
