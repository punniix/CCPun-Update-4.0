
export function formatBangkok(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

export function dayKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

export function dayLabel(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

export function statusTone(status: string) {
  if (["published", "validated"].includes(status)) return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (["preparing", "scheduled", "executing"].includes(status)) return "border-amber-200/20 bg-amber-200/10 text-amber-50";
  if (["failed", "reconciliation-required", "stale"].includes(status)) return "border-rose-300/20 bg-rose-300/10 text-rose-100";
  return "border-white/10 bg-white/[0.04] text-white/65";
}

export function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

export function auditStatusTone(status: string) {
  if (["published", "validated"].includes(status)) return "text-emerald-100";
  if (["preparing", "scheduled", "executing"].includes(status)) return "text-amber-100";
  if (["failed", "stale", "reconciliation-required"].includes(status)) return "text-rose-100";
  return "text-white/65";
}

export function calendarStatusLabel(status: string) {
  if (status === "published") return "เผยแพร่แล้ว";
  if (status === "validated") return "ตรวจพร้อมแล้ว";
  if (status === "preparing") return "กำลังเตรียม";
  if (status === "scheduled") return "ตั้งเวลาแล้ว";
  if (status === "executing") return "กำลังเผยแพร่";
  if (status === "reconciliation-required") return "สถานะยังไม่ชัด ต้องตรวจอีกครั้ง";
  if (status === "stale") return "บทความเปลี่ยนแล้ว ต้องตั้งเวลาใหม่";
  if (status === "failed") return "ไม่สำเร็จ";
  if (status === "cancelled") return "ยกเลิกแล้ว";
  return "ต้องตรวจ";
}

export function auditStatusLabel(status: string) {
  if (["published", "validated"].includes(status)) return "เสร็จแล้ว";
  if (["preparing", "scheduled"].includes(status)) return "รอดำเนินการ";
  if (status === "executing") return "กำลังดำเนินการ";
  if (status === "reconciliation-required") return "สถานะยังไม่ชัด ต้องตรวจอีกครั้ง";
  if (status === "failed") return "ไม่สำเร็จ";
  if (status === "stale") return "ข้อมูลเปลี่ยนแล้ว";
  if (status === "cancelled") return "ยกเลิกแล้ว";
  return "ต้องตรวจ";
}
