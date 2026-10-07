export type GoogleSheetExportRuntime =
  | { ready: true; webhook: URL; token: string }
  | { ready: false; reason: "disabled" | "uat-disabled" | "uat-webhook-not-isolated" | "not-configured" };

function parseWebhook(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function resolveGoogleSheetExportRuntime(
  env: Record<string, string | undefined> = process.env,
): GoogleSheetExportRuntime {
  if (env.CCPUN_EXPORT_GOOGLE_SHEET_ENABLED?.trim() !== "true") {
    return { ready: false, reason: "disabled" };
  }

  const webhook = parseWebhook(env.CCPUN_N8N_EXPORT_WEBHOOK_URL);
  const token = env.CCPUN_N8N_EXPORT_WEBHOOK_TOKEN?.trim();
  const appEnv = env.CCPUN_APP_ENV?.trim();

  // Admin UAT must never reuse the Production Owner Export workflow. A future
  // UAT acceptance may opt in only after a dedicated webhook is provisioned.
  if (appEnv === "admin-uat") {
    if (env.CCPUN_EXPORT_GOOGLE_SHEET_UAT_ENABLED?.trim() !== "true") {
      return { ready: false, reason: "uat-disabled" };
    }
    if (!webhook || !/^\/webhook(?:-test)?\/ccpun-owner-export-sheet-uat\/?$/.test(webhook.pathname)) {
      return { ready: false, reason: "uat-webhook-not-isolated" };
    }
  } else if (appEnv !== "production-admin") {
    return { ready: false, reason: "disabled" };
  }

  if (!webhook || !token || token.length < 43) {
    return { ready: false, reason: "not-configured" };
  }
  return { ready: true, webhook, token };
}
