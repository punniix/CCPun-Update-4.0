import { type EmailDigestContent } from "./email-digest-model";

/**
 * Email-safe rendering of a monthly digest (table layout, inline styles, no
 * images, no scripts, no tracking pixels, links point at canonical URLs as-is).
 * The worker replaces UNSUBSCRIBE_PLACEHOLDER per recipient at send time;
 * Admin never sees recipients.
 */
export const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
export const EMAIL_DIGEST_SENDER_NAME = "ประกันที่ปั้นเลือก กับ CCPun";
export const EMAIL_DIGEST_SENDER_LINE = "ส่งโดย ประกันที่ปั้นเลือก กับ CCPun · ccpun.com";
export const EMAIL_DIGEST_REASON_LINE = "คุณได้รับอีเมลนี้เพราะสมัครรับสรุปบทความรายเดือนจาก ccpun.com";
export const EMAIL_DIGEST_UNSUBSCRIBE_LABEL = "ยกเลิกการรับอีเมล";

// Website v5 light palette (see --v5-* tokens): warm paper, dark ink, gold accent.
const V5 = {
  bg: "#faf6f0",
  card: "#fffdf9",
  text: "#251818",
  muted: "#5f4c4c",
  border: "#dccdb9",
  goldText: "#7a5c14",
  band: "#e0c985",
  onBand: "#251818",
} as const;

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

export function thaiMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return `${THAI_MONTHS[monthNumber - 1] ?? month} ${year + 543}`;
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function paragraphs(text: string, style: string) {
  return text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
    .map((block) => `<p style="${style}">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`).join("");
}

const FONT = "font-family:'Noto Sans Thai','Sarabun',Tahoma,Arial,sans-serif;";

export function renderEmailDigestHtml(content: Pick<EmailDigestContent, "month" | "subject" | "preheader" | "intro" | "closing" | "articles">) {
  const items = content.articles.map((article, index) => `
<tr><td style="padding:14px 0;border-top:1px solid ${V5.border};${FONT}">
<p style="margin:0 0 4px;font-size:12px;color:${V5.muted};">บทความที่ ${index + 1}</p>
<a href="${escapeHtml(article.canonicalUrl)}" style="font-size:17px;line-height:1.5;font-weight:600;color:${V5.text};text-decoration:underline;text-decoration-color:${V5.band};">${escapeHtml(article.title)}</a>
<p style="margin:6px 0 0;font-size:13px;"><a href="${escapeHtml(article.canonicalUrl)}" style="color:${V5.goldText};">อ่านบทความ</a></p>
</td></tr>`).join("");
  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:0;background:${V5.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${V5.bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${V5.card};border:1px solid ${V5.border};border-radius:12px;">
<tr><td style="background:${V5.band};color:${V5.onBand};padding:14px 24px;border-radius:12px 12px 0 0;${FONT}font-size:13px;font-weight:600;">สรุปบทความประจำเดือน${escapeHtml(thaiMonthLabel(content.month))}</td></tr>
<tr><td style="padding:24px;${FONT}color:${V5.text};">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.4;color:${V5.text};">${escapeHtml(content.subject)}</h1>
${paragraphs(content.intro, `margin:0 0 14px;font-size:15px;line-height:1.7;color:${V5.text};`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
${content.closing ? paragraphs(content.closing, `margin:18px 0 0;font-size:15px;line-height:1.7;color:${V5.text};`) : ""}
</td></tr>
<tr><td style="padding:16px 24px 22px;border-top:1px solid ${V5.border};${FONT}font-size:12px;line-height:1.6;color:${V5.muted};">
<p style="margin:0 0 6px;">${escapeHtml(EMAIL_DIGEST_SENDER_LINE)}</p>
<p style="margin:0 0 6px;">${escapeHtml(EMAIL_DIGEST_REASON_LINE)}</p>
<p style="margin:0;"><a href="${UNSUBSCRIBE_PLACEHOLDER}" style="color:${V5.goldText};">${EMAIL_DIGEST_UNSUBSCRIBE_LABEL}</a></p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

export function renderEmailDigestText(content: Pick<EmailDigestContent, "month" | "subject" | "intro" | "closing" | "articles">) {
  return [
    `สรุปบทความประจำเดือน${thaiMonthLabel(content.month)}`,
    content.subject,
    "",
    content.intro,
    "",
    ...content.articles.map((article, index) => `${index + 1}. ${article.title}\n   ${article.canonicalUrl}`),
    ...(content.closing ? ["", content.closing] : []),
    "",
    "--",
    EMAIL_DIGEST_SENDER_LINE,
    EMAIL_DIGEST_REASON_LINE,
    `${EMAIL_DIGEST_UNSUBSCRIBE_LABEL}: ${UNSUBSCRIBE_PLACEHOLDER}`,
  ].join("\n");
}
