import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getSocialAnalyticsIngestionRuntimeStatus } from "@/lib/admin/social/analytics-ingestion";
import { getSocialOperationsRuntimeStatus } from "@/lib/admin/social/operations";
import { isSocialProviderExecutionGateEnabled } from "@/lib/admin/social/publishing";
import { getSocialProviderReadiness } from "@/lib/admin/social/provider-readonly";

export const metadata: Metadata = { title: "Social Connections" };

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
    accounts: "Facebook Page · Instagram account",
    description: "ตรวจ Page/Instagram, scopes, publishing readiness, analytics และ Instagram Audio capability โดยไม่แสดง credential",
  },
  youtube: {
    href: "/social/accounts/youtube/",
    title: "YouTube",
    accounts: "YouTube Channel · Shorts · Live",
    description: "Read-only analytics foundation เท่านั้น จนกว่าจะผ่าน UAT และมี write authorization contract ที่ชัดเจน",
  },
  tiktok: {
    href: "/social/accounts/tiktok/",
    title: "TikTok",
    accounts: "TikTok profile",
    description: "Read-only analytics foundation เท่านั้น ไม่มี Production write capability ในรอบนี้",
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
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">SOCIAL · CONNECTIONS</p>
      <h1 className="mt-2 text-3xl font-semibold">Connections</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
        มองตาม account และ capability ที่ใช้งานได้จริง แยก publishing, analytics และ token health โดยไม่ expose token หรือ secret
      </p>

      <section aria-label="Social provider accounts" className="mt-7 space-y-4">
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
                  Open connection
                </Link>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.08] p-3.5">
                  <div className="text-xs text-white/40">Connection</div>
                  <div className="mt-2"><StatePill ok={connected} good="Connected" bad="Reconnect / configure" /></div>
                </div>
                <div className="rounded-2xl border border-white/[0.08] p-3.5">
                  <div className="text-xs text-white/40">Publishing</div>
                  <div className="mt-2"><StatePill ok={publishingAvailable} good="Publishing available" bad={provider === "meta" ? "Publishing disabled" : "Read-only"} /></div>
                </div>
                <div className="rounded-2xl border border-white/[0.08] p-3.5">
                  <div className="text-xs text-white/40">Analytics</div>
                  <div className="mt-2"><StatePill ok={analyticsAvailable} good="Analytics available" bad="Analytics unavailable" /></div>
                </div>
                <div className="rounded-2xl border border-white/[0.08] p-3.5">
                  <div className="text-xs text-white/40">Token health</div>
                  <div className="mt-2"><StatePill ok={connected} good="Configured · validate on sync" bad="Reconnect required" /></div>
                </div>
              </div>

              {provider === "meta" ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/[0.08] p-3.5"><div className="text-xs text-white/40">Instagram Audio API</div><div className="mt-2 text-sm text-white/75">{audioAvailable ? "Available · revalidate per search/publish" : "Unavailable"}</div></div>
                  <div className="rounded-2xl border border-white/[0.08] p-3.5"><div className="text-xs text-white/40">Facebook Page</div><div className="mt-2 text-sm text-white/75">ตรวจ exact Page ใน Connection detail</div></div>
                  <div className="rounded-2xl border border-white/[0.08] p-3.5"><div className="text-xs text-white/40">Instagram account</div><div className="mt-2 text-sm text-white/75">discover/revalidate ก่อน API action</div></div>
                  <div className="rounded-2xl border border-white/[0.08] p-3.5"><div className="text-xs text-white/40">Last sync / success / error</div><div className="mt-2 text-sm text-white/75">แสดงผลใน Manual Sync session; ยังไม่สร้าง duplicate health store</div></div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.08] pt-4 text-xs leading-5 text-white/50 sm:flex-row sm:items-start sm:justify-between">
                <div><span className="text-white/35">Scopes:</span> {state.scopes.join(" · ")}</div>
                <div className={missing.length ? "text-amber-50/65" : "text-emerald-100/60"}>{missing.length ? `Missing/config invalid: ${missing.join(", ")}` : "Required configuration present"}</div>
              </div>
            </article>
          );
        })}
      </section>

      {runtime.environment === "production-admin" ? (
        <section role="status" className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white/65">
          YouTube และ TikTok ยังไม่เปิดใน Production Connections เพราะยังเป็น read-only UAT foundation และไม่มี write contract
        </section>
      ) : null}

      <section role="note" className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/[0.05] px-4 py-3 text-sm leading-6 text-amber-50/85">
        OAuth consent / re-authentication ต้องทำโดยเจ้าของบัญชีเอง ระบบไม่เก็บหรือแสดง raw provider token ใน UI/log และจะ fail closed เมื่อ capability ไม่ชัดเจน
      </section>
    </div>
  );
}
