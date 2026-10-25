// v5 motion round (UAT): microcopy and owner-approved data for the flip credential cards.
// New labels are pending owner approval; the AFPT™ facts are owner-approved (ปั้น, 2026-10-25).
export const V5_LICENCE_FLIP_HINT = "ดูวิธีตรวจสอบ";
export const V5_CREDENTIAL_FLIP_HINT = "ดูรายละเอียด";
export const V5_LICENCE_NUMBER_LABEL = "เลขที่ใบอนุญาต";
// UAT-only placeholder until the owner approves the verification wording (no regulator URL is invented).
export const V5_LICENCE_VERIFY_PLACEHOLDER = "UAT: รอข้อความวิธีตรวจสอบที่เจ้าของอนุมัติ";

export type V5FlipLine = { label: string; value: string; repeatsFront?: boolean };

// Always "AFPT™" in uppercase with the mark; it names a credential, never a person ("เป็น AFPT" is wrong).
export const V5_AFPT_CARD = Object.freeze({
  term: "AFPT™",
  detail: "Associate Financial Planner (Thailand)",
  back: Object.freeze([
    { label: "ออกโดย", value: "สมาคมนักวางแผนการเงินไทย (TFPA)" },
    { label: "เลขที่ใบรับรอง", value: "AFPT260195" },
    { label: "ใช้ได้ถึง", value: "31 ธ.ค. 2571" },
  ]) as readonly V5FlipLine[],
});
