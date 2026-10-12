import type { Metadata } from "next";
import { AdminSeoPage as AdminSeoPageOwner } from "@/features/admin/components/SeoOverviewPage";

export const metadata: Metadata = { title: "SEO Control Center" };

export default async function AdminSeoPage() {
  return AdminSeoPageOwner({
    eyebrow: "SEO CONTROL CENTER",
    title: "SEO Control Center",
    intro: "รวมผลตรวจ SEO กับกติกาการแก้ไขที่ปลอดภัยในที่เดียว คะแนนมาจากกฎของ CCPun ไม่ใช่คะแนนจาก Google และการเปลี่ยน URL/indexability ของหน้าที่เผยแพร่แล้วต้องผ่าน migration workflow แยกต่างหาก",
    opportunities: "ดู Opportunities UAT",
    reviewsHref: "/dashboard/inbox/",
    dataset: (value: string | null | undefined) => value ?? "—",
    draftTitle: "แก้ผ่าน Draft ได้ตามปกติ",
    draftFields: "SEO Title · Meta Description · Keyword · Search Intent · Semantic Topic · รูปภาพ · Author · Sources",
    draftMeaning: "Semantic Topic ใช้จัดความหมาย/Knowledge Graph และไม่ใช่คำสั่งย้าย URL",
    protectedTitle: "Protected หลังบทความเคยเผยแพร่",
    protectedFields: "URL Slug · หมวดที่กำหนด URL path · Canonical override · Noindex",
    migrationHint: "หากต้องเปลี่ยน ให้ทำ SEO Migration Workflow ที่ประสาน redirect + canonical + sitemap + internal links + schema + regression พร้อมกัน",
    readFailure: "ยังอ่านข้อมูลบทความเพื่อตรวจ SEO ไม่ได้ ระบบหยุดไว้โดยไม่สลับ project หรือชุดข้อมูล",
    approvalBoundary: "การตรวจและการสร้างข้อเสนอเป็นคนละขั้นกับการอนุมัติ ระบบจะไม่ใช้ข้อเสนอหรือเผยแพร่บทความเอง และจะยังไม่สร้าง SEO Title / Meta description อัตโนมัติจนกว่าจะตรวจ page + query ownership จาก GSC เพื่อป้องกัน keyword cannibalization",
  });
}
