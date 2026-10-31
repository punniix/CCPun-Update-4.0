// Current owner audit (2026-10-31): show every confirmed view, including low counts.
// A null aggregate means historical data is unknown; it is not an observed zero.
export const VIEW_COUNT_DISPLAY_MIN = 1;

/** Card batch read: at most this many IDs per request (matches the server limit). */
export const CARD_METRICS_BATCH_MAX = 24;

const count = new Intl.NumberFormat("th-TH");

export function displayedViews(views: number | null | undefined): string | null {
  return typeof views === "number" && Number.isSafeInteger(views) && views >= VIEW_COUNT_DISPLAY_MIN ? count.format(views) : null;
}

export function displayedHearts(hearts: number | null | undefined): string | null {
  return typeof hearts === "number" && Number.isSafeInteger(hearts) && hearts >= 0 ? count.format(hearts) : null;
}
