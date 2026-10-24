import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * n8n relay for read-only Google provider calls.
 *
 * Admin still builds every Google request and still validates/normalizes every
 * response through the existing collectors. n8n only executes the exact planned
 * requests with its own read-only OAuth credential and returns the JSON bodies.
 * The relay fetcher never touches the network: unknown requests are recorded as
 * "missing" and answered 503 so the collector degrades exactly as it would on a
 * provider outage.
 */
export const GOOGLE_RELAY_TOKEN = "n8n-google-relay";
export const GOOGLE_RELAY_MAX_RESPONSES = 40;
export const GOOGLE_RELAY_MAX_BYTES = 12 * 1024 * 1024;
export const GOOGLE_RELAY_LIMITATION = "Provider JSON responses were fetched by n8n with a read-only Google OAuth credential and validated by Admin before storage";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const RELAY_ORIGINS = new Set(["https://www.googleapis.com", "https://analyticsdata.googleapis.com"]);

export const googleRelayResponseSchema = z.object({
  key: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.number().int().min(100).max(599),
  body: z.unknown(),
}).strict();
export const googleRelayResponsesSchema = z.array(googleRelayResponseSchema).max(GOOGLE_RELAY_MAX_RESPONSES);
export type GoogleRelayResponse = z.infer<typeof googleRelayResponseSchema>;
export type GoogleRelayRequest = { key: string; method: "POST"; url: string; body: unknown };

export function googleRelayKey(url: string, body: string) {
  return createHash("sha256").update(`POST\n${url}\n${body}`).digest("hex");
}

export function createGoogleRelayFetcher(responses: readonly GoogleRelayResponse[]) {
  const known = new Map(responses.map((response) => [response.key, response]));
  const missing = new Map<string, GoogleRelayRequest>();
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    // The collectors' token exchange is answered locally: no Admin secret is sent anywhere.
    if (url === TOKEN_URL) return Response.json({ access_token: GOOGLE_RELAY_TOKEN, token_type: "Bearer", expires_in: 3600 });
    const method = (init?.method ?? "GET").toUpperCase();
    if (!RELAY_ORIGINS.has(new URL(url).origin) || method !== "POST" || typeof init?.body !== "string") throw new Error("GOOGLE_RELAY_UNSUPPORTED_REQUEST");
    const key = googleRelayKey(url, init.body);
    const hit = known.get(key);
    if (!hit) {
      if (!missing.has(key)) missing.set(key, { key, method: "POST", url, body: JSON.parse(init.body) as unknown });
      return new Response(null, { status: 503 });
    }
    return new Response(JSON.stringify(hit.body ?? null), { status: hit.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fetcher, missing: () => [...missing.values()] };
}
