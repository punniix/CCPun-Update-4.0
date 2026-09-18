if (typeof window !== "undefined") throw new Error("CCPUN_MEDIA_PROVIDER_SERVER_ONLY");

const LINE_CONTENT_BASE = "https://api-data.line.me/v2/bot/message";
const MAX_PROVIDER_MESSAGE_ID_LENGTH = 200;

export type LineMediaFetchResult =
  | {
      ok: true;
      status: "ready";
      body: ReadableStream<Uint8Array> | null;
      contentType: string;
      contentLength: number | null;
    }
  | {
      ok: false;
      status:
        | "not_configured"
        | "processing"
        | "gone"
        | "rate_limited"
        | "provider_unavailable"
        | "provider_rejected"
        | "reconciliation_required";
      providerStatusCode?: number;
    };

export function getLineMediaProviderReadiness(
  variables: Record<string, string | undefined> = process.env,
) {
  return {
    tokenPresent: Boolean(variables.CCPUN_LINE_CHANNEL_ACCESS_TOKEN?.trim()),
    fetchEnabled: variables.CCPUN_LINE_MEDIA_FETCH_ENABLED?.trim() === "true",
  };
}

function validProviderMessageId(value: string) {
  return value.length > 0 &&
    value.length <= MAX_PROVIDER_MESSAGE_ID_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(value);
}

export async function fetchLineMediaContent(
  providerMessageId: string,
  variables: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<LineMediaFetchResult> {
  const readiness = getLineMediaProviderReadiness(variables);
  const token = variables.CCPUN_LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!readiness.tokenPresent || !readiness.fetchEnabled || !token || !validProviderMessageId(providerMessageId)) {
    return { ok: false, status: "not_configured" };
  }

  try {
    const response = await fetchImpl(
      `${LINE_CONTENT_BASE}/${encodeURIComponent(providerMessageId)}/content`,
      {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (response.status === 200) {
      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
      const rawLength = response.headers.get("content-length");
      const parsedLength = rawLength && /^\d+$/.test(rawLength) ? Number(rawLength) : null;
      return {
        ok: true,
        status: "ready",
        body: response.body,
        contentType,
        contentLength: parsedLength !== null && Number.isSafeInteger(parsedLength) ? parsedLength : null,
      };
    }
    if (response.status === 202) return { ok: false, status: "processing", providerStatusCode: 202 };
    if (response.status === 404 || response.status === 410) return { ok: false, status: "gone", providerStatusCode: response.status };
    if (response.status === 429) return { ok: false, status: "rate_limited", providerStatusCode: 429 };
    if (response.status >= 500) return { ok: false, status: "provider_unavailable", providerStatusCode: response.status };
    return { ok: false, status: "provider_rejected", providerStatusCode: response.status };
  } catch {
    return { ok: false, status: "reconciliation_required" };
  }
}
