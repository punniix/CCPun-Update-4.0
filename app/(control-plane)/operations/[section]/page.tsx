import { notFound } from "next/navigation";
import AdminCapabilityState from "@/features/admin/components/AdminCapabilityState";
import { requireAdminPermission } from "@/lib/admin/require-permission";

const SECTIONS = {
  deployments: { title: "Deployments", source: "Vercel deployment metadata", description: "ยังไม่มี server-side deployment reader ที่ยืนยัน active alias และ source SHA จึงไม่ถือว่า latest deployment คือ Production" },
  jobs: { title: "Operations Jobs", source: "Article scheduler + social publication records", description: "job sources เดิมยังถูกเก็บรักษาไว้ แต่ยังไม่มี read adapter รวมที่ยืนยัน retry, lock และ idempotency โดยไม่กระทบ queue" },
} as const;

export default async function OperationsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  await requireAdminPermission("settings:read");
  const item = SECTIONS[(await params).section as keyof typeof SECTIONS];
  if (!item) notFound();
  return <AdminCapabilityState {...item} status="not-configured" action={{ href: "/operations/health/", label: "ดู System Health" }} />;
}
