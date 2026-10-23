import type { SITE_COPY_DEFAULTS } from "@/lib/content/site-copy-defaults";
import { CI_COPY_DEFAULTS } from '@/lib/content/tool-copy-defaults';
import type { CIEstimationMethod, CIResult } from './calculator/types';
import {
  RESULT_SHARE_IMAGE_WIDTH,
  renderResultShareImage,
} from '@/lib/shared/result-share-image';

export const RESULT_IMAGE_WIDTH = RESULT_SHARE_IMAGE_WIDTH;



export interface CIResultImageSummary {
  toolName: string;
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
  disclaimer: string;
  imageNotice: string;
}

export function createCIResultImageSummary(
  result: CIResult,
  estimationMethod: CIEstimationMethod,
  assessmentVersion: string,
  generatedAt: Date = new Date(),
  t: (key: keyof typeof CI_COPY_DEFAULTS) => string = (key) => CI_COPY_DEFAULTS[key],
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
    ? [{ label: t("ci.image.label"), amount: Math.max(mainNeedToday - result.recoveryReserveNeed - result.protectedAssetsNeed, 0) }]
    : [
      { label: t("ci.image.label2"), amount: result.householdNeed },
      { label: t("ci.image.label3"), amount: result.educationNeed },
      { label: t("ci.image.label4"), amount: result.debtNeed },
    ]).filter((item) => item.amount > 0);
  if (mainNeedToday > 0 && result.recoveryReserveNeed > 0) {
    targetItems.push({ label: t("ci.image.recoveryLabel").replaceAll("{value1}", String(t(`ci.recovery.mode.${result.recoveryMode}`))), amount: result.recoveryReserveNeed });
  }
  if (mainNeedToday > 0 && result.protectedAssetsNeed > 0) {
    targetItems.push({ label: t("ci.image.label5"), amount: result.protectedAssetsNeed });
  }
  const resourceItems = [
    { label: t("ci.image.label6"), amount: result.existingCoverage },
    { label: t("ci.image.label7"), amount: result.liquidAssets },
  ].filter((item) => item.amount > 0);

  return Object.freeze({
    toolName: t("ci.image.label8"),
    generatedDate: generatedAt.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    estimationMethod,
    methodLabel: t(estimationMethod === 'income' ? 'ci.method.income' : 'ci.method.expense'),
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
    disclaimer: t("ci.image.disclaimer"),
    imageNotice: t("ci.image.notice"),
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
  t: (key: keyof typeof CI_COPY_DEFAULTS) => string = (key) => CI_COPY_DEFAULTS[key],
  imageText?: (key: keyof typeof SITE_COPY_DEFAULTS) => string,
): Promise<Blob> {
  const differenceLabel = summary.shortfall > 0
    ? t("ci.image.label9")
    : summary.surplus > 0
      ? t("ci.image.label10")
      : t("ci.image.label11");
  const differenceValue = summary.shortfall > 0 ? summary.shortfall : summary.surplus;
  const methodDetail = summary.breakdown
    ? t("ci.image.expenseBreakdown").replaceAll("{value1}", String(baht(summary.breakdown.household))).replaceAll("{value2}", String(baht(summary.breakdown.education))).replaceAll("{value3}", String(baht(summary.breakdown.debt)))
    : t("ci.image.label12");

  return renderResultShareImage({
    toolName: summary.toolName,
    resultLabel: t("ci.image.resultLabel").replaceAll("{value1}", String(t(summary.estimationMethod === 'income' ? 'ci.image.incomeBasis' : 'ci.image.expenseBasis'))),
    primaryAmount: baht(summary.mainNeedToday),
    metrics: [
      { label: t("ci.image.label13"), value: baht(summary.existingCICover) },
      { label: t("ci.image.label7"), value: baht(summary.liquidAssets) },
      { label: differenceLabel, value: baht(differenceValue), emphasis: true },
    ],
    methodTitle: t("ci.image.methodTitle").replaceAll("{value1}", String(t(summary.estimationMethod === 'income' ? 'ci.image.incomeBasis' : 'ci.image.expenseBasis'))),
    methodDetail,
    dateLabel: t("ci.image.dateLabel").replaceAll("{value1}", String(summary.generatedDate)),
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
    actionLabel: t("ci.image.actionLabel"),
    scopeNote: summary.recoveryReserve > 0
      ? t("ci.image.recoveryScopeNote").replaceAll("{value1}", String(baht(summary.recoveryReserve)))
      : t("ci.image.label14"),
  }, logoPath, lineQrPath, imageText);
}
