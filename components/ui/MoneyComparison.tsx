"use client";

import { usePublicCopy } from "./PublicCopyProvider";
import { useCountUp } from "./useCountUp";

// v5 motion round (UAT): structure and colours are inline so every renderer (tests, the retained 4.3 page)
// shows the same final state; the one-time transform/opacity motion lives with the v5 tool shell
// (V5Tool.module.css, `ccpun-money-*` hooks) and is removed for reduced motion.
// The bar no longer uses `border-primary bg-primary/80 transition-[width] duration-500`. The names stay
// listed here so the frozen, reviewed Tailwind output is byte-identical; retiring them needs its own
// compiler-proof review.
const HAVE_FILL = "color-mix(in srgb, var(--v5-text, #faf9f9) 78%, transparent)";
// The gap uses the gold text token: #e0c985 in dark, the darker #7a5c14 in light, so the gold gap keeps >= 3:1 against its track.
const GAP_FILL = "var(--v5-gold-text, #e0c985)";
const swatch = (background: string) => ({ display: "inline-block", width: 10, height: 10, marginRight: 8, borderRadius: 3, background });
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
  const shown = gap > 0 ? gap : surplus;
  const countRef = useCountUp<HTMLSpanElement>(shown, baht);

  return (
    <figure className="money-comparison space-y-4">
      <figcaption className="text-sm font-semibold text-foreground">{title}</figcaption>
      {need > 0 ? (
        <div key={`${need}:${resources}`} aria-hidden="true" className="relative h-4 overflow-visible rounded-full border border-border/60 bg-secondary/70">
          <span
            className="absolute -inset-y-px left-[-1px] rounded-full ccpun-money-have"
            style={{ width: `${coveredPercent}%`, background: HAVE_FILL }}
          />
          {gap > 0 ? <span className="ccpun-money-gap" style={{ position: "absolute", top: 0, bottom: 0, left: `${coveredPercent}%`, width: `${100 - coveredPercent}%`, borderRadius: "0 999px 999px 0", background: GAP_FILL }} /> : null}
          <span
            className="absolute top-1/2 h-7 w-0.5 -translate-x-px -translate-y-1/2 bg-foreground ccpun-money-divider"
            style={{ left: `${coveredPercent}%` }}
          />
        </div>
      ) : (
        <p className="rounded-xl border border-border/30 bg-background/25 p-4 text-sm text-muted-foreground">
          {t.node('site.money.empty')}
        </p>
      )}
      <dl className="grid gap-3 rounded-xl border border-border/30 bg-background/25 p-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">{needLabel}</dt>
          <dd className="mt-1 font-semibold tabular-nums text-foreground">{baht(need)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground"><span aria-hidden="true" style={swatch(HAVE_FILL)} />{resourcesLabel}</dt>
          <dd className="mt-1 font-semibold tabular-nums text-foreground">{baht(resources)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{gap > 0 ? <span aria-hidden="true" style={swatch(GAP_FILL)} /> : null}{gap > 0 ? t('site.money.gap') : surplus > 0 ? t('site.money.surplus') : t('site.money.balanced')}</dt>
          <dd className="mt-1 font-semibold tabular-nums text-primary">
            <span className="sr-only">{baht(shown)}</span>
            {/* The final amount reserves the width; the counting copy sits on top of it. */}
            <span aria-hidden="true" style={{ position: "relative", display: "inline-block" }}><span style={{ visibility: "hidden" }}>{baht(shown)}</span><span ref={countRef} style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap" }}>{baht(shown)}</span></span>
          </dd>
        </div>
      </dl>
      <p className="sr-only" aria-live="polite">
        {needLabel} {baht(need)} {resourcesLabel} {baht(resources)} {gap > 0 ? t('site.money.gapSummary').replaceAll('{amount}', baht(gap)) : surplus > 0 ? t('site.money.surplusSummary').replaceAll('{amount}', baht(surplus)) : t('site.money.balancedSummary')}
      </p>
    </figure>
  );
}
