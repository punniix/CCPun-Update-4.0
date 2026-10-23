"use client";

import { usePublicCopy } from "./PublicCopyProvider";

interface MoneyComparisonProps {
  need: number;
  resources: number;
  title: string;
  needLabel?: string;
  resourcesLabel?: string;
}


export default function MoneyComparison({
  need,
  resources,
  title,
  needLabel: customNeedLabel,
  resourcesLabel: customResourcesLabel,
}: MoneyComparisonProps) {
  const t = usePublicCopy();
  const needLabel = customNeedLabel ?? t('site.money.need');
  const resourcesLabel = customResourcesLabel ?? t('site.money.resources');
  const baht = (value: number) => `${Math.round(value).toLocaleString('th-TH')} ${t('site.money.baht')}`;
  const gap = Math.max(need - resources, 0);
  const surplus = Math.max(resources - need, 0);
  const coveredPercent = need > 0 ? Math.min((resources / need) * 100, 100) : 0;

  return (
    <figure className="money-comparison space-y-4">
      <figcaption className="text-sm font-semibold text-foreground">{title}</figcaption>
      {need > 0 ? (
        <div aria-hidden="true" className="relative h-4 overflow-visible rounded-full border border-border/60 bg-secondary/70">
          <span
            className="absolute -inset-y-px left-[-1px] rounded-full border border-primary bg-primary/80 transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${coveredPercent}%` }}
          />
          <span
            className="absolute top-1/2 h-7 w-0.5 -translate-x-px -translate-y-1/2 bg-foreground"
            style={{ left: `${coveredPercent}%` }}
          />
        </div>
      ) : (
        <p className="rounded-xl border border-border/30 bg-background/25 p-4 text-sm text-muted-foreground">
          {t('site.money.empty')}
        </p>
      )}
      <dl className="grid gap-3 rounded-xl border border-border/30 bg-background/25 p-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">{needLabel}</dt>
          <dd className="mt-1 font-semibold tabular-nums text-foreground">{baht(need)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{resourcesLabel}</dt>
          <dd className="mt-1 font-semibold tabular-nums text-foreground">{baht(resources)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{gap > 0 ? t('site.money.gap') : surplus > 0 ? t('site.money.surplus') : t('site.money.balanced')}</dt>
          <dd className="mt-1 font-semibold tabular-nums text-primary">{baht(gap > 0 ? gap : surplus)}</dd>
        </div>
      </dl>
      <p className="sr-only" aria-live="polite">
        {needLabel} {baht(need)} {resourcesLabel} {baht(resources)} {gap > 0 ? t('site.money.gapSummary').replaceAll('{amount}', baht(gap)) : surplus > 0 ? t('site.money.surplusSummary').replaceAll('{amount}', baht(surplus)) : t('site.money.balancedSummary')}
      </p>
    </figure>
  );
}
