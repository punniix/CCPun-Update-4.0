import "server-only";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
type Env = Record<string, string | undefined>;
import { isGscSitemapWriteApproved } from "./gsc-sitemap-write-policy";
export { isGscSitemapWriteApproved } from "./gsc-sitemap-write-policy";


export async function getGscSitemapWriteToken(
  env: Env = process.env, fetcher: FetchLike = fetch,
): Promise<string> {
  if (!isGscSitemapWriteApproved(env)) throw new Error("GSC_SITEMAP_WRITE_NOT_APPROVED");
  const response = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.CCPUN_GSC_SITEMAP_CLIENT_ID!,
      client_secret: env.CCPUN_GSC_SITEMAP_CLIENT_SECRET!,
      refresh_token: env.CCPUN_GSC_SITEMAP_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("GSC_SITEMAP_AUTH_REQUIRED");
  const body: unknown = await response.json().catch(() => null);
  if (!body || typeof body !== "object" || !("access_token" in body)
    || typeof body.access_token !== "string" || !body.access_token) {
    throw new Error("GSC_SITEMAP_AUTH_REQUIRED");
  }
  return body.access_token;
}
