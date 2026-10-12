import type { Article } from "./types";
import { isContentSanityLaneAllowed } from "./sanity-lane";
import article from "./uat-tax-table-fixture.json";

// The exact COO-authorized public UX sample; it is not a CMS publication.
export function getUatTaxTableFixture(
  category: string,
  slug: string,
  variables: Record<string, string | undefined> = process.env,
): Article | null {
  if (category !== "personal-finance" || slug !== "uat-ux-tax-table-20261011") return null;
  if (variables.CCPUN_APP_ENV?.trim().toLowerCase() !== "web-uat"
    || variables.CCPUN_DEPLOYMENT_PROVIDER?.trim().toLowerCase() !== "hostinger"
    || variables.CCPUN_DEPLOYMENT_ROLE?.trim().toLowerCase() !== "web") return null;
  if (!isContentSanityLaneAllowed(
    variables.NEXT_PUBLIC_SANITY_PROJECT_ID,
    variables.NEXT_PUBLIC_SANITY_DATASET,
    "web-uat",
    variables.VERCEL_PROJECT_ID?.trim() ?? "",
    variables,
  )) return null;
  return article as Article;
}

export function withUatTaxTableFixture(articles: Article[], variables: Record<string, string | undefined> = process.env): Article[] {
  const fixture = getUatTaxTableFixture("personal-finance", "uat-ux-tax-table-20261011", variables);
  return fixture && !articles.some(article => article.slug === fixture.slug) ? [...articles, fixture] : articles;
}
