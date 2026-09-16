type ToolHeroProps = {
  badge: string;
  title: string;
  highlight: string;
  highlightOnNewLine?: boolean;
  suffix?: string;
  description: string;
};

export default function ToolHero({
  badge,
  title,
  highlight,
  highlightOnNewLine = false,
  suffix,
  description,
}: ToolHeroProps) {
  return (
    <section className="relative isolate w-full overflow-hidden border-b border-border/30 pb-10 pt-28 md:pb-12">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20"
        style={{
          background:
            'radial-gradient(ellipse at 50% -35%, hsl(45 60% 70% / 0.14), transparent 58%), linear-gradient(180deg, hsl(0 25% 14%) 0%, hsl(0 15% 18%) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-primary/55 to-transparent"
      />

      <div className="mx-auto max-w-3xl px-4 text-center">
        <span className="mb-4 inline-block rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {badge}
        </span>
        <h1 className={`mx-auto mb-4 text-[clamp(2rem,5vw,3rem)] font-bold leading-[1.2] text-foreground [text-wrap:balance] ${highlightOnNewLine ? 'max-w-[32ch]' : 'max-w-[18ch]'}`}>
          <span className={highlightOnNewLine ? 'block md:whitespace-nowrap' : undefined}>{title}</span>
          <span className={`${highlightOnNewLine ? 'block md:whitespace-nowrap' : ''} text-primary`}>{highlight}</span>{' '}
          {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
        </h1>
        <div
          className="w-20 h-1 mx-auto rounded-full mb-4"
          style={{ background: 'linear-gradient(90deg, transparent, hsl(45,60%,70%), transparent)' }}
        />
        <p className="mx-auto max-w-[58ch] text-base leading-relaxed text-foreground/80 md:text-[1.0625rem]">
          {description}
        </p>
      </div>
    </section>
  );
}
