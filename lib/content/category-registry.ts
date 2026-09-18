import { z } from "zod";
import { getArticlePublicRouteOverride } from "./article-route-overrides";

export const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CATEGORY_STATUS_VALUES = ["draft", "active"] as const;

export type CategoryStatus = (typeof CATEGORY_STATUS_VALUES)[number];

export type CategoryRegistryEntry = {
  id: string;
  title: string;
  slug: string;
  status: CategoryStatus;
  description?: string;
  redirectToId?: string;
  redirectToSlug?: string;
};

export type CategoryRegistryIssueCode =
  | "invalid-record"
  | "duplicate-slug"
  | "route-collision"
  | "canonical-collision"
  | "active-has-redirect"
  | "deactivation-without-redirect"
  | "redirect-self"
  | "redirect-target-missing"
  | "redirect-target-not-active"
  | "redirect-chain"
  | "redirect-loop"
  | "redirect-target-unsafe";

export type CategoryRegistryIssue = {
  id: string;
  slug?: string;
  code: CategoryRegistryIssueCode;
};

export type CategoryRegistry = {
  available: boolean;
  entries: CategoryRegistryEntry[];
  active: CategoryRegistryEntry[];
  claimedSlugs: Set<string>;
  issues: CategoryRegistryIssue[];
};

export type CategoryRegistryContext = {
  routeOwnerSlugs?: Iterable<string>;
  canonicalOwnerUrls?: Iterable<string>;
  referencedCategoryIds?: Iterable<string>;
};

export type RawCategoryRegistryRow = {
  _id?: unknown;
  title?: unknown;
  slug?: unknown;
  status?: unknown;
  description?: unknown;
  redirectToId?: unknown;
  redirectToSlug?: unknown;
};

const rawCategorySchema = z.object({
  _id: z.string().min(1),
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(CATEGORY_SLUG_PATTERN),
  status: z.enum(CATEGORY_STATUS_VALUES),
  description: z.string().trim().nullish(),
  redirectToId: z.string().trim().min(1).nullish(),
  redirectToSlug: z.string().trim().min(1).nullish(),
});

function normalizeDocumentId(id: string) {
  return id.replace(/^drafts\./, "");
}

function normalizeCanonical(value: string) {
  try {
    const url = new URL(value);
    if (url.origin !== "https://ccpun.com" || url.username || url.password || url.search || url.hash) return null;
    return `${url.origin}${url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`}`;
  } catch {
    return null;
  }
}

export function getCategoryCanonical(slug: string) {
  if (!CATEGORY_SLUG_PATTERN.test(slug)) throw new Error("Invalid category slug");
  return `https://ccpun.com/blog/${slug}/`;
}

function uniqueNormalized(values?: Iterable<string>) {
  return new Set([...(values ?? [])].map((value) => value.trim()).filter(Boolean));
}

function addIssue(
  issuesById: Map<string, CategoryRegistryIssue[]>,
  entry: Pick<CategoryRegistryEntry, "id" | "slug">,
  code: CategoryRegistryIssueCode,
) {
  const current = issuesById.get(entry.id) ?? [];
  if (!current.some((issue) => issue.code === code)) current.push({ id: entry.id, slug: entry.slug, code });
  issuesById.set(entry.id, current);
}

function findRedirectLoops(entries: CategoryRegistryEntry[]) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const loopIds = new Set<string>();

  for (const start of entries) {
    const path: string[] = [];
    const seenAt = new Map<string, number>();
    let current: CategoryRegistryEntry | undefined = start;
    while (current?.redirectToId) {
      const index = seenAt.get(current.id);
      if (index !== undefined) {
        for (const id of path.slice(index)) loopIds.add(id);
        break;
      }
      seenAt.set(current.id, path.length);
      path.push(current.id);
      current = byId.get(current.redirectToId);
    }
  }

  return loopIds;
}

