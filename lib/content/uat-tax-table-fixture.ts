import type { Article } from "./types";
import { isContentSanityLaneAllowed } from "./sanity-lane";
import { getArticlePath, getArticleCategorySlug } from "./url";
import article from "./uat-tax-table-fixture.json";
import snapshots from "./uat-public-article-snapshots.json";

// COO-authorized public snapshots for matched UAT review; no CMS publication.
function uatFixtures(variables: Record<string, string | undefined>): Article[] {
  if (variables.CCPUN_APP_ENV?.trim().toLowerCase() !== "web-uat"
    || variables.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() !== "hostinger"
    || variables.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase() !== "web") return [];
  if (!isContentSanityLaneAllowed(
    variables.NEXT_PUBLIC_SANITY_PROJECT_ID,
    variables.NEXT_PUBLIC_SANITY_DATASET,
    "web-uat",
    variables.VERCEL_PROJECT_ID?.trim() ?? "",
    variables,
  )) return [];
  return [article, ...snapshots] as Article[];
}

export function getUatTaxTableFixture(
  category: string,
  slug: string,
  variables: Record<string, string | undefined> = process.env,
): Article | null {
  const path = `/blog/${category}/${slug}/`;
  return uatFixtures(variables).find(item => getArticlePath(item) === path) ?? null;
}

export function withUatTaxTableFixture(articles: Article[], variables: Record<string, string | undefined> = process.env): Article[] {
  const fixtures = uatFixtures(variables);
  if (!fixtures.length) return articles;
  const slugs = new Set(articles.map(item => item.slug));
  return [...articles, ...fixtures.filter(item => !slugs.has(item.slug))];
}

export function withUatSnapshotCategoryMenu(
  menu: Array<{ slug: string | null; title: string }>,
  excludedSlugs: readonly string[] = [],
  variables: Record<string, string | undefined> = process.env,
): Array<{ slug: string | null; title: string }> {
  const fixtures = uatFixtures(variables).filter(item => item.id.startsWith("uat-public-snapshot-"));
  if (!fixtures.length) return menu;
  const slugs = new Set([...menu.map(item => item.slug), ...excludedSlugs]);
  const result = [...menu];
  for (const fixture of fixtures) {
    const slug = getArticleCategorySlug(fixture);
    if (slugs.has(slug)) continue;
    result.push({ slug, title: fixture.category });
    slugs.add(slug);
  }
  return result;
}
