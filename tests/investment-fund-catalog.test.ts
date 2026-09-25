import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  categoryFromPolicy,
  equitySubcategoryLabel,
  geographyLabel,
  matchesGeography,
  subcategoryOptions,
} from "../features/investment-allocation/domain/catalog";
import type { FundCatalogItem } from "../features/investment-allocation/domain/types";

function catalogItem(flag: FundCatalogItem["investCountryFlag"]): Pick<FundCatalogItem, "investCountryFlag"> {
  return { investCountryFlag: flag };
}

test("SEC policy_desc maps only to documented broad CCPun catalog categories", () => {
  assert.equal(categoryFromPolicy("ตราสารทุน"), "equity");
  assert.equal(categoryFromPolicy("ผสม"), "mixed");
  assert.equal(categoryFromPolicy("ตราสารหนี้"), "fixed_income");
  assert.equal(categoryFromPolicy("ทรัพย์สินทางเลือก"), "alternative");
  assert.equal(categoryFromPolicy("อื่น ๆ"), "other");
  assert.equal(categoryFromPolicy("unknown future SEC value"), "other");
});

test("country subcategories follow SEC invest_country_flag rather than fund names", () => {
  assert.equal(matchesGeography(catalogItem("3"), "domestic"), true);
  assert.equal(matchesGeography(catalogItem("1"), "foreign"), true);
  assert.equal(matchesGeography(catalogItem("2"), "foreign"), true);
  assert.equal(matchesGeography(catalogItem("4"), "domestic_foreign"), true);
  assert.equal(matchesGeography(catalogItem("3"), "foreign"), false);
  assert.equal(matchesGeography(catalogItem(null), "domestic"), false);
});

test("equity geography uses plain-language labels while preserving SEC field semantics", () => {
  assert.equal(geographyLabel("3", "equity"), "หุ้นไทย");
  assert.equal(geographyLabel("1", "equity"), "หุ้นต่างประเทศ");
  assert.equal(geographyLabel("2", "equity"), "หุ้นต่างประเทศ");
  assert.equal(geographyLabel("4", "equity"), "หุ้นไทย + ต่างประเทศ");
  assert.equal(equitySubcategoryLabel("domestic"), "หุ้นไทย");
  assert.equal(equitySubcategoryLabel("foreign"), "หุ้นต่างประเทศ");
  assert.equal(equitySubcategoryLabel("domestic_foreign"), "หุ้นไทย + ต่างประเทศ");
});

test("money market stays under the fixed-income family and is not exposed as a slow catalog filter before ingestion cache exists", () => {
  assert.deepEqual(subcategoryOptions("fixed_income"), ["all", "domestic", "foreign", "domestic_foreign"]);
  assert.equal(subcategoryOptions("equity").includes("money_market"), false);
  assert.equal(subcategoryOptions("mixed").includes("money_market"), false);
});


test("customer-facing investment UI does not expose internal SEC/dev terminology", () => {
  const root = process.cwd();
  const customerFiles = [
    "features/investment-allocation/SingleFundBuilder.tsx",
    "features/investment-allocation/PortfolioBuilder.tsx",
    "features/investment-allocation/InvestmentAllocationTool.tsx",
    "features/investment-allocation/page.tsx",
    "components/layout/website-43/Website43Navbar.tsx",
    "components/layout/website-43/Website43Shared.tsx",
  ].map((file) => readFileSync(resolve(root, file), "utf8")).join("\n");

  for (const forbidden of [
    "SEC policy_desc:",
    "Fund Specification:",
    "SEC v2",
    "UAT SYNTHETIC",
    "selection: customer",
    "Target Asset Allocation",
    "Known coverage",
    "Snapshot references",
    "Public Web",
    "Admin/Neon",
    "data-feasibility",
    "normalization สำหรับ UAT",
    "Portfolio Risk Score",
  ]) {
    assert.equal(customerFiles.includes(forbidden), false, `customer UI leaked internal term: ${forbidden}`);
  }
  assert.equal(customerFiles.includes("{fund.abbreviation} · {fund.projectId}"), false, "fund cards must not expose SEC project ids");
});

test("fund catalog supports optional AMC filtering through the normalized planning API", () => {
  const root = process.cwd();
  const server = readFileSync(resolve(root, "features/investment-allocation/server/sec-v2.ts"), "utf8");
  const catalogRoute = readFileSync(resolve(root, "apps/web/app/api/investment-allocation/catalog/route.ts"), "utf8");
  const amcRoute = readFileSync(resolve(root, "apps/web/app/api/investment-allocation/amcs/route.ts"), "utf8");
  assert.match(server, /params\.set\("company_info", amcId\)/);
  assert.match(server, /export async function listFundAmcs/);
  assert.match(catalogRoute, /searchParams\.get\("amc"\)/);
  assert.match(amcRoute, /listFundAmcs/);
});
