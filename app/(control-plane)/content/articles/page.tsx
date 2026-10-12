import type { Metadata } from "next";
import type { ContentFilterParams } from "@/lib/admin/content-filters";
import { AdminContentPage as AdminContentPageOwner } from "@/features/admin/components/ContentArticlesPage";

export const metadata: Metadata = { title: "บทความ" };

export default async function AdminContentPage(props: { searchParams: Promise<ContentFilterParams> }) {
  return AdminContentPageOwner(props, {
    dataset: (value: string | null | undefined, fallback: string) => value ?? fallback,
    laneHint: "ในโหมด",
    readGuard: "ระบบจะหยุดหาก project หรือชุดข้อมูลไม่ตรงกัน",
    errorGuard: "ระบบหยุดไว้โดยไม่สลับ project หรือชุดข้อมูลให้เอง",
    reviewHref: "/dashboard/inbox/",
    editorNote: "ทุกครั้งที่พิมพ์ เพิ่มรูป หรือลบข้อมูลใน Studio ระบบจะบันทึกลงฉบับร่างอัตโนมัติ เมื่อกลับมาหน้านี้ รายการจะรีเฟรชจาก Sanity ให้เอง หน้าเว็บจริงจะเปลี่ยนเฉพาะเมื่อคุณกด Publish ใน Studio ด้วยตัวเอง",
    applyHint: "ปุ่ม Apply อัตโนมัติยังปิดไว้",
  });
}
