import type { CIRecoveryCosts, CIRecoveryMode } from './calculator/types';

export type CIRecoverySource = {
  id: string;
  year: number;
  title: string;
  publisher: string;
  url: string;
  note: string;
};

export type CIRecoveryPresetDefinition = {
  mode: Exclude<CIRecoveryMode, 'none' | 'custom'>;
  title: string;
  shortDescription: string;
  reserve: number;
  recovery: CIRecoveryCosts;
};

export const CI_RECOVERY_EVIDENCE_YEAR_FLOOR = 2023;

/**
 * Planning benchmarks are intentionally rounded upward from observed/current
 * prices so this tool can be used for reserve planning rather than quoting.
 * They are not medical recommendations or guaranteed market prices.
 */
export const CI_RECOVERY_REFERENCE = {
  legacyResearch: {
    treatmentVisitTotal: 2_578,
    caregiverLostIncomePerDay: 141,
    rehabilitationPerSession: 450,
    homeRehabAddOnPerSession: 200,
  },
  treatmentVisit: {
    planningPerVisit: 3_000,
    observedStudyTotal: 2_578,
  },
  caregiver: {
    planningPerDay: 2_000,
  },
  rehabilitation: {
    planningPerSession: 2_000,
  },
  equipment: {
    pulseOximeter: 1_200,
    bloodPressureMonitor: 2_000,
    thermometer: 300,
    walker: 2_500,
    wheelchair: 7_000,
    showerChair: 2_000,
    grabRailAndSafetyBasic: 3_000,
    hospitalBed: 15_000,
  },
  housing: {
    accessibleBathroomPlanning: 120_000,
    majorHousingPlanning: 2_000_000,
  },
} as const;

export const EMPTY_CI_RECOVERY: CIRecoveryCosts = {
  mode: 'none',
  targetReserve: 0,
  treatmentVisits: 0,
  treatmentVisitUnitCost: CI_RECOVERY_REFERENCE.treatmentVisit.planningPerVisit,
  caregiverHomeDays: 0,
  caregiverDailyCost: CI_RECOVERY_REFERENCE.caregiver.planningPerDay,
  rehabSessions: 0,
  rehabUnitCost: CI_RECOVERY_REFERENCE.rehabilitation.planningPerSession,
  pulseOximeter: 0,
  bloodPressureMonitor: 0,
  thermometer: 0,
  walker: 0,
  wheelchair: 0,
  showerChair: 0,
  grabRailAndSafety: 0,
  hospitalBed: 0,
  consumables: 0,
  homeAdaptation: 0,
  majorHousing: 0,
  contingency: 0,
  otherRecoveryCosts: 0,
};

function recovery(
  mode: Exclude<CIRecoveryMode, 'none' | 'custom'>,
  values: Omit<CIRecoveryCosts, 'mode'>,
): CIRecoveryCosts {
  return { mode, ...values };
}

