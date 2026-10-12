"use client";

import AdminErrorView from "@/features/admin/components/AdminErrorView";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminErrorView reset={reset} description="ข้อมูลของคุณไม่ได้ถูกเผยแพร่หรือส่งไปยังระบบจริง ลองใหม่ได้อย่างปลอดภัย" />;
}
