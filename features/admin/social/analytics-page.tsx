import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, Database, Layers3 } from "lucide-react";
import SocialMarketingDashboard from "@/features/admin/social/SocialMarketingDashboard";
import SocialStatsDashboard, { type SocialAnalyticsItem } from "@/features/admin/social/SocialStatsDashboard";
import {
  fallbackPostsFromRaw,
  type MarketingDashboardData,
} from "@/lib/admin/social/marketing-dashboard-model";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { getSocialAnalyticsDashboard } from "@/lib/admin/social/analytics-ingestion";
import { getSocialMarketingDashboard, getSocialMarketingDashboardRuntimeStatus } from "@/lib/admin/social/marketing-dashboard";

export const metadata: Metadata = { title: "ผลลัพธ์โซเชียล" };

type AnalyticsPageProps = {
  searchParams: Promise<{ view?: string | string[] }>;
};

function analyticsItems(items: Awaited<ReturnType<typeof getSocialAnalyticsDashboard>>): SocialAnalyticsItem[] {
  return items.map((item) => ({
    ...item,
    metrics: item.metrics.map((metric) => ({ ...metric, delta: metric.delta })),
  }));
}

function viewValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "marketing";
}

export default async function SocialAnalyticsPage({ searchParams }: AnalyticsPageProps) {
  await requireAdminPermission("social:read");
  if (!getSocialMarketingDashboardRuntimeStatus().enabled) notFound();
  const view = viewValue((await searchParams).view);

  if (view === "raw") {
    const result = await getSocialAnalyticsDashboard()
      .then((items) => ({ items: analyticsItems(items), error: null }))
      .catch(() => ({ items: [] as SocialAnalyticsItem[], error: "ฐานข้อมูลสถิติติดต่อไม่ได้ชั่วคราว" }));
    return (
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">โซเชียล · ข้อมูลต้นทาง</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">สถิติต้นทางจากแพลตฟอร์ม</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
              ใช้ตรวจตัวเลขล่าสุดของแต่ละโพสต์โดยแยกตามแพลตฟอร์ม ระบบจะไม่บวกยอดดูหรือการเข้าถึงข้ามแพลตฟอร์ม
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/analytics/social/" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#9eebce] px-4 py-2.5 text-sm font-semibold text-[#101820] hover:bg-[#b6f3dc] focus:outline-none focus:ring-2 focus:ring-[#e0c985]"><BarChart3 className="h-4 w-4" />สรุปผลการตลาด</Link>
            <Link href="/social/posts/" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]"><Layers3 className="h-4 w-4" />รายการโพสต์</Link>
          </div>
        </div>
        {result.error ? <p role="alert" className="mt-6 rounded-2xl border border-rose-200/20 bg-rose-200/[0.05] p-4 text-sm text-rose-100">{result.error}</p> : null}
        {!result.error && result.items.length === 0 ? <p className="mt-6 rounded-2xl border border-white/10 p-5 text-sm text-white/65">ยังไม่มีข้อมูลย้อนหลัง กรุณาดึงข้อมูลจากแพลตฟอร์มอย่างน้อยหนึ่งครั้งเพื่อเริ่มเก็บผล</p> : null}
        {!result.error && result.items.length ? <SocialStatsDashboard items={result.items} /> : null}
      </div>
    );
  }

  let marketingData: MarketingDashboardData;
  let fallbackNotice: string | null = null;
  try {
    marketingData = await getSocialMarketingDashboard();
  } catch {
    const raw = await getSocialAnalyticsDashboard().then(analyticsItems).catch(() => [] as SocialAnalyticsItem[]);
    const posts = fallbackPostsFromRaw(raw);
    marketingData = {
      posts,
      coverage: [],
      latestSnapshotAt: posts.map((post) => post.snapshotAt).sort().at(-1) ?? null,
      sourceMode: "raw-fallback",
    };
    fallbackNotice = raw.length
      ? "หน้าทดสอบนี้ยังไม่มีชุดข้อมูลสรุป จึงใช้ข้อมูลต้นทางเพื่อทดสอบหน้าจอ ส่วนระบบจริงใช้ข้อมูลที่ตรวจและจัดรูปแบบแล้ว"
      : "ข้อมูลสรุปผลการตลาดติดต่อไม่ได้ชั่วคราว";
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">โซเชียล · ผลลัพธ์</p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">สรุปผลการตลาด</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
            ดูว่าเนื้อหาใดทำผลงานดี อะไรควรทำซ้ำ และตัวเลขใดต้องอ่านพร้อมข้อจำกัด โดยไม่ต้องเปิดฐานข้อมูลเอง
          </p>
        </div>
        <Link href="/analytics/social/?view=raw" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#e0c985]"><Database className="h-4 w-4" />เปิดข้อมูลต้นทาง</Link>
      </div>
      {fallbackNotice ? <p role="status" className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/[0.05] p-4 text-sm leading-6 text-amber-100/80">{fallbackNotice}</p> : null}
      {marketingData.posts.length ? <SocialMarketingDashboard data={marketingData} /> : <p className="mt-6 rounded-2xl border border-white/10 p-5 text-sm text-white/65">ยังไม่มีข้อมูลโซเชียลสำหรับสรุปผลการตลาด</p>}
    </div>
  );
}