export const CI_RECOVERY_PRESETS: Record<'basic' | 'continued' | 'longTerm', CIRecoveryPresetDefinition> = {
  basic: {
    mode: 'basic',
    title: 'เผื่อช่วงพักฟื้น',
    shortDescription: 'ค่าเดินทาง ผู้ดูแลระยะสั้น กายภาพ อุปกรณ์พื้นฐาน และปรับบ้านเล็กน้อย',
    reserve: 100_000,
    recovery: recovery('basic', {
      targetReserve: 100_000,
      treatmentVisits: 6,
      treatmentVisitUnitCost: 3_000,
      caregiverHomeDays: 7,
      caregiverDailyCost: 2_000,
      rehabSessions: 8,
      rehabUnitCost: 2_000,
      pulseOximeter: 1_200,
      bloodPressureMonitor: 2_000,
      thermometer: 300,
      walker: 2_500,
      wheelchair: 0,
      showerChair: 2_000,
      grabRailAndSafety: 3_000,
      hospitalBed: 0,
      consumables: 6_000,
      homeAdaptation: 10_000,
      majorHousing: 0,
      contingency: 25_000,
      otherRecoveryCosts: 0,
    }),
  },
  continued: {
    mode: 'continued',
    title: 'เผื่อฟื้นฟูต่อเนื่อง + ปรับบ้าน',
    shortDescription: 'เพิ่มระยะผู้ดูแล การฟื้นฟู อุปกรณ์ช่วยใช้ชีวิต และงบปรับพื้นที่บ้านจริงจัง',
    reserve: 500_000,
    recovery: recovery('continued', {
      targetReserve: 500_000,
      treatmentVisits: 12,
      treatmentVisitUnitCost: 3_000,
      caregiverHomeDays: 40,
      caregiverDailyCost: 2_000,
      rehabSessions: 20,
      rehabUnitCost: 2_000,
      pulseOximeter: 1_200,
      bloodPressureMonitor: 2_000,
      thermometer: 300,
      walker: 2_500,
      wheelchair: 7_000,
      showerChair: 2_000,
      grabRailAndSafety: 6_000,
      hospitalBed: 15_000,
      consumables: 15_000,
      homeAdaptation: 180_000,
      majorHousing: 0,
      contingency: 113_000,
      otherRecoveryCosts: 0,
    }),
  },
  longTerm: {
    mode: 'longTerm',
    title: 'เผื่อปรับการใช้ชีวิตระยะยาว',
    shortDescription: 'รวมการดูแลต่อเนื่อง อุปกรณ์ และเงินสำรองถึงกรณีต้องเปลี่ยนหรือจัดที่อยู่อาศัยใหม่',
    reserve: 2_500_000,
    recovery: recovery('longTerm', {
      targetReserve: 2_500_000,
      treatmentVisits: 12,
      treatmentVisitUnitCost: 3_000,
      caregiverHomeDays: 120,
      caregiverDailyCost: 2_000,
      rehabSessions: 20,
      rehabUnitCost: 2_000,
      pulseOximeter: 1_200,
      bloodPressureMonitor: 2_000,
      thermometer: 300,
      walker: 2_500,
      wheelchair: 7_000,
      showerChair: 2_000,
      grabRailAndSafety: 6_000,
      hospitalBed: 15_000,
      consumables: 30_000,
      homeAdaptation: 0,
      majorHousing: 2_000_000,
      contingency: 118_000,
      otherRecoveryCosts: 0,
    }),
  },
};

const PRESET_FIELDS: Array<keyof Omit<CIRecoveryCosts, 'mode' | 'targetReserve' | 'treatmentVisitUnitCost' | 'caregiverDailyCost' | 'rehabUnitCost'>> = [
  'treatmentVisits',
  'caregiverHomeDays',
  'rehabSessions',
  'pulseOximeter',
  'bloodPressureMonitor',
  'thermometer',
  'walker',
  'wheelchair',
  'showerChair',
  'grabRailAndSafety',
  'hospitalBed',
  'consumables',
  'homeAdaptation',
  'majorHousing',
  'otherRecoveryCosts',
];

function cloneRecovery(value: CIRecoveryCosts): CIRecoveryCosts {
  return { ...value };
}

export function getRecoveryPreset(mode: Exclude<CIRecoveryMode, 'none' | 'custom'>): CIRecoveryCosts {
  return cloneRecovery(CI_RECOVERY_PRESETS[mode].recovery);
}

export function getRecoveryModeLabel(mode: CIRecoveryMode): string {
  if (mode === 'none') return 'ยังไม่ได้เลือก Recovery Reserve';
  if (mode === 'custom') return 'กำหนดเงินสำรองเอง';
  return CI_RECOVERY_PRESETS[mode].title;
}

function interpolateNumber(a: number, b: number, ratio: number, integer = false): number {
  const value = a + (b - a) * ratio;
  return integer ? Math.max(0, Math.floor(value)) : Math.max(0, Math.round(value));
}

