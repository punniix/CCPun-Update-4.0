import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin/require-permission";
import { isPageSeoUatAllowed } from "@/lib/admin/page-seo";
import PageSeoEditor from "@/features/admin/seo/PageSeoEditor";

export const metadata: Metadata = { title: "SEO หน้าเว็บ" };

export default async function PageSeoPage() {
  const identity = await requireAdminPermission("seo:read");
  if (identity.role !== "owner" || !isPageSeoUatAllowed()) redirect("/dashboard/?error=forbidden");
  return <PageSeoEditor />;
}
