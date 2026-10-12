import type { Metadata } from "next";
import type { ContentFilterParams } from "@/lib/admin/content-filters";
import { datasetLabel } from "@/lib/admin/presentation";
import { AdminContentPage as AdminContentPageOwner } from "@/features/admin/components/ContentArticlesPage";

export const metadata: Metadata = { title: "บทความ" };

export default async function AdminContentPage(props: { searchParams: Promise<ContentFilterParams> }) {
  return AdminContentPageOwner(props, {
    dataset: (value: string | null | undefined) => datasetLabel(value),
    laneHint: "ในพื้นที่",
    readGuard: "ระบบจะหยุดหากโครงการหรือชุดข้อมูลไม่ตรงกัน",
    errorGuard: "ระบบหยุดไว้โดยไม่สลับโครงการหรือชุดข้อมูลให้เอง",
    reviewHref: "/dashboard/reviews/",
    editorNote: "ทุกครั้งที่พิมพ์ เพิ่มรูป หรือลบข้อมูลใน Studio ระบบจะบันทึกลงฉบับร่างอัตโนมัติ เมื่อกลับมาหน้านี้ รายการจะรีเฟรชจาก Sanity ให้เอง หน้าเว็บจริงจะเปลี่ยนเฉพาะเมื่อคุณกดเผยแพร่ใน Studio ด้วยตัวเอง",
    applyHint: "การนำข้อเสนอไปใช้โดยอัตโนมัติยังปิดไว้",
  });
}
