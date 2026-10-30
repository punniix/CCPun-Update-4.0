const bangkokDay = new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Bangkok",
});

/** Calendar dates, not elapsed 24-hour periods: Bangkok midnight can be minutes apart. */
export function articleUpdatedOnLaterBangkokDay(publishedAt?: string, updatedAt?: string): boolean {
  if (!publishedAt || !updatedAt) return false;
  const published = new Date(publishedAt);
  const updated = new Date(updatedAt);
  if (!Number.isFinite(published.getTime()) || !Number.isFinite(updated.getTime())) return false;
  return bangkokDay.format(updated) > bangkokDay.format(published);
}
