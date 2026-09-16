import { CI_ESTIMATION_METHOD_LABELS } from './calculator/constants';
import type { CIEstimationMethod, CIResult } from './calculator/types';
import {
  RESULT_SHARE_IMAGE_HEIGHT,
  RESULT_SHARE_IMAGE_WIDTH,
  renderResultShareImage,
} from '@/lib/shared/result-share-image';

export const RESULT_IMAGE_WIDTH = RESULT_SHARE_IMAGE_WIDTH;
export const RESULT_IMAGE_HEIGHT = RESULT_SHARE_IMAGE_HEIGHT;

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
  shortfall: number;
  surplus: number;
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
      // Kept in the export DTO as a separately labelled context value only.
      // It is NOT part of mainNeedToday or the expense-method shortfall.
      recovery: result.recoveryReserveNeed,
    });

  return Object.freeze({
    toolName: 'การวางแผนทุนโรคร้ายแรง' as const,
    generatedDate: generatedAt.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    estimationMethod,
    methodLabel: CI_ESTIMATION_METHOD_LABELS[estimationMethod],
    mainNeedToday: isIncomeMethod ? result.incomeBasedNeed : result.calculatedNeed,
    existingCICover: result.existingCoverage,
    liquidAssets: result.liquidAssets,
    availableResources: result.availableResources,
    recoveryReserve: result.recoveryReserveNeed,
    shortfall: isIncomeMethod ? result.incomeShortfall : result.shortfall,
    surplus: isIncomeMethod ? result.incomeSurplus : result.surplus,
    breakdown,
    assessmentVersion,
    disclaimer: SUMMARY_DISCLAIMER,
    imageNotice: IMAGE_NOTICE,
  });
}

function baht(value: number): string {
  return `${Math.round(value).toLocaleString('th-TH')} บาท`;
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
    ? 'ค่าใช้จ่ายครัวเรือน + ค่าเรียน + ภาระหนี้; Recovery Reserve คำนวณแยกและไม่รวมในทุนตามรายจ่าย'
    : 'รายได้ต่อเดือน × 12 เดือน × จำนวนปีที่เลือก; Recovery Reserve คำนวณแยกและไม่รวมในทุนตามรายได้';

  return renderResultShareImage({
    toolName: summary.toolName,
    resultLabel: `ประมาณการทุนเบื้องต้น · ${summary.methodLabel}`,
    primaryAmount: baht(summary.mainNeedToday),
    metrics: [
      { label: 'เงินก้อนจากประกันโรคร้ายแรง', value: baht(summary.existingCICover) },
      { label: 'สินทรัพย์สภาพคล่อง', value: baht(summary.liquidAssets) },
      { label: differenceLabel, value: baht(differenceValue), emphasis: true },
    ],
    methodTitle: `วิธีประมาณการทุนตาม${summary.methodLabel.replace('ทุนตาม', '')}`,
    methodDetail,
    noticeTitle: summary.disclaimer,
    noticeDetail: summary.imageNotice,
    actionLabel: 'เพิ่มเพื่อน LINE @ccpun',
    scopeNote: summary.recoveryReserve > 0
      ? `Recovery Reserve แยกต่างหาก ${baht(summary.recoveryReserve)}; แหล่งอ้างอิงหลักปี 2025–2026 และไม่บวกในทุนตามรายจ่ายหรือรายได้`
      : 'Recovery Reserve ยังเป็น 0 และคำนวณแยกจากทุนตามรายจ่ายและทุนตามรายได้',
  }, logoPath, lineQrPath);
}
