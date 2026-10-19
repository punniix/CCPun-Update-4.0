import { handleArticleEngagement } from "../../../../lib/article-engagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ articleId: string }> };
export async function GET(request: Request, context: Context) {
  return handleArticleEngagement(request, (await context.params).articleId);
}
export async function POST(request: Request, context: Context) {
  return handleArticleEngagement(request, (await context.params).articleId);
}
