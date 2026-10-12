import AdminLoginView from "@/features/admin/components/AdminLoginView";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, isAdminAuthConfigured, signIn } from "@/auth";
import { getEnvironmentLabel } from "@/lib/admin/environment";
import { safeAdminReturnPath } from "@/lib/admin/routes";

export const metadata: Metadata = {
  title: "CCPun Control Plane Login",
  robots: { index: false, follow: false, nocache: true },
};

function safeCallbackUrl(value: string | undefined): string {
  return safeAdminReturnPath(value) ?? "/dashboard/";
}

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user?.role) redirect("/dashboard/");

  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);
  const configured = isAdminAuthConfigured();
  const environmentLabel = getEnvironmentLabel();

  async function loginWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: callbackUrl });
  }

  return <AdminLoginView environmentLabel={environmentLabel} error={params.error} configured={configured} loginWithGoogle={loginWithGoogle} title="เข้าสู่พื้นที่ควบคุม CCPun" description="พื้นที่ควบคุมสำหรับตรวจบทความ วิเคราะห์ SEO และให้คุณอนุมัติทุกการเปลี่ยนแปลงด้วยตัวเอง" footnote="แม้เข้า Vercel หรือ Sanity ได้ บัญชีของคุณยังต้องอยู่ในรายชื่อผู้ใช้ของ CCPun เพื่อเปิดพื้นที่นี้" />;
}
