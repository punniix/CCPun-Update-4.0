/**
 * Ratio benchmarks for the financial planning room (decision F2).
 *
 * This is the ONLY place these numbers live. Every value cites a public Thai
 * source and stays marked "รอปั้นยืนยันตัวเลข" until ปั้น checks it against the
 * Thai CFP curriculum (Module 1, financial statements and ratios) he studied.
 * Changing a number here changes every household's ratio status, so keep each
 * edit to one reviewed commit that also updates `confirmation`.
 *
 * Rules:
 * - `goodMin`/`goodMax`: the value meets the benchmark.
 * - `watchMin`/`watchMax`: only where the source itself gives a range; inside
 *   the range is "ควรระวัง". Outside both is "ควรปรับ".
 * - No band is invented beyond what the cited source states.
 */

export const FA_BENCHMARK_PENDING = "รอปั้นยืนยันตัวเลข" as const;
export const FA_BENCHMARK_SET_VERSION = "2026-10-25-draft" as const;

export type FaBenchmarkSource = {
  title: string;
  publisher: string;
  url: string;
  /** The exact Thai wording the number comes from. */
  quote: string;
  accessedOn: string;
};

export type FaBenchmarkRule =
  | { direction: "higher-is-better"; goodMin: number; watchMin?: number }
  | { direction: "lower-is-better"; goodMax: number; watchMax?: number };

export type FaBenchmark = {
  id: FaRatioId;
  label: string;
  formula: string;
  unit: "months" | "ratio";
  rule: FaBenchmarkRule;
  sources: readonly FaBenchmarkSource[];
  curriculumNote: string;
  confirmation: typeof FA_BENCHMARK_PENDING | "ยืนยันแล้ว";
};

export const FA_RATIO_IDS = [
  "emergency_fund",
  "savings_rate",
  "debt_service",
  "housing_debt_service",
  "debt_to_asset",
  "investment_to_net_worth",
] as const;
export type FaRatioId = (typeof FA_RATIO_IDS)[number];

const CURRICULUM_NOTE = "หัวข้ออัตราส่วนทางการเงิน หลักสูตร CFP โมดูล 1 (สมาคมนักวางแผนการเงินไทย) · ยังไม่ได้เทียบกับตำราฉบับที่ปั้นใช้";

const WEALTHY_THAI_RATIOS = {
  title: "อัตราส่วนทางการเงิน เช็กสุขภาพการเงินด้วยตัวเอง",
  publisher: "WEALTHY THAI (ผู้เขียน: ยงยุทธ ภาคาเพียร, AFPT)",
  url: "https://www.wealthythai.com/th/updates/wealth-ez/10823",
  accessedOn: "2026-10-25",
} as const;

const SET_AFFORDABILITY = {
  title: "Affordability Ratio",
  publisher: "ตลาดหลักทรัพย์แห่งประเทศไทย (SET Happy Money)",
  url: "https://www.set.or.th/th/education-research/education/happymoney/glossary/affordability-ratio",
  accessedOn: "2026-10-25",
} as const;

