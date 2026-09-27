export type N8nAdminIntegrationStatus =
  | "admin-trigger"
  | "background"
  | "unconnected"
  | "test-only"
  | "legacy";

export type N8nAdminIntegration = {
  workflowId: string;
  workflowName: string;
  status: N8nAdminIntegrationStatus;
  adminEntry: string | null;
  adminPath: string | null;
  purpose: string;
  recommendation: string;
  sourceControlled: boolean;
};

export const N8N_ADMIN_INTEGRATIONS: N8nAdminIntegration[] = [
  { workflowId: "NeHFrMsfXcdnVxjU", workflowName: "CCPun — Local AI — LINE Card Copy", status: "admin-trigger", adminEntry: "สร้าง / ปรับข้อความ LINE", adminPath: "/content/articles/", purpose: "สร้างและปรับหัวข้อ/คำโปรย LINE จากบทความ", recommendation: "ใช้งานผ่านปุ่มใน Admin ต่อไป", sourceControlled: true },
  { workflowId: "IBgbhEGfzCcvGFy2", workflowName: "CCPun — Private Chat Screenshot OCR", status: "admin-trigger", adminEntry: "อ่านภาพด้วย Local OCR", adminPath: "/dashboard/inbox/", purpose: "อ่านภาพแคปแชท แล้วให้เจ้าของตรวจข้อความก่อนบันทึก CRM", recommendation: "มีปุ่มแล้ว แต่ต้องตรวจสถานะ n8n ก่อนเปิดใช้จริง", sourceControlled: true },
  { workflowId: "XOQHPkio5WzZIz0l", workflowName: "CCPun — Owner Export to Google Sheets", status: "admin-trigger", adminEntry: "สร้าง Google Sheet", adminPath: "/analytics/exports/", purpose: "สร้าง Google Sheet ผ่าน Agent OS จาก dataset ที่ Admin เตรียมให้", recommendation: "ใช้เป็น workflow กลางสำหรับ Social / SEO / CRM / Operations", sourceControlled: true },
  { workflowId: "HpHQEFLf7k6dKMC3", workflowName: "CCPun — Local AI — SEO Clustering", status: "unconnected", adminEntry: null, adminPath: null, purpose: "จัดกลุ่มคำค้น/ข้อมูล SEO ด้วย Local AI", recommendation: "ควรมีปุ่มจากหน้า SEO/ข้อมูลประกอบ และคืนผลเป็น proposal ให้คนตรวจ", sourceControlled: false },
  { workflowId: "Gn7ghA6RV8ladv56", workflowName: "CCPun — Local AI — Content Preprocess", status: "unconnected", adminEntry: null, adminPath: null, purpose: "เตรียมข้อมูลบทความก่อนส่งต่อขั้นวิเคราะห์", recommendation: "ควรเรียกจากหน้าบทความหรือ Research แทนการรันจาก n8n โดยตรง", sourceControlled: false },
  { workflowId: "bwQcEsfdC0tUOgIA", workflowName: "CCPun — Local AI — Classification & Tagging", status: "unconnected", adminEntry: null, adminPath: null, purpose: "เสนอหมวดหมู่และแท็กให้เนื้อหา", recommendation: "ควรมีปุ่มเสนอหมวดหมู่/แท็กในบทความ และต้องให้คนยืนยันก่อนบันทึก", sourceControlled: false },
  { workflowId: "meJeEg1WOdY7aEPx", workflowName: "CCPun — Local AI — Operations Monitor", status: "background", adminEntry: null, adminPath: "/operations/local-ai/", purpose: "ติดตามสุขภาพและสถานะ Local AI", recommendation: "ควรเป็น background-only และแสดงผลผ่านหน้าสถานะ ไม่ต้องมีปุ่ม Run", sourceControlled: false },
  { workflowId: "F1SCT95FfMwLBD43", workflowName: "CCPun — Contact Form to Sheets + Email", status: "background", adminEntry: null, adminPath: null, purpose: "รับข้อมูลจากฟอร์มสาธารณะแล้วส่งต่อระบบหลังบ้าน", recommendation: "ไม่ต้องมีปุ่ม Admin เพราะ trigger มาจากหน้าเว็บ", sourceControlled: false },
  { workflowId: "IyJfaqUVF6KbnYfy", workflowName: "FHC Lead Capture — CCPun", status: "background", adminEntry: null, adminPath: null, purpose: "รับ Lead จาก Financial Health Check", recommendation: "ไม่ต้องมีปุ่ม Admin เพราะ trigger มาจาก public funnel", sourceControlled: false },
  { workflowId: "ZqCLKTFDeBQFGWx1", workflowName: "CCPun — Local AI Smoke Test", status: "test-only", adminEntry: null, adminPath: null, purpose: "ทดสอบ Local AI bridge แบบ manual", recommendation: "คงเป็น test-only ไม่ต้องมีปุ่ม Production", sourceControlled: false },
  { workflowId: "vTc7XQOrAP1d2SBT", workflowName: "CCPun — Agent OS UAT Bridge Smoke", status: "test-only", adminEntry: null, adminPath: null, purpose: "ทดสอบ Agent OS bridge ใน UAT", recommendation: "คงเป็น UAT/test-only ไม่ต้องมีปุ่ม Production", sourceControlled: false },
  { workflowId: "BQUpRPsK01DV8y5x", workflowName: "CCPun — marketing-report-weekly", status: "legacy", adminEntry: null, adminPath: null, purpose: "รายงานการตลาดรายสัปดาห์จากระบบเดิม", recommendation: "audit/repair validation ก่อนตัดสินใจว่าจะเชื่อม Admin หรือ retire", sourceControlled: false },
  { workflowId: "7gPcVg0cvAHrymeu", workflowName: "CCPun — article-publish", status: "legacy", adminEntry: null, adminPath: null, purpose: "workflow เผยแพร่บทความจากระบบเดิม", recommendation: "ไม่ควรต่อ Admin จนกว่าจะยืนยันว่าไม่ซ้ำ Article Scheduler ปัจจุบัน", sourceControlled: false },
  { workflowId: "JZFpX7rPDbWbLKtQ", workflowName: "CCPun — cost-tracker", status: "legacy", adminEntry: null, adminPath: null, purpose: "ติดตามค่าใช้จ่ายจากระบบเดิม", recommendation: "ตรวจว่าซ้ำกับ Cost/Operations model ปัจจุบันหรือไม่ก่อนใช้งานต่อ", sourceControlled: false },
  { workflowId: "GQ7nwqvjNVB03LZm", workflowName: "CCPun — daily-report", status: "legacy", adminEntry: null, adminPath: null, purpose: "รายงานประจำวันจากระบบเดิม", recommendation: "พิจารณา retire หรือรวมเข้า Dashboard/Automation report ปัจจุบัน", sourceControlled: false },
  { workflowId: "q6mhnjGoyRXK3oU0", workflowName: "CCPun — weekly-content-reminder", status: "legacy", adminEntry: null, adminPath: null, purpose: "เตือนงานคอนเทนต์รายสัปดาห์", recommendation: "ตรวจความซ้ำกับ Content Calendar ก่อนเชื่อมใหม่", sourceControlled: false },
  { workflowId: "cr8wUTdpGuRYGLQ6", workflowName: "CCPun — social-post", status: "legacy", adminEntry: null, adminPath: null, purpose: "ส่งโพสต์โซเชียลจากระบบเดิม", recommendation: "ไม่ควรต่อ Admin เพราะมี Social Queue/Calendar ปัจจุบันอยู่แล้ว", sourceControlled: false },
  { workflowId: "5LWabOJmPsquxxm1", workflowName: "CCPun — content-ai-tools", status: "legacy", adminEntry: null, adminPath: null, purpose: "ชุดเครื่องมือ AI สำหรับคอนเทนต์รุ่นเดิม", recommendation: "audit ก่อนใช้งานต่อ เพราะมี Local AI pipeline ชุดใหม่แล้ว", sourceControlled: false },
  { workflowId: "ORGmkqYQkVNG7wme", workflowName: "CCPun — ads-monitoring", status: "legacy", adminEntry: null, adminPath: null, purpose: "ติดตามโฆษณาจากระบบเดิม", recommendation: "ยังไม่ควรต่อ Admin จนกว่าจะมี owner-facing Ads model ที่ชัดเจน", sourceControlled: false },
  { workflowId: "mDSHSABsn2zA39UM", workflowName: "CCPun — monthly-cost-report", status: "legacy", adminEntry: null, adminPath: null, purpose: "รายงานค่าใช้จ่ายรายเดือนจากระบบเดิม", recommendation: "ตรวจความซ้ำกับ Cost/Operations model ก่อนตัดสินใจใช้งานต่อ", sourceControlled: false },
];

export const N8N_ADMIN_STATUS_LABEL: Record<N8nAdminIntegrationStatus, string> = {
  "admin-trigger": "มีปุ่มใน Admin",
  background: "ทำงานเบื้องหลัง",
  unconnected: "ยังไม่มีปุ่มใน Admin",
  "test-only": "ใช้ทดสอบเท่านั้น",
  legacy: "Legacy / รอตัดสินใจ",
};

export function n8nAdminIntegrationSummary() {
  return N8N_ADMIN_INTEGRATIONS.reduce<Record<N8nAdminIntegrationStatus, number>>((summary, item) => {
    summary[item.status] += 1;
    return summary;
  }, { "admin-trigger": 0, background: 0, unconnected: 0, "test-only": 0, legacy: 0 });
}
