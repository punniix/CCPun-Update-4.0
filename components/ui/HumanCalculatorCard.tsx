"use client";

import { usePublicCopy } from "./PublicCopyProvider";
import type { ReactNode } from 'react';

export default function HumanCalculatorCard({
  step,
  total,
  title,
  description,
  children,
  footer,
  labelledBy,
}: {
  step: number;
  total: number;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy?: string;
}) {
  const t = usePublicCopy();
  const progressLabel = t('site.calculator.progress').replaceAll('{step}', String(step)).replaceAll('{total}', String(total));
  const progress = Math.max(0, Math.min(100, (step / total) * 100));

  return (
    <section
      aria-labelledby={labelledBy}
      data-ui="human-centered-calculator-card"
      className="mx-auto w-full max-w-[48rem] rounded-2xl border p-4 sm:p-5 md:p-6"
      style={{
        borderColor: 'var(--w43-border)',
        background: 'var(--w43-surface)',
      }}
    >
      <div className="mb-5">
        <div className="flex items-center justify-between gap-4 text-xs font-medium">
          <span style={{ color: 'var(--w43-gold)' }}>{progressLabel}</span>
          <span style={{ color: 'var(--w43-muted)' }}>{t.node('site.calculator.knownData')}</span>
        </div>
        <div
          role="progressbar"
          aria-label={progressLabel}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step}
          className="mt-3 h-px overflow-hidden rounded-full"
          style={{ background: 'rgba(250,249,249,.14)' }}
        >
          <div
            data-ui="calculator-progress-fill"
            className="h-full rounded-full "
            style={{ width: `${progress}%`, background: 'var(--w43-gold)' }}
          />
        </div>
      </div>

      <div className="mb-5">
        <h3
          id={labelledBy}
          tabIndex={-1}
          className="scroll-mt-28 rounded-sm text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xl"
          style={{ color: 'var(--w43-ink)' }}
        >
          {title}
        </h3>
        {description ? (
          <p className="mt-1.5 text-sm leading-6" style={{ color: 'var(--w43-muted)' }}>{description}</p>
        ) : null}
      </div>

      <div className="space-y-5">{children}</div>
      {footer ? (
        <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--w43-border)' }}>{footer}</div>
      ) : null}
    </section>
  );
}
