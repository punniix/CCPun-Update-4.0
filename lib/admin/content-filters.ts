export const CONTENT_SORT_KEYS = [
  "title",
  "document-status",
  "review-status",
  "seo-score",
  "published-at",
  "updated-at",
] as const;

export type ContentSortKey = (typeof CONTENT_SORT_KEYS)[number];
export type ContentSortOrder = "asc" | "desc";

export type ContentFilterParams = {
  category?: string | string[];
  tag?: string | string[];
  sort?: string | string[];
  order?: string | string[];
};

type FilterableContentRow = {
  id?: string;
  title?: string | null;
  category?: string | null;
  tags?: readonly string[] | null;
  reviewStatus?: string | null;
  seoScore?: number | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  isDraft?: boolean;
  hasPublished?: boolean;
};

const REVIEW_STATUS_RANK: Record<string, number> = {
  "content-review": 0,
  "ready-for-coo": 1,
  approved: 2,
};

const DEFAULT_SORT: ContentSortKey = "updated-at";
const DEFAULT_ORDER: ContentSortOrder = "desc";

export function normalizeContentFilterParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function defaultContentSortOrder(sort: ContentSortKey): ContentSortOrder {
  return sort === "title" || sort === "document-status" || sort === "review-status" ? "asc" : "desc";
}

export function resolveContentSort(params: Pick<ContentFilterParams, "sort" | "order">) {
  const requestedSort = normalizeContentFilterParam(params.sort);
  const sort = CONTENT_SORT_KEYS.includes(requestedSort as ContentSortKey)
    ? requestedSort as ContentSortKey
    : DEFAULT_SORT;
  const requestedOrder = normalizeContentFilterParam(params.order);
  const order = requestedOrder === "asc" || requestedOrder === "desc"
    ? requestedOrder
    : sort === DEFAULT_SORT ? DEFAULT_ORDER : defaultContentSortOrder(sort);

  return { sort, order };
}

function tagKey(value: string) {
  return value.trim().toLowerCase();
}

export function getContentTags(tags: readonly string[] | null | undefined) {
  const seen = new Set<string>();
  const cleanedTags: string[] = [];

  for (const value of tags ?? []) {
    const tag = value.trim();
    const key = tagKey(tag);
    if (!tag || seen.has(key)) continue;

    seen.add(key);
    cleanedTags.push(tag);
  }

  return cleanedTags;
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "th"));
}

function uniqueTags(values: readonly string[]) {
  return getContentTags(values);
}

export function getContentFilterOptions(rows: readonly FilterableContentRow[]) {
  return {
    categories: uniqueSorted(
      rows
        .map((row) => row.category?.trim() ?? "")
        .filter(Boolean),
    ),
    tags: uniqueTags(rows.flatMap((row) => getContentTags(row.tags))),
  };
}

export function filterContentRows<T extends FilterableContentRow>(
  rows: readonly T[],
  filters: { category?: string; tag?: string },
) {
  const category = filters.category?.trim() ?? "";
  const tag = filters.tag?.trim() ?? "";
  const selectedTagKey = tagKey(tag);

  return rows.filter((row) => {
    const matchesCategory = !category || row.category?.trim() === category;
    const matchesTag = !tag || getContentTags(row.tags).some((value) => tagKey(value) === selectedTagKey);
    return matchesCategory && matchesTag;
  });
}

function compareNullable<T>(
  left: T | null | undefined,
  right: T | null | undefined,
  compare: (a: T, b: T) => number,
  order: ContentSortOrder,
) {
  const leftMissing = left === null || left === undefined || left === "";
  const rightMissing = right === null || right === undefined || right === "";
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  const result = compare(left as T, right as T);
  return order === "asc" ? result : -result;
}

function documentStatusRank(row: FilterableContentRow) {
  if (!row.hasPublished) return 0;
  return row.isDraft ? 1 : 2;
}

function reviewStatusRank(value: string | null | undefined) {
  if (!value || REVIEW_STATUS_RANK[value] === undefined) return null;
  return REVIEW_STATUS_RANK[value];
}

function compareDate(left: string, right: string) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
  if (Number.isNaN(leftTime)) return 1;
  if (Number.isNaN(rightTime)) return -1;
  return leftTime - rightTime;
}

function compareTitle(left: string, right: string) {
  return left.localeCompare(right, "th", { sensitivity: "base", numeric: true });
}

export function sortContentRows<T extends FilterableContentRow>(
  rows: readonly T[],
  sort: ContentSortKey,
  order: ContentSortOrder,
) {
  return [...rows].sort((left, right) => {
    let result = 0;

    if (sort === "title") {
      result = compareNullable(left.title?.trim(), right.title?.trim(), compareTitle, order);
    } else if (sort === "document-status") {
      const rankDelta = documentStatusRank(left) - documentStatusRank(right);
      result = order === "asc" ? rankDelta : -rankDelta;
    } else if (sort === "review-status") {
      result = compareNullable(
        reviewStatusRank(left.reviewStatus),
        reviewStatusRank(right.reviewStatus),
        (a, b) => a - b,
        order,
      );
    } else if (sort === "seo-score") {
      result = compareNullable(left.seoScore, right.seoScore, (a, b) => a - b, order);
    } else if (sort === "published-at") {
      result = compareNullable(left.publishedAt, right.publishedAt, compareDate, order);
    } else {
      result = compareNullable(left.updatedAt, right.updatedAt, compareDate, order);
    }

    if (result !== 0) return result;

    const updatedTieBreak = compareNullable(left.updatedAt, right.updatedAt, compareDate, "desc");
    if (updatedTieBreak !== 0) return updatedTieBreak;

    return compareNullable(left.title?.trim(), right.title?.trim(), compareTitle, "asc");
  });
}

export function resolveContentFilters<T extends FilterableContentRow>(
  rows: readonly T[],
  params: ContentFilterParams,
) {
  const { categories, tags } = getContentFilterOptions(rows);
  const requestedCategory = normalizeContentFilterParam(params.category);
  const requestedTag = normalizeContentFilterParam(params.tag);
  const category = categories.includes(requestedCategory) ? requestedCategory : "";
  const requestedTagKey = tagKey(requestedTag);
  const tag = tags.find((value) => tagKey(value) === requestedTagKey) ?? "";
  const { sort, order } = resolveContentSort(params);

  return {
    categories,
    tags,
    category,
    tag,
    sort,
    order,
    rows: sortContentRows(filterContentRows(rows, { category, tag }), sort, order),
  };
}
