export type ArticlePublicRouteOverride = {
  categorySlug: string;
  publicSlug: string;
};

// Public URL ownership can differ from the underlying Sanity document identity
// during a coordinated migration. Keep this list intentionally small and only
// use it for reviewed winner-page moves that must not publish unrelated drafts.
const ARTICLE_PUBLIC_ROUTE_OVERRIDES: Record<string, ArticlePublicRouteOverride> = {
  "critical-illness-insurance": {
    categorySlug: "critical-illness-insurance",
    publicSlug: "what-is-critical-illness-insurance",
  },
};

const SOURCE_SLUG_BY_PUBLIC_SLUG = new Map(
  Object.entries(ARTICLE_PUBLIC_ROUTE_OVERRIDES).map(([sourceSlug, override]) => [override.publicSlug, sourceSlug] as const),
);

export function getArticlePublicRouteOverride(sourceSlug?: string | null) {
  if (!sourceSlug) return null;
  return ARTICLE_PUBLIC_ROUTE_OVERRIDES[sourceSlug] ?? null;
}

export function getArticlePublicSlug(sourceSlug: string) {
  return getArticlePublicRouteOverride(sourceSlug)?.publicSlug ?? sourceSlug;
}

export function getArticleSourceSlugForPublicRoute(publicSlug: string) {
  return SOURCE_SLUG_BY_PUBLIC_SLUG.get(publicSlug) ?? publicSlug;
}

export function sourceSlugHasPublicRouteOverride(sourceSlug?: string | null) {
  return Boolean(sourceSlug && ARTICLE_PUBLIC_ROUTE_OVERRIDES[sourceSlug]);
}
