import { handleArticleEngagementBatch } from "../../../lib/article-engagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Card lists: GET /api/article-engagement/?ids=a,b,c (max 24). The single-article route is unchanged.
export async function GET(request: Request) {
  return handleArticleEngagementBatch(request);
}
