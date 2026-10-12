import { ContentCalendarPage as ContentCalendarPageOwner } from "@/features/admin/components/ContentCalendarPage";

export default async function ContentCalendarPage() {
  return ContentCalendarPageOwner({
    disabledHint: "ระบบอ่านข้อมูลได้ แต่ยังไม่รับคิวใหม่จนกว่า Runtime switch และ Durable Neon switch จะเปิดพร้อมกัน การเปิด Durable switch ต้องทำด้วย database-owner channel แยกจาก runtime credential",
    intro: "อ่านสถานะจาก Article Scheduler โดยตรง เพื่อให้เห็นเวลาที่ตั้งไว้ สถานะคิว และประวัติที่ยังค้าง โดยไม่สร้างตารางเวลาแยกจากแหล่งข้อมูลจริง",
    emptyHint: "นี่เป็น healthy zero จากตาราง Article Scheduler ไม่ใช่ placeholder",
    eyebrow: "CONTENT OPERATIONS",
    title: "Content Calendar",
    dataHeading: "Data plane",
    runtimeHeading: "Runtime switch",
    durableHeading: "Durable switch",
    recordsHeading: "Schedule records",
    articlesLink: "ไปที่ Articles",
    modeHeading: "โหมด",
    readReady: "พร้อมอ่าน",
    status: (status) => status,
    mode: (mode) => mode,
    queueReady: (durable) => durable ? "เปิด" : "ปิด",
    readFailure: (error) => "Scheduler read error: " + error,
    showErrorDetails: false,
    hideCancelled: false,
  });
}
