import type { Metadata } from "next";
import { PerformanceMarketingDashboard } from "@/features/admin/marketing/PerformanceMarketingDashboard";
import { marketingWindowSchema } from "@/lib/admin/marketing/model";
import { readMarketingAnalysis } from "@/lib/admin/marketing/analysis";
import { readMarketingDashboard } from "@/lib/admin/marketing/store";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export const metadata: Metadata = { title: "Performance Marketing" };

export default async function PerformanceMarketingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPermission("settings:read");
  const params = await searchParams, window = marketingWindowSchema.safeParse(params.window);
  const selected = window.success ? window.data : "this_week";
  const [model, analysis] = await Promise.all([readMarketingDashboard(selected), readMarketingAnalysis(selected)]);
  return <PerformanceMarketingDashboard model={model} analysis={analysis} />;
}
