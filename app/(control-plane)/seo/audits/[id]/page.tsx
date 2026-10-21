import type { Metadata } from "next";
import { SeoAuditDetailPage as SeoAuditDetailPageOwner } from "@/features/admin/components/SeoAuditDetailPage";

export const metadata: Metadata = { title: "รายละเอียดผลตรวจ SEO" };

export default async function SeoAuditDetailPage(props: { params: Promise<{ id: string }> }) {
  return SeoAuditDetailPageOwner(props, {
    emptyDescription: "ยังไม่มี Meta description",
    socialHeading: "ตัวอย่างแชร์ Social",
    referencesHeading: "แหล่งอ้างอิง / FAQ",
    complianceHeading: "Fact-check / Compliance",
    factCheckHint: "สรุป · Entities · คำถาม · วันที่ตรวจ",
    legacyCtaHeading: "CTA เก่าจาก Facebook",
    noLegacyCta: "ไม่พบ CTA เก่า",
    proposalBoundary: "ระบบสร้างข้อเสนอ Search intent เท่านั้น เมื่อมี Primary keyword และ Research Snapshot จากแหล่งที่รองรับภายใน 30 วัน ข้อเสนอยังต้องให้มนุษย์ตรวจ ส่วน SEO Title และ Meta description จะไม่ถูกสร้างอัตโนมัติจนกว่าจะมีหลักฐาน GSC ownership ที่เพียงพอ",
  });
}
