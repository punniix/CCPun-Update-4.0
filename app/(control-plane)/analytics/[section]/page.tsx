import { notFound, redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin/require-permission";

const CANONICAL_WORKSPACE_BY_SECTION: Record<string, string> = {
  website: "/analytics/search/",
  conversions: "/dashboard/",
};

export default async function AnalyticsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  await requireAdminPermission("dashboard:read");
  const target = CANONICAL_WORKSPACE_BY_SECTION[(await params).section];
  if (!target) notFound();
  redirect(target);
}
