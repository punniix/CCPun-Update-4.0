// =============================================
// CI Planning — TypeScript Interfaces
// Critical Illness insurance planning tool
// =============================================

// ── Step 1: Expenses & Reserve ────────────────────────────────────────────

export interface CIEducationPlan {
  annualCost: number;                    // ค่าใช้จ่ายการศึกษาต่อปี
  yearsRemaining: number;               // จำนวนปีที่ต้องเตรียมต่อ (1-30)
}

export type CIRecoveryMode = 'none' | 'basic' | 'continued' | 'longTerm' | 'custom';

/**
 * Recovery Reserve is intentionally separated from income / recurring living
 * expenses. Three presets give users a researched starting point; custom mode
 * lets the user change both the headline reserve and each underlying line item.
 */
export interface CIRecoveryCosts {
  mode: CIRecoveryMode;
  targetReserve: number;

  treatmentVisits: number;
  treatmentVisitUnitCost: number;

  caregiverHomeDays: number;
  caregiverDailyCost: number;

  rehabSessions: number;
  rehabUnitCost: number;

  pulseOximeter: number;
  bloodPressureMonitor: number;
  thermometer: number;
  walker: number;
  wheelchair: number;
  showerChair: number;
  grabRailAndSafety: number;
  hospitalBed: number;
  consumables: number;

  homeAdaptation: number;
  majorHousing: number;
  contingency: number;
  otherRecoveryCosts: number;
}

export interface StepExpensesData {
  monthlyIncome: number;                 // รายได้ต่อเดือน ใช้คำนวณทุนตามรายได้แยกจากทุนตามรายจ่าย
  household: number;                     // ค่าใช้จ่ายครัวเรือนรวม/เดือน ไม่รวมค่างวดและการศึกษา
  educationPlans: CIEducationPlan[];     // แผนการศึกษารายคน (ไม่มีบุตร = [])
  mortgagePayment: number;               // ค่างวดบ้าน บาท/เดือน
  mortgageInstallmentsRemaining: number; // จำนวนงวดบ้านที่เหลือ
  carPayment: number;                    // ค่างวดรถ บาท/เดือน
  carInstallmentsRemaining: number;      // จำนวนงวดรถที่เหลือ
  otherDebtBalance: number;              // ยอดหนี้อื่นคงเหลือรวม กรอกครั้งเดียว
  reserveYears: number;                  // ต้องการเงินสำรองกี่ปี (1-10, default 5)
  recovery?: CIRecoveryCosts;            // Recovery Reserve แยกจากฐานรายได้/รายจ่าย
}

// ── Step 2: Existing CI Coverage ──────────────────────────────────────────

export interface StepExistingCIData {
  lumpSum: number;          // เงินก้อนจากประกันโรคร้ายแรงที่มี (บาท)
  liquidAssets: number;     // สินทรัพย์สภาพคล่องที่มี (บาท)
  protectLiquidAssets?: boolean; // ตั้งเป้าหมายให้ยังเหลือสินทรัพย์ก้อนนี้หลังรับมือค่าใช้จ่าย
}

// ── Full Form Data ─────────────────────────────────────────────────────────

export interface CIFormData {
  expenses: StepExpensesData;
  existingCI: StepExistingCIData;
}

// ── Result ────────────────────────────────────────────────────────────────

export type CIEstimationMethod = 'expense' | 'income';

export interface CIResult {
  householdMonthly: number;
  householdNeed: number;
  educationPlans: CIEducationPlan[];
  educationNeed: number;
  mortgageDebtNeed: number;
  carDebtNeed: number;
  otherDebtBalance: number;
  debtNeed: number;

  recoveryMode: CIRecoveryMode;
  recoveryTargetReserve: number;
  recoveryBreakdownTotal: number;
  recoveryUnallocated: number;
  recoveryOverBudget: number;

  recoveryTreatmentVisits: number;
  recoveryTreatmentVisitUnitCost: number;
  recoveryCaregiverHomeDays: number;
  recoveryCaregiverDailyCost: number;
  recoveryRehabSessions: number;
  recoveryRehabUnitCost: number;

  recoveryVisitNeed: number;
  recoveryCaregiverHomeNeed: number;
  recoveryRehabNeed: number;

  recoveryPulseOximeter: number;
  recoveryBloodPressureMonitor: number;
  recoveryThermometer: number;
  recoveryWalker: number;
  recoveryWheelchair: number;
  recoveryShowerChair: number;
  recoveryGrabRailAndSafety: number;
  recoveryHospitalBed: number;
  recoveryConsumables: number;
  recoveryHomeAdaptation: number;
  recoveryMajorHousing: number;
  recoveryContingency: number;
  recoveryOtherCosts: number;

  // Compatibility aggregates retained for existing result/share surfaces.
  recoveryHomeRehabSessions: number;
  recoveryEquipmentAndHomeModification: number;
  recoveryReserveNeed: number;

  expenseBaseNeed?: number;
  incomeBaseNeed?: number;
  calculatedNeed: number;

  existingCoverage: number;
  liquidAssets: number;
  protectLiquidAssets: boolean;
  protectedAssetsNeed: number;
  availableResources: number;

  signedGap: number;
  gap: number;
  shortfall: number;
  surplus: number;

  incomeBasedNeed: number;
  incomeSignedGap: number;
  incomeShortfall: number;
  incomeSurplus: number;

  effectiveReserveYears: number;
}
