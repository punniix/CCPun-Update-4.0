import { normalizeLiquidity } from "../domain/calculation";
import type { PlanningFund } from "../domain/types";

const FETCHED_AT = "2026-09-17T00:00:00.000Z";
const SOURCE_DATE = "2026-09-01";

function demoFund(input: Omit<PlanningFund, "id" | "provenance" | "liquidity"> & { id: string; liquidityText: string | null; notes?: string[]; state?: "demo" | "partial" }): PlanningFund {
  const { id, liquidityText, notes = [], state = "demo", ...fund } = input;
  return {
    ...fund,
    id,
    liquidity: {
      rawText: liquidityText,
      normalized: normalizeLiquidity(liquidityText),
      sourceDate: liquidityText ? SOURCE_DATE : null,
    },
    provenance: {
      source: "uat_synthetic",
      snapshotIds: [`uat-synthetic:${id}:2026-09-17`],
      sourceDate: SOURCE_DATE,
      fetchedAt: FETCHED_AT,
      state,
      notes: ["ข้อมูลสังเคราะห์สำหรับทดสอบ UAT เท่านั้น ไม่ใช่ข้อมูลกองทุนจริงจาก ก.ล.ต.", ...notes],
    },
  };
}

export const UAT_SYNTHETIC_FUNDS: PlanningFund[] = [
  demoFund({
    id: "uat-mixed-01",
    projectId: "UAT-MIXED-01",
    className: "UAT-MIX-A",
    name: "UAT กองผสมตัวอย่าง A",
    shortName: "UAT-MIX-A",
    constructionBucket: "mixed",
    policyText: "ข้อมูลสังเคราะห์: กองผสมสำหรับทดสอบการแตกองค์ประกอบสินทรัพย์",
    riskSpectrum: 5,
    assetAllocation: [
      { asset: "equity", percent: 50, label: "หุ้น (UAT)", sourceDate: SOURCE_DATE },
      { asset: "fixed_income", percent: 40, label: "ตราสารหนี้ (UAT)", sourceDate: SOURCE_DATE },
      { asset: "cash", percent: 10, label: "เงินฝาก/เงินสด (UAT)", sourceDate: SOURCE_DATE },
    ],
    liquidityText: "T+2",
    feeSummary: null,
    masterFund: null,
  }),
  demoFund({
    id: "uat-equity-01",
    projectId: "UAT-EQUITY-01",
    className: "UAT-EQ-A",
    name: "UAT กองหุ้นตัวอย่าง A",
    shortName: "UAT-EQ-A",
    constructionBucket: "equity",
    policyText: "ข้อมูลสังเคราะห์: กองหุ้นสำหรับทดสอบ UAT",
    riskSpectrum: 6,
    assetAllocation: [
      { asset: "equity", percent: 96, label: "หุ้น (UAT)", sourceDate: SOURCE_DATE },
      { asset: "cash", percent: 4, label: "เงินฝาก/เงินสด (UAT)", sourceDate: SOURCE_DATE },
    ],
    liquidityText: "T+3",
    feeSummary: null,
    masterFund: null,
  }),
  demoFund({
    id: "uat-fixed-01",
    projectId: "UAT-FIXED-01",
    className: "UAT-FI-A",
    name: "UAT กองตราสารหนี้ตัวอย่าง A",
    shortName: "UAT-FI-A",
    constructionBucket: "fixed_income",
    policyText: "ข้อมูลสังเคราะห์: กองตราสารหนี้สำหรับทดสอบ UAT",
    riskSpectrum: 4,
    assetAllocation: [
      { asset: "fixed_income", percent: 94, label: "ตราสารหนี้ (UAT)", sourceDate: SOURCE_DATE },
      { asset: "cash", percent: 6, label: "เงินฝาก/เงินสด (UAT)", sourceDate: SOURCE_DATE },
    ],
    liquidityText: "T+2",
    feeSummary: null,
    masterFund: null,
  }),
  demoFund({
    id: "uat-money-01",
    projectId: "UAT-MONEY-01",
    className: "UAT-MM-A",
    name: "UAT กองตลาดเงินตัวอย่าง A",
    shortName: "UAT-MM-A",
    constructionBucket: "money_market",
    policyText: "ข้อมูลสังเคราะห์: กองตลาดเงินสำหรับทดสอบ UAT",
    riskSpectrum: 2,
    assetAllocation: [
      { asset: "cash", percent: 80, label: "เงินฝาก/ตลาดเงิน (UAT)", sourceDate: SOURCE_DATE },
      { asset: "fixed_income", percent: 20, label: "ตราสารหนี้ระยะสั้น (UAT)", sourceDate: SOURCE_DATE },
    ],
    liquidityText: "T+1",
    feeSummary: null,
    masterFund: null,
  }),
  demoFund({
    id: "uat-partial-01",
    projectId: "UAT-PARTIAL-01",
    className: "UAT-PARTIAL-A",
    name: "UAT กองข้อมูลไม่ครบตัวอย่าง",
    shortName: "UAT-PARTIAL-A",
    constructionBucket: "mixed",
    policyText: "ข้อมูลสังเคราะห์: ใช้ทดสอบ partial / unavailable state",
    riskSpectrum: null,
    assetAllocation: [
      { asset: "equity", percent: 35, label: "หุ้นที่ระบุได้ (UAT)", sourceDate: SOURCE_DATE },
      { asset: "fixed_income", percent: 25, label: "ตราสารหนี้ที่ระบุได้ (UAT)", sourceDate: SOURCE_DATE },
    ],
    liquidityText: null,
    feeSummary: null,
    masterFund: null,
    state: "partial",
    notes: ["มีเพียง 60% ขององค์ประกอบสินทรัพย์ที่ระบุได้ เพื่อทดสอบ unknown coverage"],
  }),
  demoFund({
    id: "uat-other-01",
    projectId: "UAT-OTHER-01",
    className: "UAT-OTHER-A",
    name: "UAT กองสินทรัพย์อื่นตัวอย่าง",
    shortName: "UAT-OTHER-A",
    constructionBucket: "other",
    policyText: "ข้อมูลสังเคราะห์: หมวดอื่นสำหรับทดสอบ UAT",
    riskSpectrum: 7,
    assetAllocation: [{ asset: "other", percent: 100, label: "สินทรัพย์อื่น (UAT)", sourceDate: SOURCE_DATE }],
    liquidityText: "รับเงินตามเงื่อนไขกองทุน",
    feeSummary: null,
    masterFund: null,
  }),
];

export function searchDemoFunds(query: string): PlanningFund[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return UAT_SYNTHETIC_FUNDS.filter((fund) => {
    const haystack = `${fund.name} ${fund.shortName} ${fund.projectId}`.toLowerCase();
    return haystack.includes(normalized) || normalized === "uat" || normalized === "demo" || normalized === "ตัวอย่าง";
  });
}
