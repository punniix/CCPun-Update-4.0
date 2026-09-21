const WEB_VERCEL_PROJECT_ID = "prj_dxwjITkd0av5QiJQv2snUlIASUWu";
const ADMIN_PUBLIC_EVENT_URL = "https://admin.ccpun.com/api/internal/line/public-event/";

function productionBridge(variables: Record<string, string | undefined>) {
  const token = variables.VERCEL_OIDC_TOKEN?.trim();
  if (
    variables.CCPUN_APP_ENV?.trim() !== "production"
    || variables.VERCEL_ENV?.trim() !== "production"
    || variables.VERCEL_PROJECT_ID?.trim() !== WEB_VERCEL_PROJECT_ID
    || variables.VERCEL_GIT_COMMIT_REF?.trim() !== "v4-production"
    || !token
    || token.length < 100
  ) return null;
  return { endpoint: ADMIN_PUBLIC_EVENT_URL, token };
}

export async function recordLinePublicEventBestEffort(
  event: unknown,
  variables: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const bridge = productionBridge(variables);
  if (!bridge) return false;
  try {
    const response = await fetchImpl(bridge.endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bridge.token}`,
      },
      body: JSON.stringify(event),
    });
    if (!response.ok) return false;
    const payload = await response.json() as { status?: unknown };
    return payload?.status === "recorded";
  } catch {
    return false;
  }
}
