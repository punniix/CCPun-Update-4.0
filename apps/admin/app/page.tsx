import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function AdminEntryPage() {
  const session = await auth();
  redirect(session?.user?.role ? "/dashboard/" : "/login/");
}
