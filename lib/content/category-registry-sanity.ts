import "server-only";

import { groq } from "next-sanity";
import { sanityFetch } from "@/lib/sanity-live";
import { IS_DRAFT_PREVIEW_ALLOWED } from "@/lib/deployment-environment";
import { sourceSlugHasPublicRouteOverride } from "./article-route-overrides";
import {
  buildCategoryRegistry,
  emptyCategoryRegistry,
  type CategoryRegistry,
  type CategoryRegistryContext,
  type RawCategoryRegistryRow,
} from "./category-registry";

const categoryRegistryQuery = groq`{
  "categories": *[_type == "category"] | order(title asc) {
    _id,
    title,
    "slug": slug.current,
    status,
    description,
    "featuredArticleIds": featuredArticles[]._ref,
    "redirectToId": redirectTo._ref,
    "redirectToSlug": redirectTo->slug.current
  },
  "routeOwnerSlugs": *[_type == "article" && defined(slug.current)].slug.current,
  "canonicalOwnerUrls": *[_type == "article" && defined(seo.canonical)].seo.canonical,
  "referencedCategoryIds": *[_type == "article" && defined(publishedAt) && defined(category._ref)].category._ref
}`;

type RawRegistryResponse = {
  categories?: unknown;
  routeOwnerSlugs?: unknown;
  canonicalOwnerUrls?: unknown;
  referencedCategoryIds?: unknown;
};

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function reportRegistryIssue(scope: string, detail: Record<string, unknown>) {
  console.error("[sanity-category-registry]", scope, detail);
}

export async function listCategoryRegistry(options: { includeDrafts?: boolean } = {}): Promise<CategoryRegistry> {
  const includeDrafts = options.includeDrafts === true;
  if (includeDrafts && !IS_DRAFT_PREVIEW_ALLOWED) return emptyCategoryRegistry(false);

  try {
    const { data } = await sanityFetch({
      query: categoryRegistryQuery,
      perspective: includeDrafts ? "drafts" : "published",
      stega: includeDrafts,
    });
    const raw = (data ?? {}) as RawRegistryResponse;
    const rows = Array.isArray(raw.categories) ? raw.categories as RawCategoryRegistryRow[] : [];
    const context: CategoryRegistryContext = {
      // A Sanity source slug that has an explicit public-route override no longer
      // owns the one-segment /blog/{slug}/ fallback route. Excluding it here lets
      // the reviewed destination category claim that segment without weakening
      // collision checks for ordinary article slugs.
      routeOwnerSlugs: stringArray(raw.routeOwnerSlugs).filter((slug) => !sourceSlugHasPublicRouteOverride(slug)),
      canonicalOwnerUrls: stringArray(raw.canonicalOwnerUrls),
      referencedCategoryIds: stringArray(raw.referencedCategoryIds),
    };
    const registry = buildCategoryRegistry(rows, context);
    if (registry.issues.length) {
      reportRegistryIssue("records-isolated", {
        issueCount: registry.issues.length,
        codes: [...new Set(registry.issues.map((issue) => issue.code))].sort(),
      });
    }
    return registry;
  } catch (error) {
    reportRegistryIssue("request-failed", { type: error instanceof Error ? error.name : "unknown" });
    return emptyCategoryRegistry(false);
  }
}
