import type { FundDetailResponse, PlanningFund } from "./types";

// Exact reported labels independently observed in SEC UAT facts. No name,
// category, substring or portfolio heuristic fills an unsupported asset label.
const REPORTED_ASSETS = {
  "ตราสารทุน": "equity",
  "หุ้นกู้": "fixed_income",
  "พันธบัตร": "fixed_income",
  "เงินฝาก": "cash",
} as const;

export function planningFundFromDetail(fund: PlanningFund, detail: FundDetailResponse, requestedClass: string | null): PlanningFund {
  if (detail.source !== fund.provenance.source || detail.fund?.projectId !== fund.projectId || detail.state === "unavailable") {
    throw new Error("fund_detail_identity_unavailable");
  }
  if (requestedClass && (detail.selectedClassName !== requestedClass || !detail.classes.some((row) => row.name === requestedClass))) {
    throw new Error("fund_detail_class_mismatch");
  }
  const rawTotal = detail.assetAllocation.reduce((sum, row) => sum + row.percentNav, 0);
  const unsupportedTotals = detail.assetAllocation.some((row) => !Number.isFinite(row.percentNav) || row.percentNav < 0) || rawTotal > 100;
  const mapped = detail.assetAllocation.flatMap((row) => {
    const asset = Object.hasOwn(REPORTED_ASSETS, row.name) ? REPORTED_ASSETS[row.name as keyof typeof REPORTED_ASSETS] : null;
    return asset ? [{ asset, percent: row.percentNav, label: row.name, sourceDate: row.sourceDate }] : [];
  });
  const synthetic = detail.source === "uat_synthetic";
  const assetAllocation = synthetic ? fund.assetAllocation : unsupportedTotals ? [] : mapped;
  const missingMapping = !synthetic && (unsupportedTotals || mapped.length < detail.assetAllocation.length);
  const className = requestedClass;
  return {
    ...fund,
    className,
    riskSpectrum: detail.risk?.level ?? null,
    assetAllocation,
    liquidity: className && detail.dealing?.className === className
      ? { rawText: detail.dealing.settlementPeriod, normalized: detail.dealing.settlementBucket, sourceDate: detail.dealing.sourceDate }
      : { rawText: null, normalized: "unknown", sourceDate: null },
    provenance: {
      source: detail.source,
      sourceDate: detail.dataDate ?? detail.fund.lastUpdated,
      fetchedAt: detail.fetchedAt,
      state: detail.state,
      snapshotIds: [...new Set([...fund.provenance.snapshotIds, ...(detail.snapshotIds ?? [])])],
      notes: [...detail.warnings, ...(missingMapping ? ["รายการสินทรัพย์บางส่วนยังจัดเข้าประเภทที่รองรับไม่ได้ หรือมีค่าติดลบ/รวมเกิน 100% จึงคงส่วนที่ไม่รองรับเป็นข้อมูลที่ยังระบุไม่ได้ โดยไม่ปรับสัดส่วนต้นทาง"] : [])],
    },
  };
}
