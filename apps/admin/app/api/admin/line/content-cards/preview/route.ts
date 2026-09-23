import { NextResponse } from "next/server";

import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import {
  buildPublishedLineArticleFlexMessage,
  readPublishedLineDiscoveryArticles,
} from "@/lib/admin/line/content-cards";
import type { LineJourneyId } from "@/lib/line/ecosystem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

const ALLOWED_JOURNEYS = new Set<LineJourneyId>([
  "life_health_policy_review",
  "motor_quote_review",
  "investment_before_you_act",
]);

export async function GET(request: Request) {
  const identity = await getAdminIdentity();
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  if (!hasAdminPermission(identity.role, "settings:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  }

  const rawJourney = new URL(request.url).searchParams.get("journey") ?? "";
  if (!ALLOWED_JOURNEYS.has(rawJourney as LineJourneyId)) {
    return NextResponse.json({ error: "invalid-journey" }, { status: 400, headers });
  }

  try {
    const journey = rawJourney as LineJourneyId;
    const [articles, message] = await Promise.all([
      readPublishedLineDiscoveryArticles(journey),
      buildPublishedLineArticleFlexMessage(journey),
    ]);

    return NextResponse.json({
      journey,
      articleCount: articles.length,
      articles: articles.map((article) => ({
        slug: article.slug,
        title: article.title,
        category: article.category,
        hasFeaturedImage: Boolean(article.featuredImage?.src),
      })),
      message,
    }, { headers });
  } catch {
    return NextResponse.json({ error: "content-card-preview-unavailable" }, { status: 503, headers });
  }
}
