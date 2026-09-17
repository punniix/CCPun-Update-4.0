import { notFound, redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin/require-permission";

const CANONICAL_WORKSPACE_BY_SECTION: Record<string, string> = {
  keywords: "/content/research/",
  "internal-links": "/seo/audits/",
  competitors: "/content/research/",
  reports: "/seo/opportunities/",
};

export default async function SeoSectionPage({ params }: { params: Promise<{ section: string }> }) {
  await requireAdminPermission("seo:read");
  const target = CANONICAL_WORKSPACE_BY_SECTION[(await params).section];
  if (!target) notFound();
  redirect(target);
}
