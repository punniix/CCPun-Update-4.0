// Customer-facing copy shared by both builders and the API rate limiter.

// Standard Thai investment-risk statement shown next to every result.
export const INVESTMENT_RISK_STATEMENT =
  "การลงทุนมีความเสี่ยง ผู้ลงทุนควรทำความเข้าใจลักษณะสินค้า เงื่อนไขผลตอบแทน และความเสี่ยงก่อนตัดสินใจลงทุน";

// Not-advice / no-guarantee statement for the page's data-scope section. The tool
// shows no returns, but customers may still read fund facts as an endorsement.
export const INVESTMENT_NO_GUARANTEE_STATEMENT =
  "ข้อมูลในเครื่องมือนี้ไม่ใช่คำแนะนำการลงทุน และไม่ได้รับประกันผลตอบแทนหรือเงินต้น ผลการดำเนินงานในอดีตไม่ได้เป็นสิ่งยืนยันถึงผลการดำเนินงานในอนาคต";

// Returned by /api/investment-allocation/* with HTTP 429 and shown by the builders.
export const RATE_LIMIT_MESSAGE = "มีการค้นหาถี่เกินไป กรุณาลองใหม่อีกสักครู่";

// Builders throw `Error("<endpoint>_<status>")` for non-OK responses.
export function requestFailureMessage(error: unknown, fallback: string): string {
  return error instanceof Error && /_429$/.test(error.message) ? RATE_LIMIT_MESSAGE : fallback;
}
