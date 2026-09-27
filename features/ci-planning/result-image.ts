import { CI_ESTIMATION_METHOD_LABELS } from './calculator/constants';
import type { CIEstimationMethod, CIResult } from './calculator/types';
import { getRecoveryModeLabel } from './recovery-evidence';
import {
  RESULT_SHARE_IMAGE_WIDTH,
  renderResultShareImage,
} from '@/lib/shared/result-share-image';

export const RESULT_IMAGE_WIDTH = RESULT_SHARE_IMAGE_WIDTH;

const SUMMARY_DISCLAIMER = 'ผลลัพธ์นี้เป็นประมาณการเบื้องต้นจากข้อมูลที่กรอก';
const IMAGE_NOTICE = 'ไม่ใช่คำแนะนำเฉพาะบุคคลหรือเอกสารรับรอง';

export interface CIResultImageSummary {
  toolName: 'การวางแผนทุนโรคร้ายแรง';
  generatedDate: string;
  estimationMethod: CIEstimationMethod;
  methodLabel: string;
  mainNeedToday: number;
  existingCICover: number;
  liquidAssets: number;
  availableResources: number;
  recoveryReserve: number;
  protectedAssetsNeed: number;
  shortfall: number;
  surplus: number;
  targetItems: readonly Readonly<{ label: string; amount: number }>[];
  resourceItems: readonly Readonly<{ label: string; amount: number }>[];
  breakdown: Readonly<{
    household: number;
    education: number;
    debt: number;
    recovery: number;
  }> | null;
  assessmentVersion: string;
  disclaimer: typeof SUMMARY_DISCLAIMER;
  imageNotice: typeof IMAGE_NOTICE;
}

export function createCIResultImageSummary(
  result: CIResult,
  estimationMethod: CIEstimationMethod,
  assessmentVersion: string,
  generatedAt: Date = new Date(),
): Readonly<CIResultImageSummary> {
  const isIncomeMethod = estimationMethod === 'income';
  const breakdown = isIncomeMethod
    ? null
    : Object.freeze({
      household: result.householdNeed,
      education: result.educationNeed,
      debt: result.debtNeed,
      recovery: result.recoveryReserveNeed,
    });
  const mainNeedToday = isIncomeMethod ? result.incomeBasedNeed : result.calculatedNeed;
  const targetItems = (isIncomeMethod
    ? [{ label: 'ฐานตามรายได้', amount: Math.max(mainNeedToday - result.recoveryReserveNeed - result.protectedAssetsNeed, 0) }]
    : [
      { label: 'ค่าใช้จ่ายครัวเรือน', amount: result.householdNeed },
      { label: 'การศึกษา', amount: result.educationNeed },
      { label: 'ภาระหนี้', amount: result.debtNeed },
    ]).filter((item) => item.amount > 0);
  if (mainNeedToday > 0 && result.recoveryReserveNeed > 0) {
    targetItems.push({ label: `สำรองฟื้นฟู (${getRecoveryModeLabel(result.recoveryMode)})`, amount: result.recoveryReserveNeed });
  }
  if (mainNeedToday > 0 && result.protectedAssetsNeed > 0) {
    targetItems.push({ label: 'เป้าหมายรักษาสินทรัพย์', amount: result.protectedAssetsNeed });
  }
  const resourceItems = [
    { label: 'ประกันโรคร้ายแรง', amount: result.existingCoverage },
    { label: 'สินทรัพย์สภาพคล่อง', amount: result.liquidAssets },
  ].filter((item) => item.amount > 0);

  return Object.freeze({
    toolName: 'การวางแผนทุนโรคร้ายแรง' as const,
    generatedDate: generatedAt.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    estimationMethod,
    methodLabel: CI_ESTIMATION_METHOD_LABELS[estimationMethod],
    mainNeedToday,
    existingCICover: result.existingCoverage,
    liquidAssets: result.liquidAssets,
    availableResources: result.availableResources,
    recoveryReserve: result.recoveryReserveNeed,
    protectedAssetsNeed: result.protectedAssetsNeed,
    shortfall: isIncomeMethod ? result.incomeShortfall : result.shortfall,
    surplus: isIncomeMethod ? result.incomeSurplus : result.surplus,
    targetItems: Object.freeze(targetItems.map((item) => Object.freeze(item))),
    resourceItems: Object.freeze(resourceItems.map((item) => Object.freeze(item))),
    breakdown,
    assessmentVersion,
    disclaimer: SUMMARY_DISCLAIMER,
    imageNotice: IMAGE_NOTICE,
  });
}

function amount(value: number): string {
  return Math.round(value).toLocaleString('th-TH');
}

function baht(value: number): string {
  return `${amount(value)} บาท`;
}

export async function renderCIResultImage(
  summary: Readonly<CIResultImageSummary>,
  logoPath = '/assets/ccpun-text-logo.svg',
  lineQrPath = '/assets/line-oa-qr.png',
): Promise<Blob> {
  const differenceLabel = summary.shortfall > 0
    ? 'ทุนที่ยังขาด'
    : summary.surplus > 0
      ? 'เงินและสินทรัพย์ที่มีมากกว่าประมาณการ'
      : 'ส่วนต่างจากประมาณการ';
  const differenceValue = summary.shortfall > 0 ? summary.shortfall : summary.surplus;
  const methodDetail = summary.breakdown
    ? `ครัวเรือน ${baht(summary.breakdown.household)} · การศึกษา ${baht(summary.breakdown.education)} · หนี้ ${baht(summary.breakdown.debt)}`
    : 'รายได้ต่อเดือน × 12 เดือน × จำนวนปีที่เลือก';

  return renderResultShareImage({
    toolName: summary.toolName,
    resultLabel: `ประมาณการทุนโรคร้ายแรงที่ควรมีจาก${summary.estimationMethod === 'income' ? 'รายได้' : 'รายจ่าย'}`,
    primaryAmount: baht(summary.mainNeedToday),
    metrics: [
      { label: 'เงินก้อนจากประกันโรคร้ายแรง', value: baht(summary.existingCICover) },
      { label: 'สินทรัพย์สภาพคล่อง', value: baht(summary.liquidAssets) },
      { label: differenceLabel, value: baht(differenceValue), emphasis: true },
    ],
    methodTitle: `ประเมินจาก${summary.estimationMethod === 'income' ? 'รายได้' : 'รายจ่าย'}`,
    methodDetail,
    dateLabel: `ประเมินเมื่อ ${summary.generatedDate}`,
    composition: {
      targetItems: summary.targetItems,
      resourceItems: summary.resourceItems,
      resourcesText: baht(summary.availableResources),
      targetAmount: summary.mainNeedToday,
      resourcesAmount: summary.availableResources,
      protectedAssetsAmount: summary.protectedAssetsNeed,
    },
    noticeTitle: summary.disclaimer,
    noticeDetail: summary.imageNotice,
    actionLabel: 'เพิ่มเพื่อน LINE @ccpun',
    scopeNote: summary.recoveryReserve > 0
      ? `Recovery Reserve ${baht(summary.recoveryReserve)} เป็นเงินก้อนสำหรับรักษา ฟื้นฟู และปรับการใช้ชีวิต แยกจากฐานรายได้/รายจ่าย แล้วบวก 1 ครั้งในวิธีที่เลือก`
      : 'การประเมินครั้งนี้ยังไม่ได้รวม Recovery Reserve เพิ่มจากฐานรายได้หรือรายจ่าย',
  }, logoPath, lineQrPath);
}
