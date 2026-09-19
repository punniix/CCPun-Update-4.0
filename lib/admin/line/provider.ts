if (typeof window !== "undefined") throw new Error("CCPUN_LINE_PROVIDER_SERVER_ONLY");

import { createHash } from "node:crypto";

import {
  createLineContentCrypto,
  isLinePrivateKeyUnavailableError,
  isLinePrivateKeyVersion,
  type LineEncryptedValue,
} from "../../line/private-crypto";
import { parseLineSystemMessageIntent } from "../../line/system-delivery";
import { buildPublishedLineArticleFlexMessage } from "./content-cards";
import {
  checkpointLineOutbound,
  claimLineOutbound,
  claimLineSystemOutbound,
  getLineActivationStatus,
  lineWorkerDigest,
} from "./control-plane";
import { classifyLineProviderFailure } from "./provider-classification";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

export type LineProviderSendResult =
  | { ok: true; status: "sent" }
  | {
      ok: false;
      status:
        | "not_configured"
        | "not_claimable"
        | "key_unavailable"
        | "unsupported_key_version"
        | "failed"
        | "reconciliation_required";
      retryClass?: "retryable" | "permanent";
    };

function encryptedValue(row: {
  ciphertextB64: string;
  nonceB64: string;
  authTagB64: string;
  keyVersion: number;
}): LineEncryptedValue {
  if (!isLinePrivateKeyVersion(row.keyVersion)) {
    throw new Error("LINE_PRIVATE_KEY_VERSION_UNSUPPORTED");
  }
  return {
    keyVersion: row.keyVersion,
    ciphertextB64: row.ciphertextB64,
    nonceB64: row.nonceB64,
    authTagB64: row.authTagB64,
  };
}

export async function sendLineOutboundById(
  outboundId: string,
  variables: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<LineProviderSendResult> {
  const activation = getLineActivationStatus(variables);
  const token = variables.CCPUN_LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!activation.outboundEnabled || !token) return { ok: false, status: "not_configured" };

  const workerDigest = lineWorkerDigest(outboundId, variables);
  const claim = await claimLineOutbound(outboundId, workerDigest, variables);
  if (!claim) return { ok: false, status: "not_claimable" };

  const crypto = createLineContentCrypto(variables);
  let recipient: string;
  let text: string;
  try {
    recipient = crypto.decrypt(encryptedValue({
      ciphertextB64: claim.recipient_ciphertext_b64,
      nonceB64: claim.recipient_nonce_b64,
      authTagB64: claim.recipient_auth_tag_b64,
      keyVersion: claim.recipient_key_version,
    }), "line-user-id");
    text = crypto.decrypt(encryptedValue({
      ciphertextB64: claim.content_ciphertext_b64,
      nonceB64: claim.content_nonce_b64,
      authTagB64: claim.content_auth_tag_b64,
      keyVersion: claim.content_key_version,
    }), "admin-outbound-message-content");
  } catch (error) {
    const keyUnavailable = isLinePrivateKeyUnavailableError(error);
    const unsupported = error instanceof Error && error.message === "LINE_PRIVATE_KEY_VERSION_UNSUPPORTED";
    const errorClass = keyUnavailable
      ? "key_unavailable"
      : unsupported
        ? "unsupported_key_version"
        : "decrypt_failed";
    try {
      await checkpointLineOutbound({
        outboundId,
        workerDigest,
        result: "failed",
        errorClass,
      }, variables);
    } catch {
      return { ok: false, status: "reconciliation_required" };
    }
    if (keyUnavailable) return { ok: false, status: "key_unavailable" };
    if (unsupported) return { ok: false, status: "unsupported_key_version" };
    return { ok: false, status: "failed", retryClass: "permanent" };
  }

  try {
    const response = await fetchImpl(LINE_PUSH_URL, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(7_000),
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Line-Retry-Key": outboundId,
      },
      body: JSON.stringify({ to: recipient, messages: [{ type: "text", text }] }),
    });

    if (response.ok) {
      await checkpointLineOutbound({ outboundId, workerDigest, result: "sent", providerStatusCode: response.status }, variables);
      return { ok: true, status: "sent" };
    }

    const classification = classifyLineProviderFailure(response.status);
    await checkpointLineOutbound({
      outboundId,
      workerDigest,
      result: "failed",
      providerStatusCode: response.status,
      errorClass: classification.errorClass,
    }, variables);
    return { ok: false, status: "failed", retryClass: classification.retryClass };
  } catch {
    try {
      await checkpointLineOutbound({ outboundId, workerDigest, result: "reconciliation_required", errorClass: "provider_result_ambiguous" }, variables);
    } catch {
      // The caller receives reconciliation_required and must not retry automatically.
    }
    return { ok: false, status: "reconciliation_required" };
  }
}


