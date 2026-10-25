import AdminLoginView from "@/features/admin/components/AdminLoginView";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, isAdminAuthConfigured, signIn } from "@/auth";
import { getEnvironmentLabel } from "@/lib/admin/environment";
import { adminCapabilityLandingPath, getAdminCapabilityProfile, safeAdminCapabilityReturnPath } from "@/lib/admin/capability-profile";

// Render per request so the Google sign-in server-action ID always matches the
// running build; a prerendered or stored login page cannot outlive a rebuild.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "เข้าสู่ศูนย์จัดการ CCPun",
  robots: { index: false, follow: false, nocache: true },
};

function safeCallbackUrl(value: string | undefined): string {
  return safeAdminCapabilityReturnPath(value) ?? adminCapabilityLandingPath();
}

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user?.role) redirect(adminCapabilityLandingPath());

  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);
  const configured = isAdminAuthConfigured();
  const environmentLabel = getEnvironmentLabel();

  async function loginWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: callbackUrl });
  }

  return <AdminLoginView environmentLabel={environmentLabel} error={params.error} configured={configured} loginWithGoogle={loginWithGoogle} title="เข้าสู่ศูนย์จัดการ CCPun" description={getAdminCapabilityProfile() === "editorial" ? "พื้นที่สำหรับจัดการบทความ ตรวจ SEO และเตรียมงานก่อนเผยแพร่ โดยให้ผู้มีสิทธิ์ตรวจและยืนยัน" : "พื้นที่สำหรับดูแลลูกค้า เนื้อหา SEO และงานของระบบ โดยทุกการเปลี่ยนแปลงสำคัญต้องให้ผู้มีสิทธิ์ยืนยัน"} footnote="บัญชีของคุณต้องได้รับสิทธิ์จาก CCPun ก่อน จึงจะเปิดพื้นที่นี้ได้" />;
}
