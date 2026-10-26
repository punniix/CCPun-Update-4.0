import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";

// Provider-agnostic owner notifier. No email provider (Resend, SendGrid, SMTP,
// nodemailer or an n8n mail relay endpoint) existed in the repository on
// 2026-10-25, so email ships DISABLED by default. The only built-in adapter is a
// signed HTTPS webhook relay (for example an n8n Webhook -> Gmail/SMTP node the
// owner creates). Another provider can be added as one more adapter without
// touching callers.
//
// Owner configuration (Admin server env, never client-visible):
//   CCPUN_ALERT_EMAIL_PROVIDER=webhook          (anything else = disabled)
//   CCPUN_ALERT_EMAIL_WEBHOOK_URL=https://...   (HTTPS only)
//   CCPUN_ALERT_EMAIL_WEBHOOK_SECRET=<random>   (HMAC-SHA256 signing secret, >= 32 chars)
//   CCPUN_ALERT_EMAIL_TO=owner@example.com      (one recipient)

export type OwnerNotification = {
  kind: "daily-job-failed" | "daily-job-stuck" | "daily-job-missing";
  subject: string;
  text: string;
  // Idempotency key (no personal data). The relay must de-duplicate on it and
  // answer 2xx for a reference it has already accepted, so a retry after an
  // accepted-but-unanswered request never produces a second email.
  reference: string;
};

// "accepted" means the relay answered 2xx. It is NOT proof that an email
// reached the inbox. "relay-rejected" = the relay answered non-2xx;
// "relay-unconfirmed" = timeout/network error, the relay may or may not have
// accepted it (the caller retries later with the same reference).
export type NotifyResult = { accepted: true; channel: "email-webhook" } | { accepted: false; reason: "disabled" | "invalid-config" | "relay-rejected" | "relay-unconfirmed" };

export interface NotificationAdapter {
  readonly channel: "email-webhook" | "disabled";
  send(message: OwnerNotification): Promise<NotifyResult>;
}

type Variables = Record<string, string | undefined>;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const ALERT_EMAIL_ENV = {
  provider: "CCPUN_ALERT_EMAIL_PROVIDER",
  url: "CCPUN_ALERT_EMAIL_WEBHOOK_URL",
  secret: "CCPUN_ALERT_EMAIL_WEBHOOK_SECRET",
  to: "CCPUN_ALERT_EMAIL_TO",
} as const;

export const disabledNotificationAdapter: NotificationAdapter = Object.freeze({
  channel: "disabled" as const,
  async send() { return { accepted: false as const, reason: "disabled" as const }; },
});

const emailSchema = z.email().max(254);

export function readAlertEmailConfig(variables: Variables = process.env): { url: string; secret: string; to: string } | "disabled" | "invalid-config" {
  if (variables[ALERT_EMAIL_ENV.provider]?.trim() !== "webhook") return "disabled";
  const url = variables[ALERT_EMAIL_ENV.url]?.trim() ?? "";
  const secret = variables[ALERT_EMAIL_ENV.secret]?.trim() ?? "";
  const to = variables[ALERT_EMAIL_ENV.to]?.trim() ?? "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return "invalid-config";
  } catch { return "invalid-config"; }
  if (secret.length < 32 || !emailSchema.safeParse(to).success) return "invalid-config";
  return { url, secret, to };
}

export function createWebhookEmailAdapter(config: { url: string; secret: string; to: string }, fetchImpl: FetchLike = (input, init) => fetch(input, init)): NotificationAdapter {
  return {
    channel: "email-webhook",
    async send(message) {
      const timestamp = new Date().toISOString();
      const body = JSON.stringify({ to: config.to, subject: message.subject, text: message.text, kind: message.kind, reference: message.reference, sentAt: timestamp });
      const signature = createHmac("sha256", config.secret).update(`${timestamp}.${body}`).digest("hex");
      try {
        const response = await fetchImpl(config.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": message.reference, "X-CCPun-Timestamp": timestamp, "X-CCPun-Signature": `sha256=${signature}` },
          body,
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(5_000),
        });
        return response.ok ? { accepted: true, channel: "email-webhook" } : { accepted: false, reason: "relay-rejected" };
      } catch {
        return { accepted: false, reason: "relay-unconfirmed" };
      }
    },
  };
}

export function getOwnerNotifier(variables: Variables = process.env, fetchImpl?: FetchLike): NotificationAdapter {
  const config = readAlertEmailConfig(variables);
  if (config === "disabled") return disabledNotificationAdapter;
  if (config === "invalid-config") return { channel: "disabled", async send() { return { accepted: false, reason: "invalid-config" }; } };
  return createWebhookEmailAdapter(config, fetchImpl);
}

export function alertEmailStatus(variables: Variables = process.env): "enabled" | "disabled" | "invalid-config" {
  const config = readAlertEmailConfig(variables);
  return typeof config === "string" ? config : "enabled";
}
