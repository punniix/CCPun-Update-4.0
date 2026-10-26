import "server-only";
import { approvedPublicArticleUrl } from "../post-publish-network";

type Env = Record<string, string | undefined>;
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow";
import { indexNowEnabled } from "../indexnow-policy";
export { indexNowEnabled, indexNowBudget } from "../indexnow-policy";
export async function submitIndexNow(url: string, env: Env = process.env, fetcher: typeof fetch = fetch) {
  if (!indexNowEnabled(env) || !approvedPublicArticleUrl(url)) return { state: "skipped" as const };
  let response: Response;
  try {
    response = await fetcher(INDEXNOW_ENDPOINT, {
      method: "POST", headers: { "Content-Type": "application/json" }, redirect: "error", cache: "no-store",
      body: JSON.stringify({ host: "ccpun.com", key: env.CCPUN_INDEXNOW_KEY,
        keyLocation: `https://ccpun.com/${env.CCPUN_INDEXNOW_KEY}.txt`, urlList: [url] }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch { return { state: "uncertain" as const }; }
  if (response.status === 200 || response.status === 202) return { state: "sent" as const, httpStatus: response.status };
  if (response.status === 429) return { state: "retry" as const, httpStatus: response.status };
  if (response.status >= 500) return { state: "uncertain" as const, httpStatus: response.status };
  return { state: "configuration-required" as const, httpStatus: response.status };
}
