import "server-only";

import {
  createLineContentCrypto,
  isLinePrivateKeyUnavailableError,
  isLinePrivateKeyVersion,
  type LineEncryptedValue,
} from "../../line/private-crypto";
import {
  checkpointLineOutbound,
  claimLineOutbound,
  getLineActivationStatus,
  lineWorkerDigest,
} from "./control-plane";

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
    return { ok: false, status: "failed" };
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

    const errorClass = response.status === 429
      ? "rate_limited"
      : response.status >= 500
        ? "provider_unavailable"
        : "provider_rejected";
    await checkpointLineOutbound({ outboundId, workerDigest, result: "failed", providerStatusCode: response.status, errorClass }, variables);
    return { ok: false, status: "failed" };
  } catch {
    try {
      await checkpointLineOutbound({ outboundId, workerDigest, result: "reconciliation_required", errorClass: "provider_result_ambiguous" }, variables);
    } catch {
      // The caller receives reconciliation_required and must not retry automatically.
    }
    return { ok: false, status: "reconciliation_required" };
  }
}