function buildInterpolatedRecovery(
  targetReserve: number,
  low: CIRecoveryCosts,
  high: CIRecoveryCosts,
): CIRecoveryCosts {
  const span = Math.max(1, high.targetReserve - low.targetReserve);
  const ratio = Math.min(1, Math.max(0, (targetReserve - low.targetReserve) / span));
  const next: CIRecoveryCosts = {
    ...EMPTY_CI_RECOVERY,
    mode: 'custom',
    targetReserve,
    treatmentVisitUnitCost: CI_RECOVERY_REFERENCE.treatmentVisit.planningPerVisit,
    caregiverDailyCost: CI_RECOVERY_REFERENCE.caregiver.planningPerDay,
    rehabUnitCost: CI_RECOVERY_REFERENCE.rehabilitation.planningPerSession,
  };

  for (const field of PRESET_FIELDS) {
    const integer = field === 'treatmentVisits' || field === 'caregiverHomeDays' || field === 'rehabSessions';
    next[field] = interpolateNumber(low[field], high[field], ratio, integer) as never;
  }

  const withoutContingency =
    next.treatmentVisits * next.treatmentVisitUnitCost
    + next.caregiverHomeDays * next.caregiverDailyCost
    + next.rehabSessions * next.rehabUnitCost
    + next.pulseOximeter
    + next.bloodPressureMonitor
    + next.thermometer
    + next.walker
    + next.wheelchair
    + next.showerChair
    + next.grabRailAndSafety
    + next.hospitalBed
    + next.consumables
    + next.homeAdaptation
    + next.majorHousing
    + next.otherRecoveryCosts;

  next.contingency = Math.max(0, targetReserve - withoutContingency);
  return next;
}

export function buildCustomRecoveryFromTarget(targetReserve: number): CIRecoveryCosts {
  const target = Number.isSafeInteger(targetReserve) && targetReserve > 0 ? targetReserve : 0;
  if (target === 0) return { ...EMPTY_CI_RECOVERY, mode: 'custom' };

  const basic = CI_RECOVERY_PRESETS.basic.recovery;
  const continued = CI_RECOVERY_PRESETS.continued.recovery;
  const longTerm = CI_RECOVERY_PRESETS.longTerm.recovery;

  if (target < basic.targetReserve) {
    const ratio = target / basic.targetReserve;
    const scaled = buildInterpolatedRecovery(
      target,
      { ...EMPTY_CI_RECOVERY, mode: 'custom', targetReserve: 0 },
      basic,
    );
    scaled.treatmentVisits = Math.floor(basic.treatmentVisits * ratio);
    scaled.caregiverHomeDays = Math.floor(basic.caregiverHomeDays * ratio);
    scaled.rehabSessions = Math.floor(basic.rehabSessions * ratio);
    const subtotal =
      scaled.treatmentVisits * scaled.treatmentVisitUnitCost
      + scaled.caregiverHomeDays * scaled.caregiverDailyCost
      + scaled.rehabSessions * scaled.rehabUnitCost
      + scaled.pulseOximeter
      + scaled.bloodPressureMonitor
      + scaled.thermometer
      + scaled.walker
      + scaled.wheelchair
      + scaled.showerChair
      + scaled.grabRailAndSafety
      + scaled.hospitalBed
      + scaled.consumables
      + scaled.homeAdaptation
      + scaled.majorHousing
      + scaled.otherRecoveryCosts;
    scaled.contingency = Math.max(0, target - subtotal);
    return scaled;
  }

  if (target <= continued.targetReserve) {
    return buildInterpolatedRecovery(target, basic, continued);
  }

  if (target <= longTerm.targetReserve) {
    return buildInterpolatedRecovery(target, continued, longTerm);
  }

  return {
    ...longTerm,
    mode: 'custom',
    targetReserve: target,
    contingency: longTerm.contingency + (target - longTerm.targetReserve),
  };
}

export function copyPresetToCustom(mode: Exclude<CIRecoveryMode, 'none' | 'custom'>): CIRecoveryCosts {
  return {
    ...getRecoveryPreset(mode),
    mode: 'custom',
  };
}