export function buildCategoryRegistry(
  rawRows: readonly RawCategoryRegistryRow[],
  context: CategoryRegistryContext = {},
): CategoryRegistry {
  const issuesById = new Map<string, CategoryRegistryIssue[]>();
  const claimedSlugs = new Set<string>();
  const entryCandidates = new Map<string, { entry: CategoryRegistryEntry; isDraft: boolean }>();

  rawRows.forEach((raw, index) => {
    const possibleSlug = typeof raw?.slug === "string" ? raw.slug.trim().toLowerCase() : "";
    if (CATEGORY_SLUG_PATTERN.test(possibleSlug)) claimedSlugs.add(possibleSlug);

    const parsed = rawCategorySchema.safeParse(raw);
    if (!parsed.success) {
      const id = typeof raw?._id === "string" && raw._id.trim() ? normalizeDocumentId(raw._id.trim()) : `invalid:${index}`;
      issuesById.set(id, [{ id, slug: possibleSlug || undefined, code: "invalid-record" }]);
      return;
    }

    const row = parsed.data;
    const id = normalizeDocumentId(row._id);
    const candidate = {
      entry: {
        id,
        title: row.title.trim(),
        slug: row.slug.trim().toLowerCase(),
        status: row.status,
        ...(row.description?.trim() ? { description: row.description.trim() } : {}),
        ...(row.redirectToId ? { redirectToId: normalizeDocumentId(row.redirectToId) } : {}),
        ...(row.redirectToSlug?.trim() ? { redirectToSlug: row.redirectToSlug.trim().toLowerCase() } : {}),
      } satisfies CategoryRegistryEntry,
      isDraft: row._id.startsWith("drafts."),
    };

    const existing = entryCandidates.get(id);
    if (!existing || (!existing.isDraft && candidate.isDraft)) {
      entryCandidates.set(id, candidate);
      // A raw Published + Draft pair is one logical Sanity document. If the
      // selected current candidate is valid, do not keep an invalid-record
      // issue from the superseded variant.
      issuesById.delete(id);
    }
  });

  const entries = [...entryCandidates.values()].map(({ entry }) => entry);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const bySlug = new Map<string, CategoryRegistryEntry[]>();
  for (const entry of entries) {
    const group = bySlug.get(entry.slug) ?? [];
    group.push(entry);
    bySlug.set(entry.slug, group);
  }

  for (const group of bySlug.values()) {
    if (group.length < 2) continue;
    for (const entry of group) addIssue(issuesById, entry, "duplicate-slug");
  }

  const routeOwnerSlugs = uniqueNormalized(context.routeOwnerSlugs);
  const canonicalOwnerUrls = new Set(
    [...(context.canonicalOwnerUrls ?? [])]
      .map((value) => normalizeCanonical(value))
      .filter((value): value is string => Boolean(value)),
  );
  const referencedCategoryIds = new Set(
    [...(context.referencedCategoryIds ?? [])].map((id) => normalizeDocumentId(id.trim())).filter(Boolean),
  );

  for (const entry of entries) {
    if (routeOwnerSlugs.has(entry.slug)) addIssue(issuesById, entry, "route-collision");
    if (canonicalOwnerUrls.has(getCategoryCanonical(entry.slug))) addIssue(issuesById, entry, "canonical-collision");

    if (entry.status === "active" && entry.redirectToId) addIssue(issuesById, entry, "active-has-redirect");
    if (entry.status === "draft" && referencedCategoryIds.has(entry.id) && !entry.redirectToId) {
      addIssue(issuesById, entry, "deactivation-without-redirect");
    }

    if (!entry.redirectToId) continue;
    if (entry.redirectToId === entry.id) {
      addIssue(issuesById, entry, "redirect-self");
      continue;
    }
    const target = byId.get(entry.redirectToId);
    if (!target) {
      addIssue(issuesById, entry, "redirect-target-missing");
      continue;
    }
    if (target.status !== "active") addIssue(issuesById, entry, "redirect-target-not-active");
    if (target.redirectToId) addIssue(issuesById, entry, "redirect-chain");
    if (entry.redirectToSlug && entry.redirectToSlug !== target.slug) addIssue(issuesById, entry, "redirect-target-unsafe");
  }

  for (const id of findRedirectLoops(entries)) {
    const entry = byId.get(id);
    if (entry) addIssue(issuesById, entry, "redirect-loop");
  }

  // A redirect is only as safe as its final target. This is deliberately a
  // second pass so an unrelated invalid category cannot poison healthy rows.
  for (const entry of entries) {
    if (!entry.redirectToId) continue;
    const target = byId.get(entry.redirectToId);
    if (target && (issuesById.get(target.id)?.length ?? 0) > 0) addIssue(issuesById, entry, "redirect-target-unsafe");
  }

  const safeEntries = entries
    .filter((entry) => (issuesById.get(entry.id)?.length ?? 0) === 0)
    .sort((left, right) => left.title.localeCompare(right.title, "th"));

  return {
    available: true,
    entries: safeEntries,
    active: safeEntries.filter((entry) => entry.status === "active"),
    claimedSlugs,
    issues: [...issuesById.values()].flat(),
  };
}

