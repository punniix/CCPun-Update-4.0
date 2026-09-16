// =============================================
// CI Planning — TypeScript Interfaces
// Critical Illness insurance planning tool
// =============================================

// ── Step 1: Expenses & Reserve ────────────────────────────────────────────

export interface CIEducationPlan {
  annualCost: number;                    // ค่าใช้จ่ายการศึกษาต่อปี
  yearsRemaining: number;               // จำนวนปีที่ต้องเตรียมต่อ (1-30)
}

export interface CIRecoveryCosts {
  treatmentVisits: number;               // จำนวนครั้งรักษา/ติดตามที่คาดว่าจะมีค่าใช้จ่ายนอกสิทธิ/เดินทาง
  caregiverHomeDays: number;             // จำนวนวันที่ผู้ดูแลต้องหยุดงานมาดูแลที่บ้าน
  rehabSessions: number;                 // จำนวนครั้งกายภาพ/ฟื้นฟูตาม benchmark สปสช.
  homeRehabSessions: number;             // ใน rehabSessions เป็นบริการที่บ้านกี่ครั้ง
  equipmentAndHomeModification: number;  // อุปกรณ์/ปรับบ้านที่ผู้ใช้กรอกเอง
  otherRecoveryCosts: number;            // ค่าใช้จ่ายช่วงพักฟื้นอื่นที่ผู้ใช้กรอกเอง
}

export interface StepExpensesData {
  monthlyIncome: number;                 // รายได้ต่อเดือน ใช้คำนวณทุนตามรายได้แยกจากทุนตามรายจ่าย
  household: number;                    // ค่าใช้จ่ายครัวเรือนรวม/เดือน ไม่รวมค่างวดและการศึกษา
  educationPlans: CIEducationPlan[];    // แผนการศึกษารายคน (ไม่มีบุตร = [])
  mortgagePayment: number;              // ค่างวดบ้าน บาท/เดือน
  mortgageInstallmentsRemaining: number;// จำนวนงวดบ้านที่เหลือ
  carPayment: number;                   // ค่างวดรถ บาท/เดือน
  carInstallmentsRemaining: number;     // จำนวนงวดรถที่เหลือ
  otherDebtBalance: number;             // ยอดหนี้อื่นคงเหลือรวม กรอกครั้งเดียว
  reserveYears: number;                 // ต้องการเงินสำรองกี่ปี (1-10, default 5)
  recovery?: CIRecoveryCosts;           // Recovery Reserve แบบ source-backed; legacy callersที่ไม่มี field นี้ถือเป็น 0
}

// ── Step 2: Existing CI Coverage ──────────────────────────────────────────

export interface StepExistingCIData {
  lumpSum: number;          // เงินก้อนจากประกันโรคร้ายแรงที่มี (บาท)
  liquidAssets: number;     // สินทรัพย์สภาพคล่องที่พร้อมใช้ (บาท)
}

// ── Full Form Data ─────────────────────────────────────────────────────────

export interface CIFormData {
  expenses: StepExpensesData;
  existingCI: StepExistingCIData;
}

// ── Result ────────────────────────────────────────────────────────────────

export type CIEstimationMethod = 'expense' | 'income';

export interface CIResult {
  householdMonthly: number;       // ค่าใช้จ่ายครัวเรือน/เดือน ไม่รวมการศึกษาและค่างวด
  householdNeed: number;          // householdMonthly × 12 × reserveYears
  educationPlans: CIEducationPlan[];
  educationNeed: number;          // Σ(annualCost × yearsRemaining)
  mortgageDebtNeed: number;       // ค่างวด × min(งวดที่เหลือ, ปีสำรอง × 12)
  carDebtNeed: number;            // ค่างวด × min(งวดที่เหลือ, ปีสำรอง × 12)
  otherDebtBalance: number;       // ยอดหนี้อื่นคงเหลือรวม ไม่คูณระยะเวลา
  debtNeed: number;               // mortgageDebtNeed + carDebtNeed + otherDebtBalance
  recoveryTreatmentVisits: number;
  recoveryCaregiverHomeDays: number;
  recoveryRehabSessions: number;
  recoveryHomeRehabSessions: number;
  recoveryVisitNeed: number;
  recoveryCaregiverHomeNeed: number;
  recoveryRehabNeed: number;
  recoveryEquipmentAndHomeModification: number;
  recoveryOtherCosts: number;
  recoveryReserveNeed: number;    // รวม Recovery Reserve; บวกเฉพาะทุนตามรายจ่าย
  calculatedNeed: number;         // household + education + debt + recovery reserve
  existingCoverage: number;       // เงินก้อนจากประกันโรคร้ายแรงที่มี
  liquidAssets: number;           // สินทรัพย์สภาพคล่องที่พร้อมใช้
  availableResources: number;     // existingCoverage + liquidAssets
  signedGap: number;               // calculatedNeed - availableResources
  gap: number;                     // alias ของ shortfall สำหรับ UI compatibility
  shortfall: number;               // max(signedGap, 0)
  surplus: number;                 // max(-signedGap, 0)
  incomeBasedNeed: number;         // รายได้ต่อเดือน × 12 × ปีสำรอง; ไม่บวก Recovery Reserve เพื่อกัน double count
  incomeSignedGap: number;         // incomeBasedNeed - availableResources
  incomeShortfall: number;         // max(incomeSignedGap, 0)
  incomeSurplus: number;           // max(-incomeSignedGap, 0)
  effectiveReserveYears: number;  // ข = ปีสำรองที่ผู้ใช้เลือก
}
