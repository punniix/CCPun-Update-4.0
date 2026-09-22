import type { AdminRole } from "./rbac";

const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "เจ้าของระบบ",
  editor: "ผู้ดูแลเนื้อหา",
  "seo-manager": "ผู้จัดการ SEO",
  reviewer: "ผู้ตรวจทาน",
  analyst: "ผู้วิเคราะห์",
  viewer: "ผู้ดูข้อมูล",
};

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  "needs-human-review": "รอคุณตรวจสอบ",
  approved: "อนุมัติแล้ว",
  applied: "นำไปใช้กับฉบับร่างแล้ว",
  rejected: "ไม่อนุมัติ",
};

const CONTENT_REVIEW_STATUS_LABELS: Record<string, string> = {
  "content-review": "กำลังตรวจเนื้อหา",
  "ready-for-coo": "พร้อมให้คุณอนุมัติ",
  approved: "อนุมัติเนื้อหาแล้ว",
};

const RISK_LABELS: Record<string, string> = {
  low: "ต่ำ",
  medium: "ปานกลาง",
  high: "สูง — ตรวจใน Studio",
  critical: "วิกฤต — ตรวจใน Studio",
};

const PROPOSAL_TYPE_LABELS: Record<string, string> = {
  "seo-title": "ชื่อเรื่องสำหรับ SEO",
  "meta-description": "คำอธิบายสำหรับผลค้นหา",
  "primary-keyword": "คำค้นหลัก",
  "secondary-keywords": "คำค้นรอง",
  "search-intent": "เป้าหมายการค้นหา",
  structure: "โครงสร้างบทความ",
  "internal-links": "ลิงก์ภายใน",
  content: "เนื้อหา",
};

const API_ERROR_MESSAGES: Record<string, string> = {
  "not-configured": "การเชื่อมต่อของสภาพแวดล้อมนี้ยังตั้งค่าไม่ครบ ระบบจึงหยุดไว้เพื่อความปลอดภัย",
  "read-token-required": "การเชื่อมต่อสำหรับอ่านข้อมูลยังไม่พร้อม",
  "request-failed": "ยังอ่านข้อมูลไม่สำเร็จ กรุณาลองใหม่ภายหลัง",
  unauthorized: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง",
  forbidden: "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้",
  "invalid-input": "ข้อมูลยังไม่ครบหรือรูปแบบไม่ถูกต้อง กรุณาตรวจอีกครั้ง",
  "write-token-required": "การเชื่อมต่อสำหรับบันทึกฉบับร่างยังไม่พร้อม",
  "suggestion-stale": "ฉบับร่างเปลี่ยนหลังจากอนุมัติข้อเสนอนี้ กรุณาตรวจ SEO และสร้างข้อเสนอใหม่",
  "suggestion-conflict": "บทความหรือข้อเสนอเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่และตรวจอีกครั้ง",
  "risk-too-high": "ข้อเสนอนี้มีความเสี่ยงสูง ต้องตรวจและแก้ด้วยตนเองใน Studio",
  "manual-apply-required": "รายการนี้ต้องตรวจและแก้ด้วยตนเองใน Studio",
  "target-draft-not-found": "ไม่พบฉบับร่างที่เกี่ยวข้องในสภาพแวดล้อมนี้",
  "suggestion-not-found": "ไม่พบข้อเสนอนี้ อาจมีการเปลี่ยนแปลงไปแล้ว",
  "not-found": "ไม่พบข้อมูลที่ต้องการ อาจมีการเปลี่ยนแปลงไปแล้ว",
  "article-not-found": "ไม่พบบทความนี้ในสภาพแวดล้อมนี้",
  "audit-failed": "ยังตรวจ SEO ไม่สำเร็จ กรุณาลองอีกครั้ง",
  "audit-draft-required": "บทความนี้ยังไม่มีฉบับร่าง กรุณาเปิด Studio เพื่อเริ่มฉบับร่างก่อนตรวจ SEO",
  "audit-stale": "บทความเปลี่ยนไประหว่างการตรวจ กรุณาลองตรวจ SEO ใหม่อีกครั้ง",
  "proposal-source-stale": "บทความเปลี่ยนไประหว่างสร้างข้อเสนอ กรุณาลองสร้างข้อเสนอใหม่อีกครั้ง",
  "proposal-generation-failed": "ยังสร้างข้อเสนอไม่สำเร็จ กรุณาลองอีกครั้ง",
  "no-safe-proposal": "ยังไม่มี Research Snapshot ที่สดและเพียงพอสำหรับสร้างข้อเสนอ Search intent",
  "research-snapshot-failed": "ยังบันทึกข้อมูลงานวิจัยไม่สำเร็จ กรุณาลองอีกครั้ง",
  "provider-sync-local-required": "ตอนนี้การ Refresh Ubersuggest ต้องทำจาก Local CCPun Admin ที่เชื่อม OAuth ไว้ ส่วน admin.ccpun.com จะอ่าน snapshot ล่าสุดจาก Sanity",
  "provider-auth-required": "Ubersuggest ต้องเชื่อมบัญชีใหม่ก่อนจึงจะดึงข้อมูลได้",
  "provider-project-not-found": "ไม่พบ project ccpun.com ในบัญชี Ubersuggest ที่เชื่อมอยู่",
  "provider-rate-limited": "ระบบชะลอการเรียก Ubersuggest เพื่อรักษา quota กรุณาใช้ snapshot ล่าสุดก่อน",
  "provider-timeout": "Ubersuggest ใช้เวลาตอบนานเกินกำหนด ระบบยังไม่ได้เขียน snapshot ใหม่",
  "provider-invalid-response": "รูปแบบข้อมูลจาก Ubersuggest ไม่ตรง contract ระบบจึงไม่บันทึกข้อมูลชุดนี้",
  "provider-tool-failed": "Ubersuggest ยังตอบข้อมูลชุดนี้ไม่สำเร็จ ระบบจะเก็บ snapshot เดิมไว้",
  "research-write-not-configured": "ช่องทางบันทึก Research Snapshot ยังไม่พร้อม จึงไม่ดึง provider เพื่อป้องกันข้อมูลหายและใช้ quota โดยไม่จำเป็น",
  "mutation-failed": "ยังบันทึกการเปลี่ยนแปลงไม่สำเร็จ กรุณาลองอีกครั้ง",
};

