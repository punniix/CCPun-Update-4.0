const WEB_VERCEL_PROJECT_ID = "prj_dxwjITkd0av5QiJQv2snUlIASUWu";
const PROD_ADMIN_PUBLIC_EVENT = "https://admin.ccpun.com/api/internal/line/public-event/";

function inferredEnvironment(variables: Record<string, string | undefined>) {
  const explicit = variables.CCPUN_APP_ENV?.trim();
  if (explicit) return explicit;
  if (variables.VERCEL_PROJECT_ID?.trim() !== WEB_VERCEL_PROJECT_ID) return "unknown";
  if (variables.VERCEL_ENV?.trim() === "production") return "production";
  if (variables.VERCEL_ENV?.trim() === "preview") return "web-uat";
  return "unknown";
}

export function resolveLinePublicEventUrl(
  variables: Record<string, string | undefined> = process.env,
): string | null {
  const environment = inferredEnvironment(variables);
  const configured = variables.CCPUN_LINE_PUBLIC_EVENT_ADMIN_URL?.trim();
  const raw = configured || (environment === "production" ? PROD_ADMIN_PUBLIC_EVENT : "");
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.search
      || url.hash
      || url.pathname !== "/api/internal/line/public-event/"
    ) return null;
    if (environment === "production" && url.hostname !== "admin.ccpun.com") return null;
    if (
      environment === "web-uat"
      && !/^ccpun-admin(?:-.+)?\.vercel\.app$/.test(url.hostname)
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function recordLinePublicEventBestEffort(
  event: unknown,
  variables: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const endpoint = resolveLinePublicEventUrl(variables);
  if (!endpoint) return false;
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!response.ok) return false;
    const payload = await response.json() as { status?: unknown };
    return payload?.status === "recorded";
  } catch {
    return false;
  }
}
