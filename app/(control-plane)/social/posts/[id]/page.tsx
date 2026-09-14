import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin/require-permission";

export default async function SocialPostDetailPage() {
  await requireAdminPermission("social:read");
  redirect("/social/posts/");
}
