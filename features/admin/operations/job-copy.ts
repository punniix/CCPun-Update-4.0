export function ownerAgentJobKindLabel(kind: string): string {
  if (kind === "exports.google_sheet · export.google_sheet") return "Google Sheet Export";
  if (kind === "seo.cluster.uat · seo.cluster.uat") return "จัดกลุ่มคำค้น SEO · UAT";
  return "Agent OS Workflow";
}

export function ownerJobStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    queued: "รอคิว", scheduled: "รอตามเวลาที่ตั้ง", preparing: "กำลังเตรียมงาน",
    running: "กำลังทำงาน", processing: "กำลังทำงาน", executing: "กำลังทำงาน",
    waiting_external: "กำลังรอระบบภายนอก", waiting_ai: "กำลังรอ AI",
    validating: "กำลังตรวจผล", awaiting_review: "รอคุณตรวจ", retrying: "กำลังลองใหม่",
    completed: "เสร็จแล้ว", succeeded: "เสร็จแล้ว", published: "เผยแพร่แล้ว", validated: "ตรวจผ่านแล้ว",
    failed: "ไม่สำเร็จ", cancelled: "ยกเลิกแล้ว",
    reconciliation_required: "ต้องตรวจผลกับระบบภายนอก",
    "reconciliation-required": "ต้องตรวจผลกับระบบภายนอก",
  };
  return Object.hasOwn(labels, status) ? labels[status] : "ยังไม่รู้สถานะ ต้องตรวจ";
}

export function safeN8nExecutionId(value: string | null | undefined) {
  return value && /^[1-9][0-9]{0,19}$/.test(value) ? value : null;
}

export function safeJobErrorCode(value: string | null | undefined) {
  const known = ["EXECUTION_OUTCOME_UNKNOWN", "n8n-callback-timeout", "worker-failure"];
  return value && known.includes(value) ? value : null;
}