export function emptyCategoryRegistry(available = false): CategoryRegistry {
  return { available, entries: [], active: [], claimedSlugs: new Set(), issues: [] };
}

export async function loadCategoryRegistrySafe(
  fetcher: () => Promise<{ rows: RawCategoryRegistryRow[]; context?: CategoryRegistryContext }>,
): Promise<CategoryRegistry> {
  try {
    const result = await fetcher();
    return buildCategoryRegistry(result.rows, result.context);
  } catch {
    return emptyCategoryRegistry(false);
  }
}

export function listCategoryMenuEntries(registry: CategoryRegistry, includeDrafts = false) {
  return registry.entries.filter((entry) => entry.status === "active" || includeDrafts);
}

export type CategoryRouteResolution =
  | { kind: "category"; category: CategoryRegistryEntry; noindex: boolean }
  | { kind: "redirect"; destinationSlug: string }
  | { kind: "hidden" }
  | { kind: "missing" };

export function resolveCategoryRoute(
  registry: CategoryRegistry,
  slug: string,
  options: { includeDrafts: boolean },
): CategoryRouteResolution {
  const normalized = slug.trim().toLowerCase();
  const entry = registry.entries.find((candidate) => candidate.slug === normalized);
  if (entry) {
    if (entry.status === "active") return { kind: "category", category: entry, noindex: options.includeDrafts };
    if (options.includeDrafts) return { kind: "category", category: entry, noindex: true };
    if (entry.redirectToSlug) return { kind: "redirect", destinationSlug: entry.redirectToSlug };
    return { kind: "hidden" };
  }
  if (registry.claimedSlugs.has(normalized)) return { kind: "hidden" };
  return { kind: "missing" };
}

export function articleBelongsToPhysicalCategory(
  article: { slug?: string | null; categorySlug?: string | null },
  category: Pick<CategoryRegistryEntry, "slug">,
) {
  const reviewedOwner = getArticlePublicRouteOverride(article.slug)?.categorySlug;
  const categorySlug = reviewedOwner ?? article.categorySlug?.trim().toLowerCase();
  return categorySlug === category.slug;
}

export function listPhysicalCategorySitemapEntries(
  registry: CategoryRegistry,
  articles: readonly { slug?: string | null; categorySlug?: string | null }[],
  options: { isCategoryIndexable?: (category: CategoryRegistryEntry) => boolean } = {},
) {
  const isCategoryIndexable = options.isCategoryIndexable ?? (() => true);
  return registry.active.flatMap((category) => {
    if (!isCategoryIndexable(category)) return [];
    if (!articles.some((article) => articleBelongsToPhysicalCategory(article, category))) return [];
    return [{ loc: getCategoryCanonical(category.slug) }];
  });
}
