import "server-only";

import { resolveDeploymentIdentity } from "../../../../lib/runtime/deployment-identity";
import { isResultEmailEnabled } from "../../../../lib/runtime/result-email-availability";
import { createN8nEmailProvider, createNoopEmailProvider, type EmailProvider } from "./provider";

// Same pinned Neon endpoints as the article runtime (personal data lives in Neon, not Supabase),
// but a separate schema (ccpun_email) and a dedicated role with EXECUTE-only access.
const LANES = {
  production: { endpoint: "ep-broad-butterfly-b3ro7u8w", suffix: "c-4.ap-southeast-1.aws.neon.tech", origin: "https://ccpun.com" },
  "web-uat": { endpoint: "ep-mute-frost-aztvz394", suffix: "c-3.ap-southeast-1.aws.neon.tech", origin: "https://test.ccpun.com" },
} as const;
const LOCAL_ORIGINS = new Set(["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3100", "http://127.0.0.1:3100"]);

export type ResultEmailRuntime = {
  environment: "production" | "web-uat" | "development";
  /** Pinned public origin: the only accepted Origin/Host and the base for every link in an email. */
  origin: string;
  provider: EmailProvider | null;
  /** Null when the database credential is missing or does not match the lane: digest requests then fail closed. */
  databaseUrl: string | null;
  /** Null when missing or shorter than 32 characters: digest requests then fail closed. */
  tokenSecret: string | null;
};

function databaseUrlFor(lane: (typeof LANES)[keyof typeof LANES], value: string | undefined): string | null {
  const connectionString = value?.trim();
  if (!connectionString) return null;
  try {
    const url = new URL(connectionString);
    if (url.protocol !== "postgresql:" || url.port || url.hash
      || ![`${lane.endpoint}.${lane.suffix}`, `${lane.endpoint}-pooler.${lane.suffix}`].includes(url.hostname)
      || decodeURIComponent(url.username) !== "ccpun_email_runtime" || !url.password
      || decodeURIComponent(url.pathname.slice(1)) !== "neondb"
      || url.searchParams.get("sslmode") !== "require"
      || [...url.searchParams.keys()].some((key) => !["sslmode", "channel_binding"].includes(key))) return null;
    return connectionString;
  } catch {
    return null;
  }
}

/**
 * The result-email runtime for this process, or null when the feature flag is off or the lane is
 * not a known Web lane. Production never falls back to the no-op adapter: without the n8n webhook
 * it reports unavailable instead of pretending an email was sent.
 */
export function resolveResultEmailRuntime(variables: Record<string, string | undefined> = process.env): ResultEmailRuntime | null {
  if (!isResultEmailEnabled(variables)) return null;
  const deployment = resolveDeploymentIdentity(variables, "web");
  if (!deployment.valid || deployment.role !== "web") return null;
  const secret = variables.CCPUN_EMAIL_TOKEN_SECRET?.trim();
  const tokenSecret = secret && secret.length >= 32 ? secret : null;

  if (deployment.provider === "local" && deployment.environment === "development") {
    const origin = variables.CCPUN_EMAIL_DEV_ORIGIN?.trim() || "http://127.0.0.1:3100";
    if (!LOCAL_ORIGINS.has(origin)) return null;
    const n8n = createN8nEmailProvider(variables, { allowLoopbackHttp: true });
    return { environment: "development", origin, provider: n8n ?? createNoopEmailProvider(), databaseUrl: null, tokenSecret };
  }
  const environment = deployment.environment;
  if (deployment.provider !== "hostinger" || (environment !== "production" && environment !== "web-uat")) return null;
  if (variables.NEXT_PUBLIC_CCPUN_APP_ENV?.trim() !== environment
    || variables.CCPUN_UAT_MODE?.trim() !== (environment === "production" ? "0" : "1")) return null;
  const lane = LANES[environment];
  return {
    environment,
    origin: lane.origin,
    // Owner direction (2026-10-25): sending runs on n8n; the provider key never reaches this app.
    provider: createN8nEmailProvider(variables) ?? (environment === "production" ? null : createNoopEmailProvider()),
    databaseUrl: databaseUrlFor(lane, variables.CCPUN_EMAIL_DATABASE_URL),
    tokenSecret,
  };
}
