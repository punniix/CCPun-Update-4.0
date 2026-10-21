/**
 * Pure, secret-free Studio validation for the scheduler confirmation UI.
 * Backend revision, owner and date checks remain authoritative.
 */
export type ArticleScheduleUiReadiness = {
  loading: boolean;
  busy: boolean;
  ready: boolean | null;
  mode: "publish" | "validate-only" | null;
  isUat: boolean;
  validating: boolean;
  articleBlock: string | null;
  revisionsMatch: boolean;
  confirmed: boolean;
  locked: boolean;
  draftPresent: boolean;
  scheduledLocal: string;
};

export function bangkokScheduleTimestamp(value: string): number | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!matched) return null;
  const parsed = Date.parse(`${value}:00+07:00`);
  if (!Number.isFinite(parsed)) return null;
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(parsed));
  const byPart = new Map(formatted.map(({ type, value: part }) => [type, part]));
  const reconstructed = `${byPart.get("year")}-${byPart.get("month")}-${byPart.get("day")}T${byPart.get("hour")}:${byPart.get("minute")}`;
  return reconstructed === value ? parsed : null;
}

export function articleScheduleUiBlock(input: ArticleScheduleUiReadiness, now = Date.now()): string | null {
  if (input.loading) return "กำลังตรวจสถานะ Scheduler กรุณารอสักครู่";
  if (input.ready === null) return "อ่านสถานะ Scheduler ไม่สำเร็จ กรุณาโหลดสถานะล่าสุด";
  if (!input.ready) return "Scheduler ของสภาพแวดล้อมนี้ยังไม่พร้อม ไม่สามารถสร้างคิวใหม่ได้";
  if (input.isUat && input.mode !== "validate-only")
    return "UAT ไม่ได้อยู่ในโหมดทดสอบแบบไม่เผยแพร่ ระบบจึงหยุดการตั้งเวลา";
  if (!input.isUat && input.mode !== "publish")
    return "Production ไม่ได้อยู่ในโหมดเผยแพร่ กรุณาตรวจ Release Configuration";
  if (input.busy) return "กำลังบันทึกคำสั่ง กรุณารอจนกว่าจะเสร็จ";
  if (input.validating) return "กรุณารอการบันทึกและตรวจฟอร์มให้เสร็จก่อนตั้งเวลา";
  if (!input.draftPresent) return "ไม่มีฉบับร่างพร้อมตั้งเวลา";
  if (input.articleBlock) return input.articleBlock;
  if (!input.revisionsMatch) return "บทความมีการเปลี่ยนแปลง กรุณาปิดและเปิดหน้าตั้งเวลาใหม่";
  if (input.locked) return "กำลังมีคิวดำเนินการหรือรอตรวจสอบผล จึงตั้งเวลาใหม่ไม่ได้";
  const scheduledAt = bangkokScheduleTimestamp(input.scheduledLocal);
  if (scheduledAt === null) return "กรุณาเลือกวันและเวลาประเทศไทยที่ถูกต้อง";
  if (scheduledAt <= now + 30_000) return "กรุณาเลือกเวลาอย่างน้อย 30 วินาทีล่วงหน้า";
  if (scheduledAt > now + 90 * 86_400_000) return "ตั้งเวลาได้ไม่เกิน 90 วันล่วงหน้า";
  if (!input.confirmed) return input.isUat
    ? "กรุณาทำเครื่องหมายยืนยันว่าเป็นการทดสอบโดยไม่มีการเผยแพร่"
    : "กรุณาตรวจตัวอย่างและยืนยันอนุมัติเผยแพร่ก่อนตั้งเวลา";
  return null;
}
