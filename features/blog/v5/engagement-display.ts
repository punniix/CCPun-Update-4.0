// Display rules shared by v5 blog cards and the v5 article header (owner decision 2026-10-25).
// Views stay hidden until an article has a meaningful reading count; hearts show from the first one.
export const VIEW_COUNT_DISPLAY_MIN = 50;

/** Card batch read: at most this many IDs per request (matches the server limit). */
export const CARD_METRICS_BATCH_MAX = 24;

const count = new Intl.NumberFormat("th-TH");

export function displayedViews(views: number | null | undefined): string | null {
  return typeof views === "number" && Number.isSafeInteger(views) && views >= VIEW_COUNT_DISPLAY_MIN ? count.format(views) : null;
}

export function displayedHearts(hearts: number | null | undefined): string | null {
  return typeof hearts === "number" && Number.isSafeInteger(hearts) && hearts >= 1 ? count.format(hearts) : null;
}
