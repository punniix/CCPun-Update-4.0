import { z } from "zod";

if (typeof window !== "undefined") throw new Error("GOOGLE_DATA_AUTH_SERVER_ONLY");

const credentialsSchema = z.object({
  CCPUN_GOOGLE_DATA_CLIENT_ID: z.string().trim().min(1),
  CCPUN_GOOGLE_DATA_CLIENT_SECRET: z.string().trim().min(1),
  CCPUN_GOOGLE_DATA_REFRESH_TOKEN: z.string().trim().min(1),
});

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
});

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function getGoogleDataAccessToken(
  env: Record<string, string | undefined> = process.env,
  fetcher: FetchLike = fetch,
) {
  const credentials = credentialsSchema.safeParse(env);
  if (!credentials.success) throw new Error("GOOGLE_DATA_NOT_CONFIGURED");

  let response: Response;
  try {
    response = await fetcher("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: credentials.data.CCPUN_GOOGLE_DATA_CLIENT_ID,
        client_secret: credentials.data.CCPUN_GOOGLE_DATA_CLIENT_SECRET,
        refresh_token: credentials.data.CCPUN_GOOGLE_DATA_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) {
      throw new Error("GOOGLE_DATA_TIMEOUT");
    }
    throw new Error("GOOGLE_DATA_UNAVAILABLE");
  }

  if (response.status === 400 || response.status === 401) throw new Error("GOOGLE_DATA_AUTH_REQUIRED");
  if (response.status === 429) throw new Error("GOOGLE_DATA_RATE_LIMITED");
  if (!response.ok) throw new Error("GOOGLE_DATA_UNAVAILABLE");

  const parsed = tokenResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new Error("GOOGLE_DATA_INVALID_RESPONSE");
  return parsed.data.access_token;
}

/** Owner-session alternative; the existing environment-based reader above is unchanged. */
export async function refreshGoogleSessionAccessToken(
  credentials: { clientId: string; clientSecret: string; refreshToken: string },
  fetcher: FetchLike = fetch,
) {
  let response: Response;
  try {
    response = await fetcher("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken, grant_type: "refresh_token" }),
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new Error("GOOGLE_SESSION_CONNECT_REQUIRED"); }
  if (!response.ok) throw new Error("GOOGLE_SESSION_CONNECT_REQUIRED");
  const result = z.object({ access_token: z.string().min(1).max(8_192), refresh_token: z.string().min(1).max(2_048).optional() })
    .safeParse(await response.json().catch(() => null));
  if (!result.success) throw new Error("GOOGLE_SESSION_CONNECT_REQUIRED");
  return { accessToken: result.data.access_token, refreshToken: result.data.refresh_token };
}
