import { getMovedArticleRedirectPath } from "../../content/url";

export type MarketingUrlIdentity = {
  observedUrl: string | null;
  canonicalUrl: string | null;
  mappingStatus: "current" | "redirected" | "legacy-unresolved" | "external";
};

const LEGACY_BLOG_DESTINATIONS: Record<string, string> = {
  "aia-health-happy-describe": "https://ccpun.com/blog/health-insurance/aia-health-happy-describe/",
  "aia-health-ci-hero-guide": "https://ccpun.com/blog/health-insurance/aia-health-ci-hero-guide/",
  "financial-pyramid": "https://ccpun.com/blog/personal-finance/financial-pyramid/",
  "aia-vitality": "https://ccpun.com/blog/life-insurance/aia-vitality/",
  "critical-illness-insurance": "https://ccpun.com/blog/critical-illness-insurance/what-is-critical-illness-insurance/",
};

function normalizePathname(pathname: string) {
  if (pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname : pathname + "/";
}

function normalizeUrlObject(url: URL) {
  url.hash = "";
  url.search = "";
  if (url.hostname === "www.ccpun.com") url.hostname = "ccpun.com";
  url.pathname = normalizePathname(url.pathname);
  return url;
}

export function canonicalizeMarketingUrl(value: unknown): MarketingUrlIdentity {
  if (typeof value !== "string" || !value.trim()) return { observedUrl: null, canonicalUrl: null, mappingStatus: "current" };
  const raw = value.trim();
  let observed: URL;
  try {
    observed = normalizeUrlObject(new URL(raw, "https://ccpun.com"));
  } catch {
    return { observedUrl: raw, canonicalUrl: raw, mappingStatus: "external" };
  }

  const observedUrl = observed.href;
  if (observed.hostname === "blog.ccpun.com") {
    const segments = observed.pathname.split("/").filter(Boolean);
    if (!segments.length) return { observedUrl, canonicalUrl: "https://ccpun.com/blog/", mappingStatus: "redirected" };
    const destination = segments.length === 1 ? LEGACY_BLOG_DESTINATIONS[segments[0]!] : undefined;
    return destination
      ? { observedUrl, canonicalUrl: destination, mappingStatus: "redirected" }
      : { observedUrl, canonicalUrl: observedUrl, mappingStatus: "legacy-unresolved" };
  }

  if (observed.hostname === "ccpun.com") {
    const segments = observed.pathname.split("/").filter(Boolean);
    if (segments[0] === "blog" && segments.length >= 3) {
      const category = segments[1]!;
      const slug = segments[2]!;
      const moved = getMovedArticleRedirectPath(category, slug);
      if (moved) return { observedUrl, canonicalUrl: "https://ccpun.com" + moved, mappingStatus: "redirected" };
    }
    return { observedUrl, canonicalUrl: observedUrl, mappingStatus: "current" };
  }

  return { observedUrl, canonicalUrl: observedUrl, mappingStatus: "external" };
}
