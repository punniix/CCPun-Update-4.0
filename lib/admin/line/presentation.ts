import type { LineCaseStage, LineBotDecision } from "../../line/ecosystem";

const STAGE_LABELS: Record<LineCaseStage, string> = {
  New: "ลูกค้าใหม่",
  Qualified: "รู้แล้วว่าลูกค้าสนใจอะไร",
  "Expert Review": "กำลังเช็กข้อมูลให้",
  Solution: "กำลังดูทางเลือก",
  Quote: "กำลังดูใบเสนอราคา",
  Implementation: "กำลังดำเนินการให้",
  Won: "ดูแลเรียบร้อยแล้ว",
  Lost: "ไม่ได้ไปต่อ",
};

const JOURNEY_LABELS: Record<string, string> = {
  motor_quote_review: "ประกันรถ",
  life_health_policy_review: "ประกันชีวิต / สุขภาพ",
  investment_before_you_act: "การลงทุน",
  human_handoff: "สอบถามทั่วไป",
};

const NEED_LABELS: Record<string, string> = {
  need_vehicle_info: "ต้องการข้อมูลรถเพิ่มเติม",
  quote_available: "มีใบเสนอราคาแล้ว",
  material_request: "รอเอกสารเดิมจากลูกค้า",
  ci_planning_context: "เช็กเงินก้อนเมื่อเจอโรคร้ายแรง",
  before_add: "กำลังดูก่อนซื้อเพิ่ม",
  before_switch: "กำลังดูก่อนย้ายหรือสับเปลี่ยน",
  waiting_for_advisor: "รอปันตอบ",
};

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  text: "ข้อความ",
  image: "รูปภาพ",
  video: "วิดีโอ",
  audio: "เสียง",
  file: "ไฟล์",
  location: "ตำแหน่ง",
  sticker: "สติกเกอร์",
};

const MESSAGE_STATUS_LABELS: Record<string, string> = {
  active: "อยู่ในประวัติ",
  unsent: "ลูกค้ายกเลิกข้อความนี้",
  imported: "นำเข้าจาก LINE OA",
  sent: "ส่งแล้ว",
  delivery_pending: "กำลังส่ง",
  failed: "ส่งยังไม่สำเร็จ",
  queued: "รอส่ง",
  leased: "กำลังดำเนินการ",
  retryable_failed: "จะลองใหม่",
  dead_letter: "ต้องตรวจสอบ",
  reconciliation_required: "สถานะยังไม่ชัด ต้องเช็กอีกครั้ง",
};

const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  pending_fetch: "กำลังรับไฟล์จาก LINE",
  pending_upload: "กำลังเก็บไฟล์",
  stored: "เก็บไฟล์เรียบร้อยแล้ว",
  revoke_required: "รอลบไฟล์ที่ลูกค้ายกเลิก",
  revoked: "ยกเลิกการเข้าถึงไฟล์แล้ว",
  deleted: "ลบไฟล์แล้ว",
  failed: "เก็บไฟล์นี้ยังไม่สำเร็จ",
  reconciliation_required: "สถานะไฟล์ยังไม่ชัด ต้องเช็กอีกครั้ง",
};

const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  "LINE Attachments": "ไฟล์จาก LINE",
  Insurance: "เอกสารประกัน",
  Quotations: "ใบเสนอราคา",
  "Other Documents": "เอกสารอื่น",
};

const EVENT_LABELS: Record<string, string> = {
  assignment: "เปลี่ยนผู้ดูแล",
  follow_up: "ตั้งวันติดตาม",
  priority: "เปลี่ยนความสำคัญ",
  state: "เปลี่ยนสถานะการดูแล",
  tag_added: "เพิ่มป้ายภายใน",
  tag_removed: "นำป้ายภายในออก",
  note_added: "เพิ่มโน้ต",
  document_status: "สถานะเอกสารเปลี่ยน",
};

const BOT_DECISION_LABELS: Record<LineBotDecision, string> = {
  approved_answer: "มีคำตอบให้ลูกค้าได้ทันที",
  show_content: "มีเนื้อหาที่เกี่ยวข้องให้ดู",
  show_tool: "มีเครื่องมือที่ช่วยต่อได้",
  qualify: "กำลังเก็บข้อมูลเพิ่ม",
  human_handoff: "รอปันตอบ",
};

const IMPLEMENTATION_LABELS: Record<string, string> = {
  planned: "กำลังเตรียมดำเนินการ",
  in_progress: "กำลังดำเนินการ",
  complete: "ดำเนินการเรียบร้อยแล้ว",
  cancelled: "ยกเลิกแล้ว",
};

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "กำลังร่าง",
  approved: "ตรวจแล้ว รอเตรียมส่ง",
  queued: "เตรียมรายการผู้รับแล้ว",
  sending: "กำลังส่ง",
  completed: "ส่งเรียบร้อยแล้ว",
  paused: "พักไว้",
  cancelled: "ยกเลิกแล้ว",
  failed: "มีรายการที่ส่งไม่สำเร็จ",
};

