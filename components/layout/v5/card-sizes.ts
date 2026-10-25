/*
 * Card cover `sizes` (v5 polish, UAT): the adaptive grids in V5.module.css pick their columns from the number of
 * cards (one card spans the row as a horizontal card, two or four share 2 columns, three or more take 3 from 1024px,
 * and in .cardGrid2 an odd last card spans the row). The hint follows the same rules so next/image picks a width
 * that covers the cover as drawn at every layout. Unknown counts take the widest layout the grid can reach.
 */
type V5SizesBand = { max?: number; vw: number; px: number; fixed?: number; gap: number; from: 0 | 640 | 1024 };

function v5Bands(narrow: boolean): V5SizesBand[] {
  // Content box of `.inner` (and `.narrow`): 20px gutters to 767px, 32px to 1199px, 80px from 1200px, max 1280 (narrow 1028).
  return [
    { max: 639, vw: 1, px: 40, gap: 16, from: 0 },
    { max: 767, vw: 1, px: 40, gap: 20, from: 640 },
    { max: 1023, vw: 1, px: 64, gap: 20, from: 640 },
    { max: 1199, vw: 1, px: 64, gap: 20, from: 1024 },
    narrow ? { max: 1439, vw: 0, px: 0, fixed: 1028, gap: 20, from: 1024 } : { max: 1439, vw: 1, px: 160, gap: 20, from: 1024 },
    { vw: 0, px: 0, fixed: narrow ? 1028 : 1280, gap: 20, from: 1024 },
  ];
}

/** Columns (or the horizontal 40% cover when 0) a card can reach in a v5 card grid of `count` cards at a band. */
function v5GridColumns(from: 0 | 640 | 1024, count: number | undefined, grid: "cardGrid" | "cardGrid2"): number {
  if (from === 0) return 1;
  if (count === 1) return 0;
  if (grid === "cardGrid2") {
    if (count === undefined || (count % 2 === 1 && !(from === 1024 && count === 3))) return 1;
    return from === 1024 && count === 3 ? 3 : 2;
  }
  if (from === 640 || count === undefined || count === 2 || count === 4) return 2;
  return 3;
}

export function v5CardGridSizes(count?: number, { grid = "cardGrid", narrow = false }: { grid?: "cardGrid" | "cardGrid2"; narrow?: boolean } = {}): string {
  const bands: Array<{ max?: number; value: string }> = [];
  for (const band of v5Bands(narrow)) {
    const cols = v5GridColumns(band.from, count, grid);
    const factor = cols === 0 ? 0.4 : 1 / cols;
    const gaps = cols > 1 ? (cols - 1) * band.gap / cols : 0;
    const value = band.fixed !== undefined
      ? `${Math.ceil(band.fixed * factor - gaps)}px`
      : `calc(${Math.ceil(band.vw * factor * 1000) / 10}vw - ${Math.floor(band.px * factor + gaps)}px)`;
    // Neighbouring bands with the same width merge into the later one.
    if (bands.length > 0 && bands[bands.length - 1].value === value) bands[bands.length - 1] = { max: band.max, value };
    else bands.push({ max: band.max, value });
  }
  return bands.map(({ max, value }) => max !== undefined ? `(max-width: ${max}px) ${value}` : value).join(", ");
}

/** Horizontal cards (home core guides, blog featured): a 38% cover; phones stack the card at full width. */
export const V5_HORIZONTAL_CARD_SIZES = "(max-width: 479px) calc(100vw - 40px), (max-width: 767px) calc(38vw - 15px), (max-width: 899px) calc(38vw - 24px), 240px";
