import { ContentCalendarPage as ContentCalendarPageOwner } from "@/features/admin/components/ContentCalendarPage";
import { calendarStatusLabel } from "@/lib/admin/operations/page-presentation";

export default async function ContentCalendarPage() {
  return ContentCalendarPageOwner({
    disabledHint: "ระบบยังไม่รับคิวใหม่จนกว่าสวิตช์ความปลอดภัยทั้งสองส่วนจะพร้อม หากต้องเปิดใช้งาน กรุณาให้เจ้าของระบบตรวจการเชื่อมต่อก่อน",
    intro: "ดูเวลาที่ตั้งไว้และสถานะของบทความจากคิวเผยแพร่จริง ข้อมูลในหน้านี้จึงตรงกับงานที่ระบบกำลังใช้",
    emptyHint: "ระบบพร้อมและไม่มีบทความตั้งเวลาในช่วงที่อ่านได้",
    eyebrow: "เนื้อหา",
    title: "ปฏิทินเผยแพร่",
    dataHeading: "อ่านข้อมูลคิว",
    runtimeHeading: "รับงานจากศูนย์จัดการ",
    durableHeading: "รับคิวใหม่",
    recordsHeading: "รายการตั้งเวลา",
    articlesLink: "ไปที่บทความ",
    modeHeading: "การทำงาน",
    readReady: "พร้อม",
    status: calendarStatusLabel,
    mode: (mode) => mode === "publish" ? "เผยแพร่" : "ตรวจความพร้อมเท่านั้น",
    queueReady: (_durable, effective) => effective ? "พร้อม" : "ยังไม่พร้อม",
    readFailure: () => "ยังอ่านคิวเผยแพร่ไม่ได้ กรุณาลองใหม่หรือตรวจหน้าสถานะระบบ",
    showErrorDetails: true,
    hideCancelled: true,
  });
}
