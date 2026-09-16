export type LifeCoverageValues = {
  householdMonthly: number;
  supportYears: number;
  debt: number;
  education: number;
  existingLifeCoverage: number;
  liquidAssets: number;
};

export const LIFE_COVERAGE_INITIAL_VALUES: LifeCoverageValues = {
  householdMonthly: 0,
  supportYears: 10,
  debt: 0,
  education: 0,
  existingLifeCoverage: 0,
  liquidAssets: 0,
};

export const formatLifeCoverageMoney = (value: number) => new Intl.NumberFormat('th-TH').format(value);

export function calculateLifeCoverage(values: LifeCoverageValues) {
  const familySupport = values.householdMonthly * 12 * values.supportYears;
  const need = familySupport + values.debt + values.education;
  const resources = values.existingLifeCoverage + values.liquidAssets;
  return { familySupport, need, resources, gap: Math.max(need - resources, 0) };
}
