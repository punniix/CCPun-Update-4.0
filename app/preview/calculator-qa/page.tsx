import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
const widths = [390, 600, 820, 1024, 1100, 1280, 1440, 1728, 1920];

/** Preview-only browser fixture: real same-origin page in a precisely sized viewport.
 * No copied calculator, injected answers, or production route override.
 */
export default async function CalculatorQA({ searchParams }: {
  searchParams: Promise<{ width?: string; tool?: string }>;
}) {
  if (process.env.VERCEL_ENV !== 'preview') notFound();
  const query = await searchParams;
  const width = Number(query.width ?? 390);
  if (!widths.includes(width) || !['fhc', 'ci'].includes(query.tool ?? 'fhc')) notFound();
  const tool = query.tool ?? 'fhc';
  const path = tool === 'ci' ? '/ci-planning/' : '/tools/financial-health-check/';
  return (
    <main id="main-content" style={{ padding: 16 }}>
      <h1>Calculator Preview QA · {tool.toUpperCase()} · {width}px</h1>
      <p>Real document viewport; use the form inside the frame. Production returns 404.</p>
      <nav aria-label="QA viewport" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBlock: 16 }}>
        {widths.map(value => <a key={value} href={`?tool=${tool}&width=${value}`}>{value}</a>)}
        <a href={`?tool=${tool === 'ci' ? 'fhc' : 'ci'}&width=${width}`}>Switch calculator</a>
      </nav>
      <iframe title="Calculator viewport" src={path} width={width} height={1000}
        style={{ display: 'block', width, minWidth: width, maxWidth: 'none', height: 1000, border: 0 }} />
    </main>
  );
}
