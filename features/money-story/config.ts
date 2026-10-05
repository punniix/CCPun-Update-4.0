import type { EventCategory, ProtectionType } from './types';

export const MONEY_STORY_TOTAL_MONTHS = 12;
export const MONEY_STORY_LINE_URL = 'https://lin.ee/tqLCs4f';
export const MONEY_STORY_PYRAMID_URL = '/blog/personal-finance/financial-pyramid/';

export const PROTECTION_CATALOG: Record<ProtectionType, {
  label: string;
  monthlyPremium: number;
  coverageRate: number;
  maxBenefit: number;
  deductible: number;
}> = {
  health: { label: 'สุขภาพ', monthlyPremium: 1200, coverageRate: 0.8, maxBenefit: 120000, deductible: 3000 },
  critical: { label: 'เงินก้อนเมื่อเจ็บป่วยรุนแรง', monthlyPremium: 900, coverageRate: 1, maxBenefit: 120000, deductible: 0 },
  life: { label: 'ครอบครัว/คนที่พึ่งรายได้', monthlyPremium: 650, coverageRate: 1, maxBenefit: 300000, deductible: 0 },
  motor: { label: 'รถ', monthlyPremium: 850, coverageRate: 0.85, maxBenefit: 120000, deductible: 3000 },
  home: { label: 'บ้านและทรัพย์สิน', monthlyPremium: 500, coverageRate: 0.8, maxBenefit: 180000, deductible: 5000 },
};

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  everyday: 'ชีวิตประจำวัน',
  work: 'งานและรายได้',
  household: 'บ้านและค่าใช้จ่าย',
  health: 'สุขภาพ',
  motor: 'รถ',
  home: 'บ้านและทรัพย์สิน',
  family: 'ครอบครัว',
  market: 'การลงทุน',
  crisis: 'เหตุการณ์ใหญ่',
  calm: 'เดือนปกติ',
};

export const MONEY_STORY_DISCLAIMER =
  'Money Story เป็นเกมสถานการณ์จำลองเพื่อการเรียนรู้ ตัวเลข เบี้ย ความคุ้มครอง ผลตอบแทน และกติกาการกู้เป็นสมมติฐานของเกม ไม่ใช่เงื่อนไขผลิตภัณฑ์จริง ไม่ใช่คำแนะนำเฉพาะบุคคล และไม่รับประกันผลลัพธ์ในชีวิตจริง';
