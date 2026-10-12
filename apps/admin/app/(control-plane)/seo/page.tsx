import type { Metadata } from "next";
import PostPublishUatMockButton from "@/features/admin/components/PostPublishUatMockButton";
import UatSeoN8nCanary from "@/features/admin/components/UatSeoN8nCanary";
import { resolveUatFabricConfig } from "@/lib/admin/n8n/uat-fabric-policy";
import { getAdminIdentity } from "@/lib/admin/identity";
import { isUatPostPublishMockAllowed } from "@/lib/admin/seo-intelligence/post-publish-uat-policy";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { datasetLabel } from "@/lib/admin/presentation";
import { AdminSeoPage as AdminSeoPageOwner } from "@/features/admin/components/SeoOverviewPage";

export const metadata: Metadata = { title: "ตรวจ SEO" };

export default async function AdminSeoPage() {
  return AdminSeoPageOwner({
    uatTools: {
      readIdentity: getAdminIdentity,
      render: (identity) => <>
        {isUatPostPublishMockAllowed(process.env) ? <PostPublishUatMockButton /> : null}
        {getAdminEnvironment() === "admin-uat" && identity?.role === "owner" ? <UatSeoN8nCanary enabled={resolveUatFabricConfig(process.env).ready} /> : null}
      </>,
    },
    eyebrow: "เนื้อหาและการค้นหา",
    title: "ตรวจ SEO",
    intro: "รวมผลตรวจ SEO และข้อควรระวังไว้ในที่เดียว คะแนนมาจากกฎตรวจของ CCPun ไม่ใช่คะแนนจาก Google หากบทความเคยเผยแพร่แล้ว การเปลี่ยนที่อยู่หน้าหรือการให้เครื่องมือค้นหาเก็บหน้าต้องตรวจผลกระทบแยกก่อน",
    opportunities: "ดูผลลัพธ์จากการค้นหา",
    reviewsHref: "/dashboard/reviews/",
    dataset: (value: string | null | undefined) => datasetLabel(value),
    draftTitle: "แก้ในฉบับร่างได้ตามปกติ",
    draftFields: "ชื่อและคำอธิบายบนผลค้นหา · คำค้น · เป้าหมายการค้นหา · หัวข้อที่เกี่ยวข้อง · รูปภาพ · ผู้เขียน · แหล่งอ้างอิง",
    draftMeaning: "หัวข้อที่เกี่ยวข้องใช้ช่วยจัดความหมายของเนื้อหา และไม่เปลี่ยนที่อยู่หน้าเว็บ",
    protectedTitle: "ต้องตรวจผลกระทบก่อนแก้ หลังเคยเผยแพร่",
    protectedFields: "ที่อยู่หน้าเว็บ · หมวดที่กำหนดที่อยู่ · หน้าหลักของเนื้อหาซ้ำ · การซ่อนจากผลค้นหา",
    migrationHint: "หากต้องเปลี่ยน ต้องเตรียมทางส่งต่อ ที่อยู่หลัก แผนผังเว็บ ลิงก์ภายใน และข้อมูลสำหรับเครื่องมือค้นหาให้ครบ พร้อมทดสอบก่อนนำขึ้นระบบจริง",
    readFailure: "ยังอ่านข้อมูลบทความเพื่อตรวจ SEO ไม่ได้ ระบบหยุดไว้โดยไม่สลับโครงการหรือชุดข้อมูล",
    approvalBoundary: "การตรวจ การสร้างข้อเสนอ และการอนุมัติเป็นคนละขั้น ระบบจะไม่ใช้ข้อเสนอหรือเผยแพร่บทความเอง และจะไม่สร้างชื่อหรือคำอธิบายสำหรับผลค้นหาอัตโนมัติ จนกว่าจะยืนยันจาก Google Search Console ว่าคำค้นนั้นควรอยู่กับหน้านี้ เพื่อป้องกันหลายหน้าของ CCPun แข่งขันกันเอง",
  });
}
