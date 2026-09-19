import "server-only";

import { sanityContentProvider } from "../../content/sanity";
import {
  buildLineArticleFlexMessage,
  selectLineDiscoveryArticles,
} from "../../line/content-cards";
import type { LineJourneyId } from "../../line/ecosystem";

export async function readPublishedLineDiscoveryArticles(journey: LineJourneyId) {
  const articles = await sanityContentProvider.listArticles({ includeDrafts: false });
  return selectLineDiscoveryArticles(journey, articles);
}

export async function buildPublishedLineArticleFlexMessage(journey: LineJourneyId) {
  const articles = await sanityContentProvider.listArticles({ includeDrafts: false });
  return buildLineArticleFlexMessage(journey, articles);
}