const PRIVACY_STATUS_LABELS: Record<string, string> = {
  pending: "รอตรวจ",
  verified: "ตรวจข้อมูลแล้ว",
  prepared: "เตรียมข้อมูลแล้ว",
  approved: "อนุมัติแล้ว",
  completed: "เรียบร้อยแล้ว",
  rejected: "ไม่ดำเนินการ",
  failed: "ดำเนินการยังไม่สำเร็จ",
};

function humanizeUnknown(value: string | null | undefined) {
  if (!value) return "—";
  return value.replace(/[_-]+/g, " ").trim();
}

export function lineStageLabel(value: LineCaseStage | string | null | undefined) {
  return value && value in STAGE_LABELS
    ? STAGE_LABELS[value as LineCaseStage]
    : humanizeUnknown(value);
}

export function lineJourneyLabel(value: string | null | undefined) {
  return value ? JOURNEY_LABELS[value] ?? "สอบถามทั่วไป" : "สอบถามทั่วไป";
}

export function lineNeedLabel(value: string | null | undefined) {
  return value ? NEED_LABELS[value] ?? "กำลังดูรายละเอียด" : "ยังไม่ได้ระบุ";
}

export function lineMessageTypeLabel(value: string | null | undefined) {
  return value ? MESSAGE_TYPE_LABELS[value] ?? "รายการจาก LINE" : "—";
}

export function lineMessageStatusLabel(value: string | null | undefined) {
  return value ? MESSAGE_STATUS_LABELS[value] ?? "อยู่ในประวัติ" : "—";
}

export function lineConversationStatusLabel(value: string | null | undefined) {
  if (value === "open") return "กำลังดูแล";
  if (value === "closed") return "ปิดการดูแลแล้ว";
  return "—";
}

export function lineBotDecisionLabel(value: LineBotDecision | string | null | undefined) {
  return value && value in BOT_DECISION_LABELS
    ? BOT_DECISION_LABELS[value as LineBotDecision]
    : "รอปันดูรายละเอียด";
}

export function lineEvidenceSourceLabel(value: string | null | undefined) {
  if (value === "line_webhook") return "ข้อความจาก LINE";
  if (value === "line_oa_csv") return "นำเข้าจาก LINE OA";
  return "ประวัติการคุย";
}

export function lineOperationEventLabel(value: string | null | undefined) {
  return value ? EVENT_LABELS[value] ?? "มีการอัปเดตข้อมูล" : "มีการอัปเดตข้อมูล";
}

export function lineDocumentStatusLabel(value: string | null | undefined) {
  return value ? DOCUMENT_STATUS_LABELS[value] ?? "กำลังตรวจสอบไฟล์" : "—";
}

export function lineDocumentCategoryLabel(value: string | null | undefined) {
  return value ? DOCUMENT_CATEGORY_LABELS[value] ?? "เอกสาร" : "เอกสาร";
}

export function lineImplementationLabel(value: string | null | undefined) {
  return value ? IMPLEMENTATION_LABELS[value] ?? "กำลังดำเนินการ" : "กำลังดำเนินการ";
}

export function lineCampaignStatusLabel(value: string | null | undefined) {
  return value ? CAMPAIGN_STATUS_LABELS[value] ?? "กำลังเตรียม" : "กำลังเตรียม";
}

export function linePrivacyStatusLabel(value: string | null | undefined) {
  return value ? PRIVACY_STATUS_LABELS[value] ?? "กำลังตรวจ" : "กำลังตรวจ";
}

export function linePrivacyRequestTypeLabel(value: string | null | undefined) {
  if (value === "export") return "ขอสำเนาข้อมูล";
  if (value === "delete") return "ขอลบข้อมูล";
  return "คำขอเกี่ยวกับข้อมูล";
}

export function lineRetentionModeLabel(value: string | null | undefined) {
  if (value === "manual_review") return "ตรวจและตัดสินใจเอง";
  return "ตรวจและตัดสินใจเอง";
}

export function lineTechnicalStateLabel(value: string | null | undefined) {
  switch (value) {
    case "ready": return "พร้อมใช้งาน";
    case "available": return "พร้อมใช้งาน";
    case "disabled": return "ยังไม่ได้เปิด";
    case "not_ready": return "ยังไม่พร้อม";
    case "unavailable": return "ยังใช้งานไม่ได้";
    case "key_unavailable": return "ยังเปิดข้อมูลนี้ไม่ได้";
    case "read_failed": return "อ่านข้อมูลยังไม่สำเร็จ";
    case "external_verification_required": return "ต้องตรวจยืนยันจากผู้ให้บริการ";
    case "aggregate_status_available": return "ตรวจสถานะรวมได้";
    default: return value ? humanizeUnknown(value) : "—";
  }
}

export function formatFileSize(bytes: number | null | undefined) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "ไม่ทราบขนาด";
  if (bytes < 1024) return `${bytes.toLocaleString("th-TH")} ไบต์`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
