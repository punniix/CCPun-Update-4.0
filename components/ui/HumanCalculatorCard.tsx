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
  const progress = Math.max(0, Math.min(100, (step / total) * 100));
  return (
    <section
      aria-labelledby={labelledBy}
      data-ui="human-centered-calculator-card"
      className="mx-auto w-full max-w-[44rem] rounded-2xl border border-white/10 bg-[hsl(0_12%_27%_/_0.72)] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.16)] backdrop-blur-sm sm:p-5 md:p-6"
    >
      <div className="mb-5">
        <div className="flex items-center justify-between gap-4 text-xs font-medium text-primary">
          <span>ขั้นตอน {step} จาก {total}</span>
          <span className="text-white/45">ใช้ข้อมูลเท่าที่ทราบ</span>
        </div>
        <div
          role="progressbar"
          aria-label={`ขั้นตอน ${step} จาก ${total}`}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step}
          className="mt-3 h-0.5 overflow-hidden rounded-full bg-white/15"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="mb-5">
        <h3 id={labelledBy} tabIndex={-1} className="scroll-mt-28 rounded-sm text-lg font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xl">{title}</h3>
        {description ? <p className="mt-1.5 text-sm leading-6 text-white/55">{description}</p> : null}
      </div>
      <div className="space-y-5">{children}</div>
      {footer ? <div className="mt-6 border-t border-white/10 pt-4">{footer}</div> : null}
    </section>
  );
}
