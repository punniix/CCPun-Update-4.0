import type { FundCatalogCategory, FundCatalogItem, FundCatalogSubcategory } from "./types";

export const FUND_CATEGORY_LABELS: Record<FundCatalogCategory, string> = {
  equity: "กองทุนหุ้น",
  mixed: "กองทุนผสม",
  fixed_income: "ตราสารหนี้ / ตลาดเงิน",
  alternative: "สินทรัพย์ทางเลือก",
  other: "กองทุนประเภทอื่น",
};

export const FUND_CATEGORY_DESCRIPTIONS: Record<FundCatalogCategory, string> = {
  equity: "SEC policy_desc: ตราสารทุน",
  mixed: "SEC policy_desc: ผสม",
  fixed_income: "SEC policy_desc: ตราสารหนี้ โดยกองตลาดเงินแยกด้วย Fund Specification: MM",
  alternative: "SEC policy_desc: ทรัพย์สินทางเลือก",
  other: "รายการอื่นที่ SEC ไม่อยู่ใน 4 หมวดข้างต้น",
};

export const FUND_SUBCATEGORY_LABELS: Record<FundCatalogSubcategory, string> = {
  all: "ทั้งหมด",
  domestic: "ในประเทศ",
  foreign: "ต่างประเทศ",
  domestic_foreign: "ในประเทศ + ต่างประเทศ",
  money_market: "ตลาดเงิน",
};

export function categoryFromPolicy(policyDesc: string | null | undefined): FundCatalogCategory {
  if (policyDesc === "ตราสารทุน") return "equity";
  if (policyDesc === "ผสม") return "mixed";
  if (policyDesc === "ตราสารหนี้") return "fixed_income";
  if (policyDesc === "ทรัพย์สินทางเลือก") return "alternative";
  return "other";
}

export function subcategoryOptions(category: FundCatalogCategory | "all"): FundCatalogSubcategory[] {
  if (category === "fixed_income") return ["all", "domestic", "foreign", "domestic_foreign"];
  if (category === "equity" || category === "mixed" || category === "alternative") return ["all", "domestic", "foreign", "domestic_foreign"];
  return ["all"];
}

export function geographyLabel(flag: FundCatalogItem["investCountryFlag"], category?: FundCatalogCategory | "all"): string {
  if (category === "equity") {
    if (flag === "3") return "หุ้นไทย";
    if (flag === "1" || flag === "2") return "หุ้นต่างประเทศ";
    if (flag === "4") return "หุ้นไทย + ต่างประเทศ";
  }
  if (flag === "1") return "เน้นลงทุนต่างประเทศ";
  if (flag === "2") return "ลงทุนต่างประเทศบางส่วน";
  if (flag === "3") return "ไม่มีความเสี่ยงต่างประเทศ";
  if (flag === "4") return "มีความเสี่ยงทั้งในและต่างประเทศ";
  return "SEC ไม่ระบุขอบเขตประเทศ";
}

export function matchesGeography(item: Pick<FundCatalogItem, "investCountryFlag">, subcategory: FundCatalogSubcategory): boolean {
  if (subcategory === "all" || subcategory === "money_market") return true;
  if (subcategory === "domestic") return item.investCountryFlag === "3";
  if (subcategory === "foreign") return item.investCountryFlag === "1" || item.investCountryFlag === "2";
  if (subcategory === "domestic_foreign") return item.investCountryFlag === "4";
  return true;
}

export function equitySubcategoryLabel(subcategory: FundCatalogSubcategory): string {
  if (subcategory === "domestic") return "หุ้นไทย";
  if (subcategory === "foreign") return "หุ้นต่างประเทศ";
  if (subcategory === "domestic_foreign") return "หุ้นไทย + ต่างประเทศ";
  return FUND_SUBCATEGORY_LABELS[subcategory];
}
