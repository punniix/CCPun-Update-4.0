import type { Metadata } from "next";
import { readAnalyticsNow, StoredAnalyticsDashboard } from "@/features/admin/analytics/StoredAnalyticsDashboard";
import RefreshNowSection from "@/features/admin/seo/opportunities/RefreshNowSection";

export const metadata: Metadata = { title: "การค้นหาและผู้เข้าชม" };

export default async function GrowthDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <StoredAnalyticsDashboard searchParams={await searchParams} now={readAnalyticsNow()} searchOnly refreshSlot={<RefreshNowSection />} />;
}