export const FA_BENCHMARKS: Readonly<Record<FaRatioId, FaBenchmark>> = {
  emergency_fund: {
    id: "emergency_fund",
    label: "เงินสำรองพอใช้",
    formula: "สินทรัพย์สภาพคล่อง ÷ รายจ่ายต่อเดือน (รวมค่างวดหนี้)",
    unit: "months",
    // Salaried: the bottom of the 3–6 range meets it. Self-employed uses the
    // top of the same range (see FA_EMERGENCY_FUND_SELF_EMPLOYED).
    rule: { direction: "higher-is-better", goodMin: 3 },
    sources: [{ ...WEALTHY_THAI_RATIOS, quote: "อัตราส่วนสภาพคล่องพื้นฐาน ... ควรมากกว่า 3-6 เท่า" }],
    curriculumNote: CURRICULUM_NOTE,
    confirmation: FA_BENCHMARK_PENDING,
  },
  savings_rate: {
    id: "savings_rate",
    label: "อัตราการออม",
    formula: "(รายจ่ายหมวดออม/ลงทุน + เงินเหลือ) ÷ รายได้",
    unit: "ratio",
    rule: { direction: "higher-is-better", goodMin: 0.1 },
    sources: [{ ...WEALTHY_THAI_RATIOS, quote: "อัตราส่วนการออม ... ควรมากกว่า 0.1 เท่า" }],
    curriculumNote: CURRICULUM_NOTE,
    confirmation: FA_BENCHMARK_PENDING,
  },
  debt_service: {
    id: "debt_service",
    label: "ภาระผ่อนหนี้ต่อรายได้",
    formula: "ค่างวดหนี้ทั้งหมดต่อเดือน ÷ รายได้ต่อเดือน",
    unit: "ratio",
    rule: { direction: "lower-is-better", goodMax: 0.35, watchMax: 0.45 },
    sources: [
      { ...SET_AFFORDABILITY, quote: "เมื่อรวมหนี้ที่ต้องผ่อนทั้งหมดในแต่ละเดือนแล้ว ไม่ควรเกิน 35% - 45% ของรายได้" },
      { ...WEALTHY_THAI_RATIOS, quote: "อัตราส่วนความสามารถในการชำระหนี้ ... ไม่ควรมีค่าเกิน 0.4 เท่า" },
    ],
    curriculumNote: CURRICULUM_NOTE,
    confirmation: FA_BENCHMARK_PENDING,
  },
  housing_debt_service: {
    id: "housing_debt_service",
    label: "ค่าผ่อนบ้านต่อรายได้",
    formula: "ค่างวดสินเชื่อบ้านต่อเดือน ÷ รายได้ต่อเดือน",
    unit: "ratio",
    rule: { direction: "lower-is-better", goodMax: 0.25, watchMax: 0.3 },
    sources: [{ ...SET_AFFORDABILITY, quote: "เงินผ่อนหนี้บ้านในแต่ละเดือนไม่ควรเกิน 25% - 30% ของรายได้" }],
    curriculumNote: CURRICULUM_NOTE,
    confirmation: FA_BENCHMARK_PENDING,
  },
  debt_to_asset: {
    id: "debt_to_asset",
    label: "หนี้สินต่อสินทรัพย์",
    formula: "หนี้สินรวม ÷ สินทรัพย์รวม",
    unit: "ratio",
    rule: { direction: "lower-is-better", goodMax: 0.5 },
    sources: [{ ...WEALTHY_THAI_RATIOS, quote: "อัตราส่วนหนี้สินต่อสินทรัพย์ ... ไม่ควรมากกว่า 0.5 เท่า" }],
    curriculumNote: CURRICULUM_NOTE,
    confirmation: FA_BENCHMARK_PENDING,
  },
  investment_to_net_worth: {
    id: "investment_to_net_worth",
    label: "สินทรัพย์ลงทุนต่อความมั่งคั่งสุทธิ",
    formula: "สินทรัพย์ลงทุน/ออมระยะยาว ÷ ความมั่งคั่งสุทธิ",
    unit: "ratio",
    rule: { direction: "higher-is-better", goodMin: 0.5 },
    sources: [{ ...WEALTHY_THAI_RATIOS, quote: "อัตราส่วนการลงทุน ... ควรมีค่าผลลัพธ์มากกว่า 0.5 เท่า" }],
    curriculumNote: CURRICULUM_NOTE,
    confirmation: FA_BENCHMARK_PENDING,
  },
};

/**
 * Self-employed households use the top of the 3–6 month range. The source
 * gives the range; choosing its top for irregular income is a planner
 * convention recorded in the spec, so it is also pending confirmation.
 */
export const FA_EMERGENCY_FUND_SELF_EMPLOYED = {
  rule: { direction: "higher-is-better", goodMin: 6, watchMin: 3 } as FaBenchmarkRule,
  note: "อาชีพอิสระใช้ขอบบนของช่วง 3–6 เดือน ตามสเปกห้องวางแผน",
  confirmation: FA_BENCHMARK_PENDING,
} as const;

export function pendingBenchmarkIds(): FaRatioId[] {
  return FA_RATIO_IDS.filter((id) => FA_BENCHMARKS[id].confirmation === FA_BENCHMARK_PENDING);
}
