"use client";

import AdminErrorView from "@/features/admin/components/AdminErrorView";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminErrorView reset={reset} description="ยังยืนยันผลล่าสุดไม่ได้ หากเพิ่งบันทึก ส่งออก หรือเผยแพร่ ให้ตรวจรายการและประวัติงานเดิมก่อนดำเนินการซ้ำ การโหลดหน้าใหม่ใช้เพื่อตรวจข้อมูลอีกครั้ง" />;
}
