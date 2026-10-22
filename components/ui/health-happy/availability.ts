import "server-only";
import { getContentProvider } from "@/lib/content/provider";
import { resolveContentEnvironment } from "@/lib/content/sanity-lane";
import { getArticlePath } from "@/lib/content/url";

export async function isHealthHappyCampaignAvailable(): Promise<boolean> {
  if (!["web-uat", "local-uat"].includes(resolveContentEnvironment())) return true;
  try {
    const article = await getContentProvider().getArticleBySlug("aia-health-happy-describe", { includeDrafts: false });
    return article?.status === "published" && getArticlePath(article) === "/blog/health-insurance/aia-health-happy-describe/";
  } catch {
    return false;
  }
}
