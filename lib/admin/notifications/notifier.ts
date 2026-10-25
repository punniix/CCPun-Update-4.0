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
  kind: "daily-job-failed";
  subject: string;
  text: string;
  // Correlation id for de-duplication on the relay side (no personal data).
  reference: string;
};

export type NotifyResult = { delivered: true; channel: "email-webhook" } | { delivered: false; reason: "disabled" | "invalid-config" | "send-failed" };

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
  async send() { return { delivered: false as const, reason: "disabled" as const }; },
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
          headers: { "Content-Type": "application/json", "X-CCPun-Timestamp": timestamp, "X-CCPun-Signature": `sha256=${signature}` },
          body,
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(5_000),
        });
        return response.ok ? { delivered: true, channel: "email-webhook" } : { delivered: false, reason: "send-failed" };
      } catch {
        return { delivered: false, reason: "send-failed" };
      }
    },
  };
}

export function getOwnerNotifier(variables: Variables = process.env, fetchImpl?: FetchLike): NotificationAdapter {
  const config = readAlertEmailConfig(variables);
  if (config === "disabled") return disabledNotificationAdapter;
  if (config === "invalid-config") return { channel: "disabled", async send() { return { delivered: false, reason: "invalid-config" }; } };
  return createWebhookEmailAdapter(config, fetchImpl);
}

export function alertEmailStatus(variables: Variables = process.env): "enabled" | "disabled" | "invalid-config" {
  const config = readAlertEmailConfig(variables);
  return typeof config === "string" ? config : "enabled";
}
