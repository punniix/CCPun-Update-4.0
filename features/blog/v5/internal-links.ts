/**
 * Render-time internal-link hygiene (internal-linking plan T09). Sanity content
 * is not changed: an editor's absolute `https://ccpun.com/...` link or a
 * relative link without its trailing slash is rendered as a root-relative URL
 * with the trailing slash, so it never costs a 308 hop and never sends UAT
 * readers to Production. External, mailto/tel, hash and file links are untouched.
 */
const SITE_HOSTS = new Set(["ccpun.com", "www.ccpun.com"]);
const FILE_EXTENSION = /\.[a-z0-9]{2,5}$/i;

export function normalizeInternalHref(href: string): string {
  const value = href.trim();
  if (!value || value.startsWith("#") || /^(mailto|tel|sms):/i.test(value)) return href;
  let url: URL;
  try { url = new URL(value, "https://ccpun.com"); } catch { return href; }
  const isRelative = value.startsWith("/") && !value.startsWith("//");
  if (!isRelative && !(url.protocol === "https:" || url.protocol === "http:")) return href;
  if (!isRelative && !SITE_HOSTS.has(url.hostname.toLowerCase())) return href;
  let path = url.pathname || "/";
  if (!path.endsWith("/") && !FILE_EXTENSION.test(path)) path += "/";
  return `${path}${url.search}${url.hash}`;
}

export function isInternalHref(href: string) {
  return normalizeInternalHref(href).startsWith("/") && !href.trim().startsWith("//");
}
