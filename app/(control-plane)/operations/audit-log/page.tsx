import type { Metadata } from "next";
import { AdminAuditPage as AdminAuditPageOwner } from "@/features/admin/components/AuditLogPage";

export const metadata: Metadata = { title: "ประวัติการทำงาน" };

export default async function AdminAuditPage() {
  return AdminAuditPageOwner({
    intro: "แยก Audit trail ของ Control Plane ออกจาก transition log ของ Article Scheduler อย่างชัดเจน เพื่อให้ตรวจย้อนหลังได้ว่าใครทำอะไร และคิวเผยแพร่เปลี่ยนสถานะเมื่อใด",
    unavailableHint: "ระบบหยุดไว้เพื่อความปลอดภัยเมื่อ private operational database ไม่ตรง lane หรือยังไม่พร้อม และจะไม่ย้อนกลับไปใช้ Sanity operational records เก่าแทนโดยอัตโนมัติ",
    emptyHint: "ยังไม่มี Scheduler transition record นี่เป็น healthy zero จาก `article_schedule_audit` ไม่ใช่ log ที่หาย",
    unavailableHeading: "ยังอ่านประวัติจากฐานข้อมูล Control Plane ไม่ได้",
    transitionSuffix: "transitions ที่โหลดล่าสุด",
    schedulerEyebrow: "Article Scheduler log",
    generationHeading: "Generation / Version",
    mainEyebrow: "Control Plane audit",
    releaseHeading: "Deployment history",
    contentHeading: "Schedule calendar",
    jobsHeading: "Jobs / queue",
    jobsEyebrow: "Operations",
    releaseEyebrow: "Release",
    contentEyebrow: "Content",
    eyebrowClass: "text-xs font-semibold uppercase tracking-[0.12em] text-white/40",
    schedulerRegionLabel: "Article Scheduler transition log",
    status: (status) => status,
    clockState: (runtime, durable) => `Runtime ${runtime ? "ON" : "OFF"} · Durable ${durable ? "ON" : "OFF"}`,
    readFailure: (error) => "อ่าน Scheduler log ไม่ได้: " + error,
    showErrorDetails: false,
  });
}
