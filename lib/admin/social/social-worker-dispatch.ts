import "server-only";

import { isEmailDigestSendEnabled } from "./email-digest-model";
import { disabledEmailDigestSender, type EmailDigestSender } from "./email-digest-service";
import { isUsableWorkerSecret, signWorkerRequest, WORKER_HMAC_SECRET_ENV, WORKER_WEBHOOK_URL_ENV } from "./worker-signature";

type Env = Record<string, string | undefined>;

/** Body of the signed "job ready" webhook. Job ID only: n8n pulls everything else. */
export function workerWebhookBody(jobId: string) {
  return JSON.stringify({ jobId });
}

export function resolveWorkerWebhookUrl(env: Env) {
  const raw = env[WORKER_WEBHOOK_URL_ENV]?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash ? url : null;
  } catch {
    return null;
  }
}

/**
 * The only adapter that implements `sendDigest` today: it signals the n8n worker
 * on the owner's VPS. Disabled unless the send flag, an https webhook URL and a
 * strong shared secret are all configured. It never calls an email provider.
 */
export function createEmailDigestSender(env: Env = process.env, fetcher: typeof fetch = fetch): EmailDigestSender {
  const url = resolveWorkerWebhookUrl(env);
  const secret = env[WORKER_HMAC_SECRET_ENV];
  if (!isEmailDigestSendEnabled(env) || !url || !isUsableWorkerSecret(secret)) return disabledEmailDigestSender;
  return {
    async sendDigest({ jobId }) {
      const body = workerWebhookBody(jobId);
      const response = await fetcher(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...signWorkerRequest({ secret, method: "POST", path: `${url.pathname}${url.search}`, body }) },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      return response.ok ? { accepted: true, errorCode: null } : { accepted: false, errorCode: `webhook-${response.status}` };
    },
  };
}