export function roleLabel(role: AdminRole): string {
  return ROLE_LABELS[role];
}

export function proposalStatusLabel(status: string | null | undefined): string {
  return status ? (PROPOSAL_STATUS_LABELS[status] ?? "สถานะไม่ทราบ") : "สถานะไม่ทราบ";
}

export function contentReviewStatusLabel(status: string | null | undefined): string {
  return status ? (CONTENT_REVIEW_STATUS_LABELS[status] ?? "ไม่รู้จักขั้นตรวจนี้") : "ยังไม่มีข้อมูลการตรวจ";
}

export function riskLabel(risk: string | null | undefined): string {
  return risk ? (RISK_LABELS[risk] ?? "ไม่ทราบ") : "ไม่ระบุ";
}

export function proposalTypeLabel(type: string | null | undefined): string {
  return type ? (PROPOSAL_TYPE_LABELS[type] ?? "ข้อเสนอ SEO") : "ข้อเสนอ SEO";
}

export function connectionLabel(
  ready: boolean,
  kind: "read" | "write" | "studio",
  environment = process.env.NEXT_PUBLIC_CCPUN_APP_ENV,
): string {
  const lane = environment === "local-production" || environment === "production-admin" ? "Production" : "UAT";
  if (kind === "studio") return ready ? `แก้ฉบับร่าง ${lane} ใน Studio ได้` : "ปิดการแก้ฉบับร่างไว้เพื่อความปลอดภัย";
  if (ready) return kind === "read" ? `อ่านข้อมูล ${lane} ได้` : `บันทึกฉบับร่าง ${lane} ได้`;
  return kind === "read" ? "ยังอ่านข้อมูลไม่ได้" : "ปิดการบันทึกไว้เพื่อความปลอดภัย";
}

export function environmentLabel(environment: string): string {
  if (environment === "development") return "เครื่องทดสอบภายใน";
  if (environment === "local-uat") return "Local UAT บน Mac";
  if (environment === "local-production") return "Local Production บน Mac (ข้อมูลจริง)";
  if (environment === "lab") return "ห้องทดลองหลัก";
  if (environment === "uat") return "ระบบทดสอบ UAT";
  if (environment === "admin-uat") return "ระบบหลังบ้าน UAT";
  if (environment === "production-admin") return "ระบบหลังบ้าน Production (ข้อมูลจริง)";
  if (environment === "production") return "ระบบจริง Production";
  return "ยังยืนยันสภาพแวดล้อมไม่ได้";
}

export function adminDataLaneLabel(
  environment = process.env.NEXT_PUBLIC_CCPUN_APP_ENV,
): string {
  return environment === "production-admin" || environment === "local-production"
    ? "Production Draft (ข้อมูลจริง)"
    : "UAT";
}

export function friendlyApiError(code: unknown): string {
  return typeof code === "string" && API_ERROR_MESSAGES[code]
    ? API_ERROR_MESSAGES[code]
    : "ระบบยังทำรายการนี้ไม่สำเร็จ กรุณาลองอีกครั้ง";
}

export function friendlyApiErrorFromPayload(payload: unknown): string {
  const code = payload && typeof payload === "object" && "error" in payload ? payload.error : null;
  return friendlyApiError(code);
}
