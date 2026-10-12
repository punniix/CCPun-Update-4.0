import type { Metadata } from "next";
import { SeoAuditDetailPage as SeoAuditDetailPageOwner } from "@/features/admin/components/SeoAuditDetailPage";

export const metadata: Metadata = { title: "รายละเอียดผลตรวจ SEO" };

export default async function SeoAuditDetailPage(props: { params: Promise<{ id: string }> }) {
  return SeoAuditDetailPageOwner(props, {
    emptyDescription: "ยังไม่มีคำอธิบายสำหรับผลค้นหา",
    socialHeading: "ตัวอย่างเมื่อแชร์บนโซเชียล",
    referencesHeading: "แหล่งอ้างอิง / คำถามที่พบบ่อย",
    complianceHeading: "ตรวจข้อเท็จจริง / ข้อกำกับ",
    factCheckHint: "สรุป · สิ่งสำคัญที่กล่าวถึง · คำถาม · วันที่ตรวจ",
    legacyCtaHeading: "คำชวนให้ทำต่อแบบเก่าจาก Facebook",
    noLegacyCta: "ไม่พบคำชวนแบบเก่า",
    proposalBoundary: "ระบบสร้างข้อเสนอเรื่องเป้าหมายการค้นหาเฉพาะเมื่อมีคำค้นหลักและข้อมูลประกอบจากแหล่งที่รองรับภายใน 30 วัน ข้อเสนอยังต้องให้ผู้มีสิทธิ์ตรวจ และระบบจะไม่สร้างชื่อหรือคำอธิบายสำหรับผลค้นหาอัตโนมัติ จนกว่าจะยืนยันได้ว่าคำค้นนั้นควรอยู่กับหน้านี้",
  });
}
