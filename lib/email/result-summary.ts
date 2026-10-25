/**
 * "Send my result by email" (Email phase 1, owner-approved 2026-10-25, behind a flag).
 *
 * The browser sends only allowlisted numeric figures for one tool; the server renders every
 * label and sentence itself. No free text from the request ever reaches an email, so the
 * endpoint cannot be used to relay arbitrary content. These figures go only into the visitor's
 * own email: never to analytics, logs or the database.
 */

export const RESULT_EMAIL_TOOLS = ["ci_planning", "fhc", "investment_allocation"] as const;
export type ResultEmailTool = (typeof RESULT_EMAIL_TOOLS)[number];

type FigureSpec = { label: string; unit: "baht" | "percent" | "count"; required?: boolean };

export const RESULT_EMAIL_FIGURES = {
  ci_planning: {
    totalNeed: { label: "เงินก้อนที่ควรเตรียมเมื่อเจ็บป่วยโรคร้ายแรง", unit: "baht", required: true },
    baseNeed: { label: "ค่าใช้จ่ายและภาระช่วงรักษาตัว", unit: "baht" },
    recoveryReserve: { label: "Recovery Reserve", unit: "baht" },
    protectedAssets: { label: "เงินที่ตั้งใจกันไว้ไม่ให้ต้องนำมาใช้", unit: "baht" },
    gap: { label: "ส่วนที่ยังขาด", unit: "baht" },
    surplus: { label: "ส่วนที่เกิน", unit: "baht" },
  },
  fhc: {
    gap: { label: "ช่องว่างความคุ้มครองเบื้องต้น", unit: "baht", required: true },
    familySupport: { label: "ค่าใช้จ่ายครอบครัวตามช่วงเวลาที่เลือก", unit: "baht" },
    debtAndEducation: { label: "หนี้และทุนการศึกษาบุตร", unit: "baht" },
    resources: { label: "ทุนประกันชีวิตและสินทรัพย์ที่พร้อมใช้", unit: "baht" },
  },
  investment_allocation: {
    planAmount: { label: "เงินในแผน", unit: "baht", required: true },
    fundCount: { label: "จำนวนกองที่เลือก", unit: "count" },
    assetKnownPercent: { label: "สัดส่วนที่ระบุสินทรัพย์ได้", unit: "percent" },
    equityPercent: { label: "หุ้น", unit: "percent" },
    fixedIncomePercent: { label: "ตราสารหนี้", unit: "percent" },
    cashPercent: { label: "เงินฝาก / ตลาดเงิน", unit: "percent" },
    otherPercent: { label: "สินทรัพย์อื่น", unit: "percent" },
    unknownPercent: { label: "ยังระบุไม่ได้", unit: "percent" },
  },
} as const satisfies Record<ResultEmailTool, Record<string, FigureSpec>>;

export type ResultEmailFigures<T extends ResultEmailTool = ResultEmailTool> = Partial<Record<keyof (typeof RESULT_EMAIL_FIGURES)[T], number>>;

export const RESULT_EMAIL_TOOL_META: Record<ResultEmailTool, { name: string; path: string; disclaimer: string }> = {
  ci_planning: {
    name: "วางแผนเงินก้อนโรคร้ายแรง",
    path: "/ci-planning/",
    disclaimer: "ผลลัพธ์เป็นประมาณการเบื้องต้นจากข้อมูลที่คุณกรอก ไม่ใช่คำแนะนำเฉพาะบุคคล โปรดศึกษารายละเอียดความคุ้มครอง เงื่อนไข และข้อยกเว้นก่อนตัดสินใจ",
  },
  fhc: {
    name: "ตรวจสุขภาพการเงิน",
    path: "/tools/financial-health-check/",
    disclaimer: "ผลลัพธ์เป็นประมาณการเบื้องต้นจากข้อมูลที่คุณกรอก ไม่ใช่คำแนะนำเฉพาะบุคคล ไม่รับรองว่าจำนวนเงินนี้จะเพียงพอในทุกกรณี และประกันไม่ใช่เงินฝาก",
  },
  investment_allocation: {
    name: "วางแผนกองทุน",
    path: "/tools/investment-allocation/",
    // The two approved Investment Allocation statements (features/investment-allocation/domain/copy.ts), verbatim.
    disclaimer: "การลงทุนมีความเสี่ยง ผู้ลงทุนควรทำความเข้าใจลักษณะสินค้า เงื่อนไขผลตอบแทน และความเสี่ยงก่อนตัดสินใจลงทุน ข้อมูลในเครื่องมือนี้ไม่ใช่คำแนะนำการลงทุน และไม่ได้รับประกันผลตอบแทนหรือเงินต้น ผลการดำเนินงานในอดีตไม่ได้เป็นสิ่งยืนยันถึงผลการดำเนินงานในอนาคต",
  },
};

const MAX_BAHT = 100_000_000_000;
export const RESULT_EMAIL_MAX_LENGTH = 254;
// Deliberately plain: one @, a dot in the domain, no spaces, quotes or angle brackets.
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function normalizeResultEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > RESULT_EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) return null;
  if (email.split("@")[0].startsWith(".") || email.includes("..")) return null;
  return email;
}

export function isResultEmailTool(value: unknown): value is ResultEmailTool {
  return typeof value === "string" && (RESULT_EMAIL_TOOLS as readonly string[]).includes(value);
}

function validFigure(unit: FigureSpec["unit"], value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return false;
  if (unit === "baht") return value <= MAX_BAHT;
  if (unit === "percent") return value <= 100;
  return Number.isInteger(value) && value <= 1000;
}

/** Strict: unknown keys, non-numbers, out-of-range values or a missing required figure reject the whole set. */
export function parseResultFigures(tool: ResultEmailTool, input: unknown): ResultEmailFigures | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const specs = RESULT_EMAIL_FIGURES[tool] as Record<string, FigureSpec>;
  const figures: Record<string, number> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const spec = Object.hasOwn(specs, key) ? specs[key] : undefined;
    if (!spec || !validFigure(spec.unit, value)) return null;
    figures[key] = spec.unit === "baht" ? Math.round(value) : value;
  }
  for (const [key, spec] of Object.entries(specs)) if (spec.required && !(key in figures)) return null;
  return figures as ResultEmailFigures;
}

export function formatResultFigure(unit: FigureSpec["unit"], value: number): string {
  if (unit === "baht") return `${Math.round(value).toLocaleString("th-TH")} บาท`;
  if (unit === "percent") return `${Math.round(value * 100) / 100}%`;
  return `${value.toLocaleString("th-TH")} กอง`;
}

/** Ordered label/value rows for the email, in the spec order (only figures that are present). */
export function resultEmailRows(tool: ResultEmailTool, figures: ResultEmailFigures): Array<{ label: string; value: string }> {
  const specs = RESULT_EMAIL_FIGURES[tool] as Record<string, FigureSpec>;
  const values = figures as Record<string, number | undefined>;
  return Object.entries(specs)
    .filter(([key]) => typeof values[key] === "number")
    .map(([key, spec]) => ({ label: spec.label, value: formatResultFigure(spec.unit, values[key] as number) }));
}
