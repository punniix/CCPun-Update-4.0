import "server-only";
import { getContentProvider } from "@/lib/content/provider";
import { resolveContentEnvironment } from "@/lib/content/sanity-lane";
import { getArticlePath } from "@/lib/content/url";

const PYRAMID_PATH = "/blog/personal-finance/financial-pyramid/";

export async function getFhcPyramidHref(): Promise<string> {
  if (!["web-uat", "local-uat", "admin-uat"].includes(resolveContentEnvironment())) return PYRAMID_PATH;
  try {
    const article = await getContentProvider().getArticleBySlug("financial-pyramid", { includeDrafts: false });
    return article?.status === "published" && getArticlePath(article) === PYRAMID_PATH ? PYRAMID_PATH : "/blog/";
  } catch {
    return "/blog/";
  }
}
