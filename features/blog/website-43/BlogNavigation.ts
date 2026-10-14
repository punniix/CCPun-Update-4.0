export const BLOG_PAGE_SIZE = 6;
export function blogPage(value: string | number | null | undefined, total: number) {
  const pages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));
  const raw = String(value ?? '1');
  const requested = /^\d+$/.test(raw) ? Number(raw) : 1;
  return { page: Math.max(1, Math.min(pages, Number.isSafeInteger(requested) ? requested : 1)), pages };
}
export function blogPageHref(current: string, page: number) {
  const url = new URL(current, 'https://ccpun.com');
  if (page > 1) url.searchParams.set('page', String(page)); else url.searchParams.delete('page');
  return `${url.pathname}${url.search}`;
}
export function safeBlogReturn(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value, 'https://ccpun.com');
    return url.origin === 'https://ccpun.com' && /^\/blog\/(?:[^/]+\/)?$/.test(url.pathname)
      ? `${url.pathname}${url.search}` : null;
  } catch { return null; }
}
