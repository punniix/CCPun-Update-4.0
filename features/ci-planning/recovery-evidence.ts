export type CIRecoverySource = {
  id: string;
  year: number;
  title: string;
  publisher: string;
  url: string;
  note: string;
};

export const CI_RECOVERY_EVIDENCE_YEAR_FLOOR = 2023;

export const CI_RECOVERY_REFERENCE = {
  treatmentVisit: {
    transport: 667,
    food: 584,
    additionalMedicalOutOfPocket: 744,
    caregiverLostIncome: 583,
    total: 2_578,
  },
  caregiverHomePerDay: 141,
  rehabilitation: {
    perSession: 450,
    homeServiceAddOnPerSession: 200,
    benchmarkSessionLimit: 20,
  },
  homeModificationPublicProgramCeiling: 40_000,
} as const;

export const CI_RECOVERY_SOURCES: readonly CIRecoverySource[] = [
  {
    id: 'thai-breast-cancer-cost-2025',
    year: 2025,
    title: 'Economic Burden of Breast Cancer on Patients and their Caregivers in Health Region 9, Thailand',
    publisher: 'Asian Pacific Journal of Cancer Prevention',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12661252/',
    note: 'ข้อมูล ก.ย. 2024–ก.พ. 2025 จาก 202 คู่ผู้ป่วยมะเร็งเต้านม–ผู้ดูแล ใช้อัตราแลกเปลี่ยนงานวิจัย 32.54 บาท/ดอลลาร์ ตัวเลขเป็นค่าเฉลี่ยของงานวิจัย ไม่ใช่ราคามาตรฐานทั่วประเทศ',
  },
  {
    id: 'nhso-rehab-2026',
    year: 2026,
    title: 'บริการนวัตกรรมด้านกายภาพบำบัด / กรอบงบกองทุนหลักประกันสุขภาพแห่งชาติ ปี 2569',
    publisher: 'สำนักงานหลักประกันสุขภาพแห่งชาติ (สปสช.)',
    url: 'https://www.nhso.go.th/th/agency-th/report-finance-2/56309-2569-62/file',
    note: 'ใช้อัตรา 450 บาท/ครั้ง และบริการที่บ้านเพิ่ม 200 บาท/ครั้ง เป็น benchmark การจ่ายบริการภาครัฐ ไม่ใช่ราคากายภาพเอกชน',
  },
  {
    id: 'dop-home-2025',
    year: 2025,
    title: 'คู่มือโครงการปรับสภาพแวดล้อมและสิ่งอำนวยความสะดวกของผู้สูงอายุ ปีงบประมาณ 2568',
    publisher: 'กรมกิจการผู้สูงอายุ',
    url: 'https://www.dop.go.th/th/know/12/2590',
    note: 'วงเงิน 40,000 บาท/หลังใช้เป็นตัวอย่างเพดานสนับสนุนของโครงการภาครัฐเท่านั้น ไม่ใช่ราคาตลาดและไม่ถูกบวกให้อัตโนมัติ',
  },
] as const;

export function assertCurrentRecoveryEvidence() {
  for (const source of CI_RECOVERY_SOURCES) {
    if (source.year < CI_RECOVERY_EVIDENCE_YEAR_FLOOR) {
      throw new Error(`Recovery evidence is older than ${CI_RECOVERY_EVIDENCE_YEAR_FLOOR}: ${source.id}`);
    }
  }
}
