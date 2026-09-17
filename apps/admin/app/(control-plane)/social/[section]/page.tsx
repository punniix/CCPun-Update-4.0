import { notFound, redirect } from "next/navigation";
import SocialOperationsPage from "@/features/admin/social/operations-page";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export default async function SocialSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === "queue") return <SocialOperationsPage />;
  await requireAdminPermission("social:read");
  if (section === "campaigns") redirect("/social/posts/");
  notFound();
}
