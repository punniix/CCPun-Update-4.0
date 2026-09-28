import type { Metadata } from "next";
import Link from "next/link";
import { readAnalyticsNow, StoredAnalyticsDashboard } from "@/features/admin/analytics/StoredAnalyticsDashboard";

export const metadata: Metadata = { title: "Dashboard รวม" };

export default async function AnalyticsIndexPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <><Link href="/analytics/performance/" className="mb-6 inline-flex min-h-11 items-center rounded-lg border border-[#e0c985]/50 px-4 py-2 text-sm text-[#e0c985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e0c985]">เปิด Performance Marketing · Top Content และ Action Plan</Link><StoredAnalyticsDashboard searchParams={await searchParams} now={readAnalyticsNow()} /></>;
}
