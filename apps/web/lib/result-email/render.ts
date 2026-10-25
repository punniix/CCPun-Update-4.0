import "server-only";

import {
  RESULT_EMAIL_TOOL_META,
  resultEmailRows,
  type ResultEmailFigures,
  type ResultEmailTool,
} from "../../../../lib/email/result-summary";

const LINE_URL = "https://lin.ee/tqLCs4f";
export const DOI_TOKEN_TTL_DAYS = 7;

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

const FONT = "Kanit,'Noto Sans Thai',Tahoma,Arial,sans-serif";

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;border-radius:14px;background:#e0c985;color:#251818;font-weight:600;text-decoration:none">${escapeHtml(label)}</a>`;
}

export type RenderedEmail = { subject: string; html: string; text: string };

/**
 * The visitor's own result email. Every sentence and label is server-owned; the request supplies
 * only validated numbers (lib/email/result-summary.ts). A confirmation block appears only when the
 * visitor ticked the separate monthly-digest checkbox.
 */
export function renderResultEmail(input: { tool: ResultEmailTool; figures: ResultEmailFigures; origin: string; confirmUrl?: string }): RenderedEmail {
  const meta = RESULT_EMAIL_TOOL_META[input.tool];
  const rows = resultEmailRows(input.tool, input.figures);
  const toolUrl = `${input.origin}${meta.path}`;
  const subject = `ผล${meta.name}ที่คุณขอให้ส่ง | CCPun`;
  const intro = "นี่คือผลที่คุณคำนวณบน ccpun.com ตัวเลขทั้งหมดมาจากข้อมูลที่คุณกรอกเอง";
  const lineNote = "อยากให้ผมช่วยดูผลนี้ต่อ ทักมาทาง LINE @ccpun ได้";
  const confirmTitle = "ยืนยันการรับสรุปรายเดือน";
  const confirmBody = `คุณเลือกรับสรุปบทความรายเดือนทางอีเมล กดปุ่มด้านล่างเพื่อยืนยัน ถ้าไม่กด จะไม่มีการส่งสรุปรายเดือน ลิงก์นี้ใช้ได้ ${DOI_TOKEN_TTL_DAYS} วัน`;
  const footer = `คุณได้รับอีเมลนี้เพราะกดส่งผลจากหน้า${meta.name}บน ccpun.com ถ้าไม่ได้เป็นคนขอ ไม่ต้องทำอะไร`;

  const tableRows = rows.map((row) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e9dfd2;color:#5f4c4c">${escapeHtml(row.label)}</td><td style="padding:10px 0;border-bottom:1px solid #e9dfd2;text-align:right;font-weight:600;white-space:nowrap">${escapeHtml(row.value)}</td></tr>`).join("");
  const confirmHtml = input.confirmUrl
    ? `<div style="margin-top:28px;padding:20px;border:1px solid #dccdb9;border-radius:14px;background:#fffdf9"><h2 style="margin:0 0 8px;font-size:18px">${escapeHtml(confirmTitle)}</h2><p style="margin:0 0 16px;color:#5f4c4c;line-height:1.7">${escapeHtml(confirmBody)}</p>${button(input.confirmUrl, "ยืนยันรับสรุปรายเดือน")}</div>`
    : "";
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>`
    + `<body style="margin:0;padding:0;background:#faf6f0;color:#251818;font-family:${FONT}">`
    + `<div style="max-width:560px;margin:0 auto;padding:32px 20px">`
    + `<p style="margin:0 0 24px;font-size:20px;font-weight:600"><span style="color:#251818">CC</span><span style="color:#7a5c14">Pun</span></p>`
    + `<h1 style="margin:0 0 8px;font-size:22px;line-height:1.4">ผลจากเครื่องมือ${escapeHtml(meta.name)}</h1>`
    + `<p style="margin:0 0 20px;color:#5f4c4c;line-height:1.7">${escapeHtml(intro)}</p>`
    + `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px">${tableRows}</table>`
    + `<p style="margin:20px 0;color:#5f4c4c;font-size:14px;line-height:1.7">${escapeHtml(meta.disclaimer)}</p>`
    + `<p style="margin:0 0 12px">${button(toolUrl, "กลับไปที่เครื่องมือ")}</p>`
    + `<p style="margin:16px 0 0;line-height:1.7">${escapeHtml(lineNote)} <a href="${LINE_URL}" style="color:#7a5c14">${LINE_URL}</a></p>`
    + confirmHtml
    + `<p style="margin:32px 0 0;color:#5f4c4c;font-size:13px;line-height:1.7">${escapeHtml(footer)}</p>`
    + `</div></body></html>`;

  const text = [
    `ผลจากเครื่องมือ${meta.name}`,
    intro,
    "",
    ...rows.map((row) => `${row.label}: ${row.value}`),
    "",
    meta.disclaimer,
    "",
    `กลับไปที่เครื่องมือ: ${toolUrl}`,
    `${lineNote} ${LINE_URL}`,
    ...(input.confirmUrl ? ["", confirmTitle, confirmBody, input.confirmUrl] : []),
    "",
    footer,
  ].join("\n");
  return { subject, html, text };
}