export const CI_RECOVERY_SOURCES: readonly CIRecoverySource[] = [
  {
    id: 'thai-breast-cancer-cost-2025',
    year: 2025,
    title: 'Economic Burden of Breast Cancer on Patients and their Caregivers in Health Region 9, Thailand',
    publisher: 'Asian Pacific Journal of Cancer Prevention',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12661252/',
    note: 'ใช้เป็นหลักฐานว่าค่าเดินทาง อาหาร ค่าใช้จ่ายทางการแพทย์นอกสิทธิ และผลกระทบต่อผู้ดูแลเกิดขึ้นจริง ตัวเลข 2,578 บาท/ครั้งเป็นค่าเฉลี่ยของกลุ่มตัวอย่าง ไม่ใช่ราคามาตรฐานของโรคร้ายแรงทุกกรณี',
  },
  {
    id: 'kin-caregiver-2026',
    year: 2026,
    title: 'บริการดูแลผู้สูงอายุและผู้ป่วยที่บ้าน',
    publisher: 'KIN Home Care',
    url: 'https://www.kinhomecare.com/en/services/elderly-home-care',
    note: 'ใช้อ้างอิงราคาตลาดผู้ดูแลที่บ้าน แล้วปัดเป็น benchmark วางแผน 2,000 บาท/วัน ไม่ใช่ใบเสนอราคา',
  },
  {
    id: 'kin-physio-2026',
    year: 2026,
    title: 'Home Physiotherapy',
    publisher: 'KIN Home Care',
    url: 'https://www.kinhomecare.com/en/services/home-physiotherapy',
    note: 'ใช้ประกอบ benchmark กายภาพที่บ้าน 2,000 บาท/ครั้ง โดยตั้งเผื่อจากราคาบริการปัจจุบัน',
  },
  {
    id: 'scg-bathroom-2026',
    year: 2026,
    title: 'บริการปรับปรุงห้องน้ำ',
    publisher: 'SCG HOME Experience',
    url: 'https://www.scgexperience.com/product/%E0%B8%84%E0%B9%88%E0%B8%B2%E0%B8%AA%E0%B8%B3%E0%B8%A3%E0%B8%A7%E0%B8%88%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2%E0%B8%87%E0%B8%B2%E0%B8%99%E0%B8%9A%E0%B8%A3%E0%B8%B4%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%9B%E0%B8%A3%E0%B8%B1%E0%B8%9A%E0%B8%9B%E0%B8%A3%E0%B8%B8%E0%B8%87%E0%B8%AB%E0%B9%89%E0%B8%AD%E0%B8%87%E0%B8%99%E0%B9%89%E0%B8%B3/11001000957000519',
    note: 'ใช้เป็น reference ของงานปรับห้องน้ำจริงจัง ซึ่งมีต้นทุนสูงกว่าราวจับหรืออุปกรณ์ชิ้นเล็ก',
  },
  {
    id: 'cibes-access-2026',
    year: 2026,
    title: 'Stairlift / Home Lift Guide',
    publisher: 'Cibes Lift Thailand',
    url: 'https://www.cibeslift.co.th/blog/what-is-stair-lift/',
    note: 'ใช้แสดงว่ากรณีบ้านหลายชั้นอาจมีค่าใช้จ่ายหลักแสนถึงหลักล้าน และควรมองเป็นทางเลือกด้านที่อยู่อาศัย ไม่ใช่บวกทุกอุปกรณ์เข้าด้วยกัน',
  },
  {
    id: 'dpt-elder-home-2026',
    year: 2026,
    title: 'แบบบ้านผู้สูงวัย',
    publisher: 'กรมโยธาธิการและผังเมือง',
    url: 'https://townsquare.dpt.go.th/arch/plan/435',
    note: 'ใช้ประกอบ Major Housing Reserve ระดับ 2 ล้านบาทโดยเผื่อจากงบประมาณแบบบ้านอ้างอิง และไม่รวมราคาที่ดิน',
  },
] as const;

export function assertCurrentRecoveryEvidence() {
  for (const source of CI_RECOVERY_SOURCES) {
    if (source.year < CI_RECOVERY_EVIDENCE_YEAR_FLOOR) {
      throw new Error(`Recovery evidence is older than ${CI_RECOVERY_EVIDENCE_YEAR_FLOOR}: ${source.id}`);
    }
  }
}
