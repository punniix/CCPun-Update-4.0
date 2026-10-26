import type { Metadata } from "next";
import Link from "next/link";
import { readAnalyticsNow, StoredAnalyticsDashboard } from "@/features/admin/analytics/StoredAnalyticsDashboard";
import RefreshNowSection from "@/features/admin/seo/opportunities/RefreshNowSection";

export const metadata: Metadata = { title: "Dashboard รวม" };

// The morning report. "ดึงใหม่ตอนนี้" (RefreshNowSection) replaces the former
// manual GSC/GA4 page; /seo/opportunities/ now redirects here (owner decision A4).
export default async function AnalyticsIndexPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const googleConnect = typeof params.googleConnect === "string" ? params.googleConnect : "";
  return <><Link href="/analytics/performance/" className="mb-6 inline-flex min-h-11 items-center rounded-lg border border-[#e0c985]/50 px-4 py-2 text-sm text-[#e0c985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]">เปิด Performance Marketing · Top Content และ Action Plan</Link><StoredAnalyticsDashboard searchParams={params} now={readAnalyticsNow()} refreshSlot={<RefreshNowSection googleConnect={googleConnect} />} /></>;
}
