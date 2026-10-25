import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { ResultEmailTool } from "../../../../lib/email/result-summary";

/** One outbound message for one already-validated recipient. */
export type OutboundEmail = {
  kind: "result" | "result_with_confirmation";
  to: string;
  tool: ResultEmailTool;
  subject: string;
  html: string;
  text: string;
  /** Label/value rows of the visitor's own result (already formatted, server-owned labels). */
  summary: Array<{ label: string; value: string }>;
  links: { tool: string; confirm?: string; unsubscribe?: string };
};

export type SendOutcome = { ok: true } | { ok: false; reason: "rate_limited" | "rejected" | "unavailable" };

/**
 * Delivery adapter. Owner direction (2026-10-25): the web app never holds an email-provider key;
 * actual sending runs on n8n on the owner's VPS. A different worker is one more implementation.
 */
export interface EmailProvider {
  readonly id: "noop" | "n8n";
  send(message: OutboundEmail): Promise<SendOutcome>;
}

/**
 * Development/UAT adapter used until the n8n webhook is configured. It sends nothing and logs only
 * the message kind and size: never the address, subject, figures or body.
 */
export function createNoopEmailProvider(log: (line: string) => void = (line) => console.info(line)): EmailProvider {
  return {
    id: "noop",
    async send(message) {
      log(`[result-email] noop provider: ${message.kind} not sent (${message.html.length + message.text.length} bytes)`);
      return { ok: true };
    },
  };
}

export const N8N_SIGNATURE_HEADER = "x-ccpun-signature";
export const N8N_TIMESTAMP_HEADER = "x-ccpun-timestamp";
export const N8N_REPLAY_WINDOW_SECONDS = 300;

/** `v1=<hex HMAC-SHA256(secret, "<unix seconds>.<raw body>")>`: the exact bytes n8n must verify. */
export function signN8nPayload(secret: string, timestamp: number, body: string): string {
  return `v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

/**
 * Reference verifier for the n8n side (scratchpad/n8n-email-worker-spec.md mirrors it): constant-time
 * signature check plus a replay window around the receiver's clock.
 */
export function verifyN8nSignature(secret: string, timestampHeader: string | null, signatureHeader: string | null, body: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!timestampHeader || !signatureHeader || !/^\d{10}$/.test(timestampHeader)) return false;
  const timestamp = Number(timestampHeader);
  if (Math.abs(nowSeconds - timestamp) > N8N_REPLAY_WINDOW_SECONDS) return false;
  const expected = Buffer.from(signN8nPayload(secret, timestamp, body));
  const actual = Buffer.from(signatureHeader);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Webhook URL rules: https with no credentials, query or fragment (loopback http only in development). */
export function parseN8nWebhookUrl(value: string | undefined, allowLoopbackHttp = false): URL | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const loopback = ["127.0.0.1", "localhost"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol === "https:" || (allowLoopbackHttp && loopback && url.protocol === "http:")) return url;
    return null;
  } catch {
    return null;
  }
}

/**
 * Default delivery adapter: a signed webhook to the owner's n8n worker, which holds the provider
 * credential. Exists only when CCPUN_EMAIL_N8N_WEBHOOK_URL and CCPUN_EMAIL_N8N_WEBHOOK_SECRET
 * (at least 32 characters) are both set. The payload carries only what the email needs.
 */
export function createN8nEmailProvider(
  variables: Record<string, string | undefined> = process.env,
  { fetchImpl = fetch, now = () => Date.now(), allowLoopbackHttp = false }: { fetchImpl?: typeof fetch; now?: () => number; allowLoopbackHttp?: boolean } = {},
): EmailProvider | null {
  const url = parseN8nWebhookUrl(variables.CCPUN_EMAIL_N8N_WEBHOOK_URL, allowLoopbackHttp);
  const secret = variables.CCPUN_EMAIL_N8N_WEBHOOK_SECRET?.trim();
  if (!url || !secret || secret.length < 32) return null;
  return {
    id: "n8n",
    async send(message) {
      const timestamp = Math.floor(now() / 1000);
      const body = JSON.stringify({
        version: 1,
        id: randomUUID(), // idempotency key for the worker
        kind: message.kind,
        tool: message.tool,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        summary: message.summary,
        links: message.links,
      });
      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", [N8N_TIMESTAMP_HEADER]: String(timestamp), [N8N_SIGNATURE_HEADER]: signN8nPayload(secret, timestamp, body) },
          body,
          signal: AbortSignal.timeout(8000),
          cache: "no-store",
          redirect: "error",
        });
        if (response.ok) return { ok: true };
        if (response.status === 429) return { ok: false, reason: "rate_limited" };
        return { ok: false, reason: response.status >= 500 ? "unavailable" : "rejected" };
      } catch {
        return { ok: false, reason: "unavailable" };
      }
    },
  };
}
