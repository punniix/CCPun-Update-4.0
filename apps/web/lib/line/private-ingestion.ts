import { z } from "zod";

import type { LinePrivateIngestEvent } from "../../../../lib/line/private-domain";

const WEB_VERCEL_PROJECT_ID = "prj_dxwjITkd0av5QiJQv2snUlIASUWu";
const ADMIN_INGEST_EVENT_URL = "https://admin.ccpun.com/api/internal/line/ingest-event/";
const ADMIN_BRIDGE_HEALTH_URL = "https://admin.ccpun.com/api/internal/line/bridge-health/";

export type LineIngestOutcome =
  | "accepted"
  | "duplicate_event"
  | "duplicate_message"
  | "unsend_applied"
  | "unsend_pending";

export type LinePrivateIngestor = (event: LinePrivateIngestEvent) => Promise<LineIngestOutcome>;

const responseSchema = z.object({
  outcome: z.enum([
    "accepted",
    "duplicate_event",
    "duplicate_message",
    "unsend_applied",
    "unsend_pending",
  ]),
}).strict();

function productionWebBridge(
  variables: Record<string, string | undefined>,
) {
  const appEnvironment = variables.CCPUN_APP_ENV?.trim();
  const vercelEnvironment = variables.VERCEL_ENV?.trim();
  const projectId = variables.VERCEL_PROJECT_ID?.trim();
  const gitBranch = variables.VERCEL_GIT_COMMIT_REF?.trim();
  const oidcToken = variables.VERCEL_OIDC_TOKEN?.trim();

  if (
    appEnvironment !== "production"
    || vercelEnvironment !== "production"
    || projectId !== WEB_VERCEL_PROJECT_ID
    || gitBranch !== "v4-production"
    || !oidcToken
    || oidcToken.length < 100
  ) return null;

  return { endpoint: ADMIN_INGEST_EVENT_URL, oidcToken };
}

export function createLinePrivateIngestor(
  variables: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): LinePrivateIngestor {
  const bridge = productionWebBridge(variables);
  if (!bridge) throw new Error("LINE_PRIVATE_INGEST_UNAVAILABLE");

  return async (event) => {
    let response: Response;
    try {
      response = await fetchImpl(bridge.endpoint, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${bridge.oidcToken}`,
        },
        body: JSON.stringify(event),
      });
    } catch {
      throw new Error("LINE_PRIVATE_INGEST_UNAVAILABLE");
    }
    if (!response.ok) throw new Error("LINE_PRIVATE_INGEST_UNAVAILABLE");
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("LINE_PRIVATE_INGEST_INVALID_RESULT");
    return parsed.data.outcome;
  };
}

export async function probeLineAdminBridge(
  variables: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const bridge = productionWebBridge(variables);
  if (!bridge) return false;
  try {
    const response = await fetchImpl(ADMIN_BRIDGE_HEALTH_URL, {
      method: "HEAD",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
      headers: { authorization: `Bearer ${bridge.oidcToken}` },
    });
    return response.status === 204;
  } catch {
    return false;
  }
}
