import type { Metadata } from "next";
import { readAnalyticsNow, StoredAnalyticsDashboard } from "@/features/admin/analytics/StoredAnalyticsDashboard";

export const metadata: Metadata = { title: "Dashboard รวม" };

export default async function AnalyticsIndexPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <StoredAnalyticsDashboard searchParams={await searchParams} now={readAnalyticsNow()} />;
}
