import type { Metadata } from "next";
import ResearchSnapshotForm from "@/features/admin/components/ResearchSnapshotForm";
import SyncUbersuggestButton from "@/features/admin/components/SyncUbersuggestButton";
import UbersuggestResearchForm from "@/features/admin/components/UbersuggestResearchForm";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { getResearchProviderStatus, isResearchWriteReady, listResearchSnapshots } from "@/lib/admin/research";
import { normalizeResearchKeyword, researchOpportunityScore } from "@/lib/admin/research-input";
import { listAdminArticles } from "@/lib/admin/sanity-control";
import { getUbersuggestConnectionStatus } from "@/lib/admin/ubersuggest";
import {
  getUbersuggestDashboardData,
  isSnapshotFresh,
  isUbersuggestSyncWriteReady,
} from "@/lib/admin/ubersuggest-dashboard";

export const metadata: Metadata = { title: "ข้อมูลประกอบการวางแผนเนื้อหา" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function quotaClass(status: "available" | "near-limit" | "full") {
  if (status === "full") return "border-red-300/20 bg-red-300/[0.06] text-red-100";
  if (status === "near-limit") return "border-amber-300/20 bg-amber-300/[0.06] text-amber-100";
  return "border-emerald-300/20 bg-emerald-300/[0.05] text-emerald-100";
}

function providerLabel(value: string) {
  if (value === "openai") return "OpenAI";
  if (value === "gemini") return "Gemini";
  if (value === "google_aio") return "Google AI Overviews";
  return value;
}

function actionLabel(covered: boolean, opportunity: number | null) {
  if (covered) return "มีบทความรองรับ";
  if (opportunity != null && opportunity >= 70) return "ยังขาดบทความ · โอกาสสูง";
  return "ยังขาดบทความ";
}

export default async function AdminResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const identity = await requireAdminPermission("research:read");
  const [research, articles, ubersuggest, dashboard, params] = await Promise.all([
    listResearchSnapshots(),
    listAdminArticles(),
    getUbersuggestConnectionStatus(),
    getUbersuggestDashboardData(30),
    searchParams,
  ]);

  const environment = getAdminEnvironment();
  const productionSnapshotMode = environment === "production-admin";
  const localProviderLane = ["development", "local-uat", "local-production"].includes(environment);
  const snapshotReady = Boolean(dashboard.account || dashboard.geo);
  const writeReady = isResearchWriteReady();
  const canQueryProvider = hasAdminPermission(identity.role, "research:provider-query");
  const canSync = localProviderLane
    && ubersuggest.connected
    && isUbersuggestSyncWriteReady()
    && canQueryProvider;

  const providers = getResearchProviderStatus(ubersuggest.connected).map((provider) => {
    if (provider.id !== "ubersuggest" || !productionSnapshotMode) return provider;
    return {
      ...provider,
      connected: snapshotReady,
      mode: "sanity-snapshot",
      detail: snapshotReady
        ? "ระบบจริงอ่านข้อมูลคำค้นและการมองเห็นที่เตรียมไว้จาก Sanity โดยไม่เก็บสิทธิ์เชื่อมต่อ Ubersuggest ไว้บนเว็บ"
        : "ระบบจริงยังไม่มีข้อมูล Ubersuggest รอบล่าสุด กรุณาดึงข้อมูลจากเครื่องภายในที่เชื่อมต่อไว้ก่อน",
    };
  });

  const coveredKeywords = new Set(
    articles.rows
      .flatMap((article) => [article.primaryKeyword, ...(article.secondaryKeywords ?? [])])
      .filter((value): value is string => Boolean(value))
      .map(normalizeResearchKeyword),
  );

  const rows = research.rows.map((snapshot) => ({
    ...snapshot,
    covered: coveredKeywords.has(normalizeResearchKeyword(snapshot.keyword)),
    opportunity: researchOpportunityScore(snapshot.volume, snapshot.difficulty),
  }));
  const gaps = rows.filter((row) => !row.covered);
  const topOpportunity = gaps
    .filter((row) => row.opportunity != null)
    .sort((a, b) => (b.opportunity ?? 0) - (a.opportunity ?? 0))[0];

  const account = dashboard.account;
  const geo = dashboard.geo;
  const accountFresh = isSnapshotFresh(account?.checkedAt, 24);
  const geoFresh = isSnapshotFresh(geo?.checkedAt, 35 * 24);
  const promptGaps = [...(geo?.prompts ?? [])]
    .filter((prompt) => prompt.userVisibilityPercentage === 0)
    .sort((a, b) => b.totalAnswers - a.totalAnswers);

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ข้อมูลประกอบสำหรับ SEO และ AI Search</p>
      <h1 className="mt-2 text-3xl font-semibold">ค้นคว้าและตัดสินใจ</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
        รวมข้อมูลคำค้น จำนวนครั้งที่ยังใช้ Ubersuggest ได้ บทความที่มีอยู่ และหัวข้อที่ CCPun ยังไม่ปรากฏในคำตอบของ AI ข้อมูลเหล่านี้ใช้ประกอบการตัดสินใจเท่านั้น ระบบจะไม่แก้เนื้อหาให้อัตโนมัติ
      </p>

      <nav aria-label="ขั้นตอนค้นคว้าและตัดสินใจ" className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["#capture", "1 · เก็บข้อมูล"],
          ["#coverage", "2 · เทียบกับบทความ"],
          ["#ubersuggest-intelligence", "3 · Ubersuggest"],
          ["#geo-aeo", "4 · GEO / AEO"],
          ["#history", "5 · ประวัติ"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="inline-flex min-h-11 items-center rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-sm text-white/70 transition hover:border-[#e0c985]/30 hover:text-[#f4df9b]">
            {label}
          </a>
        ))}
      </nav>

      {params.provider === "connected" ? (
        <aside role="status" className="mt-6 rounded-2xl border border-emerald-200/20 bg-emerald-200/10 p-4 text-sm leading-6 text-emerald-50">
          เชื่อมต่อ Ubersuggest แล้ว คุณเริ่มค้นคำและบันทึกชุดข้อมูลล่าสุดได้
        </aside>
      ) : null}
      {params.provider === "error" ? (
        <aside role="alert" className="mt-6 rounded-2xl border border-red-200/20 bg-red-200/10 p-4 text-sm leading-6 text-red-50">
          {productionSnapshotMode
            ? "ระบบจริงไม่เชื่อม Ubersuggest โดยตรง เพื่อไม่เก็บสิทธิ์ระยะยาวไว้บนเว็บ แต่ยังอ่านข้อมูลที่ดึงไว้แล้วได้ตามปกติ"
            : "เชื่อมต่อ Ubersuggest ไม่สำเร็จ ระบบไม่ได้บันทึกข้อมูลหรือแสดงผลลัพธ์ปลอม กรุณาลองใหม่"}
        </aside>
      ) : null}
      {research.error ? (
        <section role="alert" className="mt-6 rounded-2xl border border-red-200/20 bg-red-200/10 p-4 text-sm leading-6 text-red-50">
          ยังอ่านข้อมูลงานวิจัยไม่ได้ ระบบหยุดไว้โดยไม่แสดงยอด 0 และไม่สลับไปใช้ชุดข้อมูลอื่น
        </section>
      ) : null}
      {dashboard.error ? (
        <section role="alert" className="mt-6 rounded-2xl border border-red-200/20 bg-red-200/10 p-4 text-sm leading-6 text-red-50">
          ยังอ่านข้อมูลล่าสุดจาก Ubersuggest ไม่สำเร็จ ระบบจะไม่แทนด้วยเลข 0 หรือข้อมูลเดา
        </section>
      ) : null}

      <section className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="สถานะแหล่งข้อมูล">
        {providers.map((provider) => {
          const ubersuggestSnapshot = provider.id === "ubersuggest" && productionSnapshotMode;
          const statusLabel = ubersuggestSnapshot
            ? provider.connected
              ? "ข้อมูลล่าสุดพร้อมใช้"
              : "ยังไม่มีข้อมูลล่าสุด"
            : provider.connected
              ? "พร้อมนำเข้าข้อมูล"
              : "ยังไม่เชื่อมต่อ";
          return (
            <article key={provider.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">{provider.label}</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs ${provider.connected ? "bg-emerald-300/10 text-emerald-200" : "bg-white/5 text-white/60"}`}>
                  {statusLabel}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/65">{provider.detail}</p>
            </article>
          );
        })}
      </section>

      <section id="capture" className="scroll-mt-6 mt-6 rounded-3xl border border-[#e0c985]/20 bg-[#e0c985]/[0.045] p-5 md:p-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ขั้นที่ 1</p>
          <h2 className="mt-2 text-xl font-semibold">เก็บข้อมูลให้มีหลักฐานก่อนตัดสินใจ</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
            บนระบบจริงให้ใช้ข้อมูลที่ดึงและตรวจไว้แล้ว หรือเพิ่มข้อมูลที่คุณตรวจสอบเอง ส่วนเครื่องภายในที่ได้รับสิทธิ์สามารถค้น Ubersuggest และบันทึกข้อมูลล่าสุดได้
          </p>
        </div>
        {canQueryProvider && !productionSnapshotMode ? (
          <div className="mt-5"><UbersuggestResearchForm connected={ubersuggest.connected} writeReady={writeReady} /></div>
        ) : null}
        {!research.error && writeReady && hasAdminPermission(identity.role, "research:create") ? (
          <div className="mt-5"><ResearchSnapshotForm /></div>
        ) : null}
      </section>

      {!research.error ? (
        <section id="coverage" className="scroll-mt-6 mt-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ขั้นที่ 2</p>
            <h2 className="mt-2 text-xl font-semibold">เทียบข้อมูลกับบทความ CCPun</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">ตรวจว่าคำค้นที่มีหลักฐานมีบทความหลักหรือบทความรองรับอยู่แล้วหรือไม่ ก่อนสร้างบทความใหม่</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="text-sm text-white/60">ข้อมูลค้นคว้าทั้งหมด</div><div className="mt-2 text-xl font-semibold">{rows.length}</div></article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="text-sm text-white/60">หัวข้อที่ยังขาด</div><div className="mt-2 text-xl font-semibold text-amber-300">{gaps.length}</div></article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="text-sm text-white/60">มีบทความรองรับ</div><div className="mt-2 text-xl font-semibold text-emerald-300">{rows.length - gaps.length}</div></article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="text-sm text-white/60">โอกาสภายในสูงสุด</div><div className="mt-2 text-sm font-semibold text-white/80">{topOpportunity ? `${topOpportunity.keyword} · ${topOpportunity.opportunity}/100` : "—"}</div></article>
          </div>
        </section>
      ) : null}

      <section id="ubersuggest-intelligence" className="scroll-mt-6 mt-6 rounded-3xl border border-sky-200/15 bg-sky-200/[0.035] p-5 md:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-sky-200">ขั้นที่ 3 · Ubersuggest</p>
            <h2 className="mt-2 text-xl font-semibold">ข้อมูล Ubersuggest และขีดจำกัดบัญชี</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">อ่านจำนวนที่ใช้และเหลือจากบัญชีจริง และไม่ดึงข้อมูลซ้ำเมื่อชุดล่าสุดยังใหม่พอ</p>
          </div>
          {canSync ? <SyncUbersuggestButton /> : null}
        </div>

        {!localProviderLane ? (
          <p className="mt-4 rounded-xl border border-sky-200/10 bg-black/10 p-3 text-sm leading-6 text-sky-100/75">
            หน้านี้อ่านข้อมูลที่บันทึกไว้ใน Sanity เท่านั้น การดึงข้อมูลใหม่ทำจากเครื่องภายในที่เชื่อม Ubersuggest แล้ว เพื่อไม่เก็บสิทธิ์ระยะยาวไว้บนเว็บ
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="text-sm text-white/50">แพ็กเกจ Ubersuggest</div><div className="mt-2 text-lg font-semibold">{account?.tier ?? "ยังไม่มีข้อมูล"}</div><p className="mt-1 text-xs text-white/45">{account ? `${account.domain} · ${accountFresh ? "ข้อมูลเป็นปัจจุบัน" : "ควรดึงข้อมูลใหม่"}` : ""}</p></article>
          <article className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="text-sm text-white/50">การปรากฏในคำตอบ AI</div><div className="mt-2 text-2xl font-semibold">{geo ? `${geo.visibilityPercentage}%` : "—"}</div><p className="mt-1 text-xs text-white/45">{geo ? `ถูกกล่าวถึง ${geo.totalMentions} ครั้ง` : ""}</p></article>
          <article className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="text-sm text-white/50">สัดส่วนการถูกกล่าวถึง</div><div className="mt-2 text-2xl font-semibold">{geo ? geo.shareOfVoice : "—"}</div><p className="mt-1 text-xs text-white/45">ข้อมูลจาก Ubersuggest</p></article>
          <article className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="text-sm text-white/50">คำถามที่ยังไม่พบ CCPun</div><div className="mt-2 text-2xl font-semibold text-amber-200">{geo ? promptGaps.length : "—"}</div><p className="mt-1 text-xs text-white/45">CCPun ยังไม่ปรากฏในคำตอบ</p></article>
        </div>

        {account?.quotas.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {account.quotas.map((item) => (
              <article key={item.key} className={`rounded-2xl border p-4 ${quotaClass(item.status)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="font-medium">{item.label}</h3><p className="mt-1 text-sm opacity-70">เหลือ {item.remaining}</p></div>
                  <div className="text-right text-lg font-semibold">{item.used} / {item.limit}</div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-current/50" style={{ width: `${Math.min(100, item.limit ? (item.used / item.limit) * 100 : 100)}%` }} /></div>
              </article>
            ))}
          </div>
        ) : <p className="mt-5 text-sm text-white/55">ยังไม่มีข้อมูลขีดจำกัดล่าสุดจาก Ubersuggest</p>}
        {account ? <p className="mt-4 text-xs text-white/45">ดึงข้อมูลล่าสุด {formatDate(account.checkedAt)}</p> : null}
      </section>

      <section id="geo-aeo" className="scroll-mt-6 mt-6 rounded-3xl border border-violet-200/15 bg-violet-200/[0.035] p-5 md:p-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-violet-200">ขั้นที่ 4</p>
          <h2 className="mt-2 text-xl font-semibold">การมองเห็นบน AI Search</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">ใช้คำถาม แหล่งคำตอบ คู่แข่ง และเป้าหมายการค้นหาจาก Ubersuggest เพื่อหาหัวข้อที่ CCPun ยังไม่ถูกกล่าวถึงและควรนำกลับไปปรับบทความ</p>
        </div>

        {geo ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="text-sm text-white/50">คำตอบจาก AI ที่ตรวจ</div><div className="mt-2 text-xl font-semibold">{geo.totalAnswers}</div></article>
              <article className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="text-sm text-white/50">คำถามที่ติดตาม</div><div className="mt-2 text-xl font-semibold">{geo.totalPrompts}</div></article>
              <article className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="text-sm text-white/50">คู่แข่งที่พบ</div><div className="mt-2 text-xl font-semibold">{geo.totalCompetitors}</div></article>
              <article className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="text-sm text-white/50">อันดับเฉลี่ยในคำตอบ AI</div><div className="mt-2 text-xl font-semibold">{geo.averageRank ?? "—"}</div></article>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <h3 className="font-medium">ผลแยกตามบริการ AI</h3>
                <div className="mt-3 space-y-2">
                  {geo.providers.map((provider) => (
                    <div key={provider.provider} className="flex flex-col gap-1 rounded-xl bg-white/[0.03] px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span>{providerLabel(provider.provider)}</span>
                      <span className="text-white/60">ปรากฏ {provider.visibilityPercentage}% · กล่าวถึง {provider.totalMentions} ครั้ง · อันดับ {provider.averageRank ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </article>
              <article className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <h3 className="font-medium">เป้าหมายของคำถามที่ส่งให้ AI</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {geo.intents.map((item) => <span key={item.intent} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/65">{item.intent}: {item.value}</span>)}
                </div>
              </article>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/10">
              <div className="border-b border-white/10 px-4 py-3"><h3 className="font-medium">คำถามที่ยังไม่พบ CCPun</h3><p className="mt-1 text-sm leading-6 text-white/55">เรียงคำถามที่ยังไม่กล่าวถึง CCPun โดยให้คำถามที่พบคำตอบมากกว่าอยู่ก่อน</p></div>
              {promptGaps.length ? (
                <div className="divide-y divide-white/5">
                  {promptGaps.map((prompt) => (
                    <article key={prompt.promptText} className="p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div><div className="flex flex-wrap gap-2 text-xs text-white/50">{prompt.topic ? <span>{prompt.topic}</span> : null}<span>{prompt.intents.join(" / ") || "ไม่ระบุเป้าหมาย"}</span><span>พบคำตอบ {prompt.totalAnswers} รายการ</span></div><h4 className="mt-2 font-medium text-white/85">{prompt.promptText}</h4><p className="mt-2 text-sm leading-6 text-white/55">แบรนด์ที่พบมาก: {prompt.topBrands.length ? prompt.topBrands.join(", ") : "ยังไม่พบแบรนด์เด่น"}</p></div>
                        <span className="w-fit rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-100">ยังไม่พบ CCPun</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : <div className="p-5 text-sm text-white/55">ข้อมูลรอบล่าสุดยังไม่พบคำถามที่ขาด หรือยังไม่ได้ดึงข้อมูลการมองเห็นชุดใหม่</div>}
            </div>
            <p className="mt-4 text-xs text-white/45">ช่วงข้อมูล {geo.windowStart} → {geo.windowEnd} · {geoFresh ? "ข้อมูลเป็นปัจจุบัน" : "ควรดึงข้อมูลใหม่"}</p>
          </>
        ) : <p className="mt-4 text-sm text-white/55">ยังไม่มีข้อมูล GEO/AEO</p>}
      </section>

      {!research.error ? (
        <section id="history" className="scroll-mt-6 mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">ขั้นที่ 5</p>
            <h2 className="mt-2 font-semibold">ประวัติข้อมูลและสถานะการตัดสินใจ</h2>
            <p className="mt-1 text-sm leading-6 text-white/65">รวมข้อมูลที่กรอกเองและจาก Ubersuggest ในตารางเดียว พร้อมสถานะบทความรองรับและคะแนนโอกาสภายใน</p>
          </div>
          {rows.length ? (
            <>
              <p className="px-5 pt-4 text-sm text-white/60 md:hidden">เลื่อนตารางไปทางซ้ายหรือขวาเพื่อดูข้อมูลทั้งหมด</p>
              <div role="region" aria-label="ตารางข้อมูลประกอบการตัดสินใจ" tabIndex={0} className="overflow-x-auto">
                <table className="w-full min-w-[1280px] text-left text-sm">
                  <thead className="border-b border-white/10 bg-white/[0.03] text-xs tracking-wide text-white/55">
                    <tr><th className="px-5 py-4">คำค้น</th><th className="px-4 py-4">สถานะ</th><th className="px-4 py-4">คะแนนโอกาส</th><th className="px-4 py-4">แหล่งข้อมูล</th><th className="px-4 py-4">ขอบเขต</th><th className="px-4 py-4">จำนวนค้นหา</th><th className="px-4 py-4">ความยาก</th><th className="px-4 py-4">เป้าหมายการค้นหา</th><th className="px-4 py-4">จำนวนผลค้นหา</th><th className="px-5 py-4">ดึงข้อมูลเมื่อ</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-5 py-4 font-medium text-white/80">{row.keyword}</td>
                        <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${row.covered ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-200"}`}>{actionLabel(row.covered, row.opportunity)}</span></td>
                        <td className="px-4 py-4 text-white/65">{row.opportunity == null ? "—" : `${row.opportunity}/100`}</td>
                        <td className="px-4 py-4 text-white/60">{row.provider}</td>
                        <td className="px-4 py-4 text-white/60">{row.scope ?? "ไม่ระบุ"}</td>
                        <td className="px-4 py-4 text-white/60">{row.volume ?? "—"}</td>
                        <td className="px-4 py-4 text-white/60">{row.difficulty ?? "—"}</td>
                        <td className="px-4 py-4 text-white/60">{row.intent ?? "—"}</td>
                        <td className="px-4 py-4 text-white/60">{row.serpCount}</td>
                        <td className="px-5 py-4 text-white/60">{formatDate(row.checkedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <div className="p-7 text-center text-sm text-white/65">ยังไม่มีข้อมูลค้นคว้าในชุดข้อมูลนี้</div>}
        </section>
      ) : null}
    </div>
  );
}
