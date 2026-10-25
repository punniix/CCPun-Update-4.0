import "server-only";

import { escapeHtml } from "./render";

// Minimal, self-contained pages for the email links. They load no analytics or third-party script
// (a token in the URL must never reach a tag), send no referrer and are never indexed.
const OUTCOMES = {
  confirmed: { title: "ยืนยันเรียบร้อย", body: "คุณจะได้รับสรุปบทความเดือนละครั้ง ยกเลิกได้ทุกเมื่อจากลิงก์ในอีเมล" },
  unsubscribed: { title: "ยกเลิกรับแล้ว", body: "ผมจะไม่ส่งสรุปรายเดือนไปที่อีเมลนี้อีก" },
  expired: { title: "ลิงก์หมดอายุแล้ว", body: "ส่งผลจากเครื่องมืออีกครั้งแล้วติ๊กรับสรุปรายเดือน จะได้ลิงก์ยืนยันใหม่" },
  invalidLink: { title: "ลิงก์นี้ใช้ไม่ได้", body: "ลิงก์อาจไม่ครบหรือถูกใช้ไปแล้ว ลองเปิดจากอีเมลอีกครั้ง" },
  unavailable: { title: "ระบบยังไม่พร้อม", body: "ลองใหม่อีกครั้งภายหลัง" },
  tooMany: { title: "เปิดถี่เกินไป", body: "ลองใหม่อีกครั้งภายหลัง" },
} as const;

function layout(title: string, inner: string): string {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>${escapeHtml(title)} | CCPun</title>`
    + `<style>body{margin:0;background:#251818;color:#faf9f9;font-family:Kanit,'Noto Sans Thai',Tahoma,Arial,sans-serif;line-height:1.7}`
    + `main{max-width:520px;margin:0 auto;padding:64px 20px}h1{font-size:26px;font-weight:500;margin:0 0 12px}p{color:#baabab;margin:0 0 24px}`
    + `.brand{font-size:22px;font-weight:500;margin-bottom:40px;color:#faf9f9;text-decoration:none;display:inline-block}.brand span{color:#e0c985}`
    + `button,.link{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 28px;border-radius:14px;font:inherit;font-weight:500;cursor:pointer;text-decoration:none}`
    + `button{background:#e0c985;color:#251818;border:1px solid #e0c985}.link{color:#faf9f9;border:1px solid #5b4848}`
    + `:focus-visible{outline:3px solid #e0c985;outline-offset:3px}`
    + `@media (prefers-color-scheme:light){body{background:#faf6f0;color:#251818}p{color:#5f4c4c}.brand{color:#251818}.brand span{color:#7a5c14}.link{color:#251818;border-color:#dccdb9}:focus-visible{outline-color:#7a5c14}}</style>`
    + `</head><body><main><a class="brand" href="/">CC<span>Pun</span></a>${inner}</main></body></html>`;
}

export function confirmPage(token: string): string {
  return layout("ยืนยันรับสรุปรายเดือน", `<h1>ยืนยันรับสรุปรายเดือน</h1><p>กดปุ่มด้านล่างเพื่อยืนยันว่าอยากรับสรุปบทความจาก CCPun เดือนละครั้งทางอีเมล</p>`
    + `<form method="post" action="/api/result-email/confirm/"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">ยืนยันรับสรุปรายเดือน</button></form>`);
}

export function unsubscribePage(token: string): string {
  return layout("ยกเลิกรับสรุปรายเดือน", `<h1>ยกเลิกรับสรุปรายเดือน</h1><p>กดปุ่มด้านล่างแล้วผมจะหยุดส่งสรุปรายเดือนไปที่อีเมลนี้</p>`
    + `<form method="post" action="/api/result-email/unsubscribe/"><input type="hidden" name="u" value="${escapeHtml(token)}"><button type="submit">ยกเลิกรับ</button></form>`);
}

export function outcomePage(outcome: keyof typeof OUTCOMES): string {
  const { title, body } = OUTCOMES[outcome];
  return layout(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p><a class="link" href="/">กลับหน้าแรก</a>`);
}
