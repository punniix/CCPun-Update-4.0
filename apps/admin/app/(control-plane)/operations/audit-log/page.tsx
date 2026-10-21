import type { Metadata } from "next";
import { AdminAuditPage as AdminAuditPageOwner } from "@/features/admin/components/AuditLogPage";
import { auditStatusLabel } from "@/lib/admin/operations/page-presentation";

export const metadata: Metadata = { title: "ประวัติการทำงาน" };

export default async function AdminAuditPage() {
  return AdminAuditPageOwner({
    intro: "ตรวจย้อนหลังว่าใครทำอะไรในระบบ และดูว่าคิวเผยแพร่บทความเปลี่ยนสถานะเมื่อใด",
    unavailableHint: "ระบบหยุดไว้เพื่อความปลอดภัยเมื่อยืนยันแหล่งข้อมูลไม่ได้ และจะไม่ดึงประวัติเก่าจากระบบอื่นมาใช้แทนเอง",
    emptyHint: "ยังไม่มีการเปลี่ยนแปลงของคิวในช่วงที่อ่านได้ ซึ่งเป็นสถานะปกติ",
    unavailableHeading: "ยังอ่านประวัติจากฐานข้อมูลส่วนตัวไม่ได้",
    transitionSuffix: "การเปลี่ยนแปลงล่าสุด",
    schedulerEyebrow: "คิวเผยแพร่บทความ",
    generationHeading: "รหัสรุ่น",
    mainEyebrow: "ประวัติหลัก",
    releaseHeading: "ประวัติการนำขึ้นระบบจริง",
    contentHeading: "ปฏิทินเผยแพร่",
    jobsHeading: "งานเบื้องหลัง",
    jobsEyebrow: "ระบบ",
    releaseEyebrow: "เวอร์ชัน",
    contentEyebrow: "เนื้อหา",
    eyebrowClass: "text-xs font-semibold tracking-[0.12em] text-white/40",
    schedulerRegionLabel: "ประวัติการเปลี่ยนสถานะคิวบทความ",
    status: auditStatusLabel,
    clockState: (_runtime, _durable, effective) => effective ? "พร้อมรับคิวใหม่" : "ยังไม่รับคิวใหม่",
    readFailure: () => "ยังอ่านประวัติคิวเผยแพร่ไม่ได้ กรุณาลองใหม่หรือตรวจหน้าสถานะระบบ",
    showErrorDetails: true,
  });
}
