import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import MediaLibraryUatSection from "@/features/admin/media/MediaLibraryUatSection";
import { getMediaLibraryRuntimeStatus } from "@/lib/admin/media/foundation";
import { getSocialDatabaseReadiness } from "@/lib/admin/social/database";
import {
  getSocialFoundationRuntimeStatus,
  socialFoundationSnapshotSchema,
  SYNTHETIC_SOCIAL_FOUNDATION,
} from "@/lib/admin/social/foundation";

export const metadata: Metadata = { title: "Distribution UAT" };

const platformLabel = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  "facebook-group": "Facebook Groups",
} as const;

const modeLabel = {
  direct: "ส่งตรงผ่าน API",
  "native-scheduled": "ใช้เวลานัดหมายของแพลตฟอร์ม",
  "native-finish": "รอจบงานในแอป",
  "tiktok-draft": "ส่งเข้า TikTok Draft",
  "assisted-distribution": "ช่วยเตรียมให้ผู้ใช้ยืนยัน",
} as const;

function readinessLabel(readiness: Awaited<ReturnType<typeof getSocialDatabaseReadiness>>) {
  if (!readiness.configured) return "รอผูก Neon Secret";
  if (!readiness.reachable) return "ยังเชื่อมต่อไม่ได้";
  if (!readiness.migrationCurrent) return "รอใช้ schema รุ่นปัจจุบัน";
  return "พร้อมอ่าน schema รุ่นปัจจุบัน";
}

export default async function SocialFoundationUatPage() {
  await requireAdminPermission("social:read");
  const runtime = getSocialFoundationRuntimeStatus();
  const mediaRuntime = getMediaLibraryRuntimeStatus();
  if (!runtime.enabled && !mediaRuntime.enabled) notFound();

  if (mediaRuntime.enabled) return <MediaLibraryUatSection />;

  const snapshot = socialFoundationSnapshotSchema.parse(SYNTHETIC_SOCIAL_FOUNDATION);
  const database = await getSocialDatabaseReadiness();

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">WEBSITE 4.2 · SYNTHETIC UAT</p>
      <h1 className="mt-2 text-3xl font-semibold">Social Data-Plane Foundation</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
        หน้านี้ตรวจความสัมพันธ์ระหว่าง Master Content กับชิ้นงานแต่ละช่องทางเท่านั้น ยังไม่เชื่อมบัญชีจริง ไม่อัปโหลดสื่อ และไม่โพสต์ไปยังแพลตฟอร์มใด
      </p>

      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-white/60">โหมดข้อมูล</div>
          <div className="mt-2 font-semibold text-emerald-200">Synthetic UAT</div>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-white/60">Operational Database</div>
          <div className="mt-2 font-semibold">{readinessLabel(database)}</div>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="text-sm text-white/60">การโพสต์จริง</div>
          <div className="mt-2 font-semibold text-amber-200">ปิดอยู่</div>
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-[#e0c985]/20 bg-[#e0c985]/[0.05] p-5">
        <div className="text-sm text-white/55">Master Content</div>
        <h2 className="mt-2 text-xl font-semibold text-[#f4df9b]">{snapshot.masterContent.title}</h2>
        <div className="mt-2 text-sm text-white/60">{snapshot.variants.length} channel variants · fixture ผ่านการอนุมัติแล้ว</div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {snapshot.variants.map((variant) => (
          <article key={variant.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs font-semibold tracking-wide text-[#e0c985]">{platformLabel[variant.platform]}</div>
            <h2 className="mt-2 font-semibold text-white/90">{variant.title}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-white/45">รูปแบบ</dt><dd className="mt-1 text-white/75">{variant.format}</dd></div>
              <div><dt className="text-white/45">วิธีส่ง</dt><dd className="mt-1 text-white/75">{modeLabel[variant.publishingMode]}</dd></div>
              <div><dt className="text-white/45">สถานะจำลอง</dt><dd className="mt-1 text-white/75">{variant.status}</dd></div>
            </dl>
          </article>
        ))}
      </section>

      <section role="note" className="mt-6 rounded-3xl border border-amber-200/20 bg-amber-200/[0.05] p-5 text-sm leading-6 text-amber-50/80">
        ขอบเขต Phase 1: ตรวจ schema, media metadata, state machine, idempotency และ audit contract เท่านั้น OAuth, media upload/storage, webhook และคำสั่ง publish ยังปิดอยู่
      </section>
    </div>
  );
}
