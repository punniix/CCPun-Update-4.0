import "server-only";

import { sanityContentProvider } from "../../content/sanity";
import {
  buildLineArticleFlexMessage,
  selectLineDiscoveryArticles,
} from "../../line/content-cards";
import type { LineJourneyId } from "../../line/ecosystem";
import { readLineDiscoveryCuration } from "./discovery-config";

export async function readPublishedLineDiscoveryArticles(journey: LineJourneyId) {
  const [articles, curation] = await Promise.all([
    sanityContentProvider.listArticles({ includeDrafts: false }),
    readLineDiscoveryCuration(),
  ]);
  return selectLineDiscoveryArticles(journey, articles, curation.journeys[journey]);
}

export async function buildPublishedLineArticleFlexMessage(journey: LineJourneyId) {
  const [articles, curation] = await Promise.all([
    sanityContentProvider.listArticles({ includeDrafts: false }),
    readLineDiscoveryCuration(),
  ]);
  return buildLineArticleFlexMessage(journey, articles, curation.journeys[journey]);
}
