/** Server-only deployment policy: a narrowly matched virtual key file, never a root catch-all route. */
export function indexNowKeyResponse(request: Request, env: Record<string, string | undefined> = process.env): Response | null {
  const url = new URL(request.url);
  if (!/^\/[a-f0-9]{32}\.txt$/.test(url.pathname)) return null;
  const host = request.headers.get("host");
  const forwarded = request.headers.get("x-forwarded-host");
  const key = env.CCPUN_INDEXNOW_KEY;
  const allowed = env.CCPUN_INDEXNOW_ENABLED === "1" && env.CCPUN_APP_ENV === "production"
    && env.CCPUN_DEPLOYMENT_ROLE === "web" && env.CCPUN_DEPLOYMENT_PROVIDER === "hostinger"
    && url.origin === "https://ccpun.com" && host === "ccpun.com" && (forwarded === null || forwarded === host)
    && /^[a-f0-9]{32}$/.test(key ?? "") && url.pathname === `/${key}.txt`
    && !url.search && ["GET", "HEAD"].includes(request.method);
  return new Response(allowed && request.method === "GET" ? key : null, { status: allowed ? 200 : 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
