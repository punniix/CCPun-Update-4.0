import { getAdminEnvironment } from "@/lib/admin/environment";
import { getPublishedSeoObservationArticle } from "@/lib/admin/sanity-control";
import { enqueuePublishedSeoWebhook } from "@/lib/admin/seo-intelligence/post-publish-queue";
import { handleSanityArticlePublished } from "@/lib/admin/seo-intelligence/post-publish-webhook";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleSanityArticlePublished(request, {
    environment: getAdminEnvironment(), secret: process.env.CCPUN_SANITY_WEBHOOK_SECRET, runtimeEnv: process.env,
    readArticle: id => getPublishedSeoObservationArticle(id, { throwOnError: true }),
    enqueue: enqueuePublishedSeoWebhook,
  });
}