export function getLineSystemDeliveryProviderReadiness(
  variables: Record<string, string | undefined> = process.env,
) {
  let cryptoReady = false;
  try {
    createLineContentCrypto(variables);
    cryptoReady = true;
  } catch {
    cryptoReady = false;
  }
  return {
    enabled: variables.CCPUN_LINE_SYSTEM_DELIVERY_ENABLED?.trim() === "true",
    tokenPresent: Boolean(variables.CCPUN_LINE_CHANNEL_ACCESS_TOKEN?.trim()),
    cryptoReady,
  };
}

export async function sendLineSystemOutboundByCapability(
  outboundId: string,
  dispatchToken: string,
  variables: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<LineProviderSendResult> {
  const readiness = getLineSystemDeliveryProviderReadiness(variables);
  const token = variables.CCPUN_LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!readiness.enabled || !readiness.tokenPresent || !readiness.cryptoReady || !token) {
    return { ok: false, status: "not_configured" };
  }
  if (
    !/^[0-9a-f-]{36}$/i.test(outboundId)
    || !/^[0-9a-f]{64}$/.test(dispatchToken)
  ) return { ok: false, status: "not_claimable" };

  const workerDigest = lineWorkerDigest(outboundId, variables);
  const dispatchTokenDigest = createHash("sha256").update(dispatchToken).digest("hex");
  const claim = await claimLineSystemOutbound(
    outboundId,
    workerDigest,
    dispatchTokenDigest,
    variables,
  );
  if (!claim) return { ok: false, status: "not_claimable" };

  const crypto = createLineContentCrypto(variables);
  let recipient: string;
  let intentText: string;
  try {
    recipient = crypto.decrypt(encryptedValue({
      ciphertextB64: claim.recipient_ciphertext_b64,
      nonceB64: claim.recipient_nonce_b64,
      authTagB64: claim.recipient_auth_tag_b64,
      keyVersion: claim.recipient_key_version,
    }), "line-user-id");
    intentText = crypto.decrypt(encryptedValue({
      ciphertextB64: claim.content_ciphertext_b64,
      nonceB64: claim.content_nonce_b64,
      authTagB64: claim.content_auth_tag_b64,
      keyVersion: claim.content_key_version,
    }), "line-system-message-content");
  } catch (error) {
    const keyUnavailable = isLinePrivateKeyUnavailableError(error);
    const unsupported = error instanceof Error && error.message === "LINE_PRIVATE_KEY_VERSION_UNSUPPORTED";
    const errorClass = keyUnavailable
      ? "key_unavailable"
      : unsupported
        ? "unsupported_key_version"
        : "decrypt_failed";
    try {
      await checkpointLineOutbound({
        outboundId,
        workerDigest,
        result: "failed",
        errorClass,
      }, variables);
    } catch {
      return { ok: false, status: "reconciliation_required" };
    }
    if (keyUnavailable) return { ok: false, status: "key_unavailable" };
    if (unsupported) return { ok: false, status: "unsupported_key_version" };
    return { ok: false, status: "failed", retryClass: "permanent" };
  }

  const intent = parseLineSystemMessageIntent(intentText);
  if (!intent) {
    try {
      await checkpointLineOutbound({
        outboundId,
        workerDigest,
        result: "failed",
        errorClass: "payload_invalid",
      }, variables);
    } catch {
      return { ok: false, status: "reconciliation_required" };
    }
    return { ok: false, status: "failed", retryClass: "permanent" };
  }

  let message;
  try {
    message = await buildPublishedLineArticleFlexMessage(intent.journey);
  } catch {
    message = null;
  }
  if (!message) {
    try {
      await checkpointLineOutbound({
        outboundId,
        workerDigest,
        result: "failed",
        errorClass: "content_unavailable",
      }, variables);
    } catch {
      return { ok: false, status: "reconciliation_required" };
    }
    return { ok: false, status: "failed", retryClass: "retryable" };
  }

  try {
    const response = await fetchImpl(LINE_PUSH_URL, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(7_000),
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Line-Retry-Key": outboundId,
      },
      body: JSON.stringify({ to: recipient, messages: [message] }),
    });

    if (response.ok) {
      await checkpointLineOutbound({
        outboundId,
        workerDigest,
        result: "sent",
        providerStatusCode: response.status,
      }, variables);
      return { ok: true, status: "sent" };
    }

    const classification = classifyLineProviderFailure(response.status);
    await checkpointLineOutbound({
      outboundId,
      workerDigest,
      result: "failed",
      providerStatusCode: response.status,
      errorClass: classification.errorClass,
    }, variables);
    return { ok: false, status: "failed", retryClass: classification.retryClass };
  } catch {
    try {
      await checkpointLineOutbound({
        outboundId,
        workerDigest,
        result: "reconciliation_required",
        errorClass: "provider_result_ambiguous",
      }, variables);
    } catch {
      // Never retry an ambiguous provider result without reconciliation.
    }
    return { ok: false, status: "reconciliation_required" };
  }
}
