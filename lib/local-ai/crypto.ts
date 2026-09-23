import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import type { LocalAiTaskType } from "./contracts";

export const LOCAL_AI_KEY_VERSIONS = [1, 2] as const;
export type LocalAiKeyVersion = (typeof LOCAL_AI_KEY_VERSIONS)[number];

export type LocalAiEncryptedPayload = {
  keyVersion: LocalAiKeyVersion;
  ciphertextB64: string;
  nonceB64: string;
  authTagB64: string;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createLocalAiRequestFingerprint(taskType: LocalAiTaskType, payload: unknown) {
  return createHash("sha256").update(`${taskType}:${canonicalJson(payload)}`, "utf8").digest("hex");
}

function decodeKey(value: string | undefined): Buffer {
  const normalized = value?.trim();
  if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error("LOCAL_AI_CRYPTO_UNAVAILABLE");
  }
  const decoded = Buffer.from(normalized, "base64");
  if (decoded.length !== 32) throw new Error("LOCAL_AI_CRYPTO_UNAVAILABLE");
  return decoded;
}

function aad(jobId: string, taskType: LocalAiTaskType, version: LocalAiKeyVersion) {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) throw new Error("LOCAL_AI_JOB_ID_INVALID");
  return Buffer.from(`ccpun-local-ai:v${version}:${taskType}:${jobId}`, "utf8");
}

function parseKeyVersion(value: string | undefined): LocalAiKeyVersion {
  const normalized = value?.trim() || "1";
  if (normalized === "1") return 1;
  if (normalized === "2") return 2;
  throw new Error("LOCAL_AI_ACTIVE_KEY_VERSION_INVALID");
}

export function createLocalAiPayloadCrypto(
  variables: Record<string, string | undefined> = process.env,
) {
  const keyVersion = parseKeyVersion(variables.CCPUN_LOCAL_AI_ACTIVE_KEY_VERSION);
  const keys = new Map<LocalAiKeyVersion, Buffer>();
  for (const version of LOCAL_AI_KEY_VERSIONS) {
    const value = variables[`CCPUN_LOCAL_AI_ENCRYPTION_KEY_V${version}`];
    if (value?.trim()) keys.set(version, decodeKey(value));
  }
  const activeKey = keys.get(keyVersion);
  if (!activeKey) throw new Error("LOCAL_AI_CRYPTO_UNAVAILABLE");
  if (keyVersion === 2 && !keys.has(1)) throw new Error("LOCAL_AI_CRYPTO_UNAVAILABLE");

  return {
    keyVersion,
    encrypt(jobId: string, taskType: LocalAiTaskType, value: unknown): LocalAiEncryptedPayload {
      const serialized = JSON.stringify(value);
      if (!serialized || serialized.length > 40_000) throw new Error("LOCAL_AI_PAYLOAD_INVALID");
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", activeKey, nonce);
      cipher.setAAD(aad(jobId, taskType, keyVersion));
      const ciphertext = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
      return {
        keyVersion,
        ciphertextB64: ciphertext.toString("base64"),
        nonceB64: nonce.toString("base64"),
        authTagB64: cipher.getAuthTag().toString("base64"),
      };
    },
    decrypt(jobId: string, taskType: LocalAiTaskType, value: LocalAiEncryptedPayload): unknown {
      const key = keys.get(value.keyVersion);
      if (!key) throw new Error("LOCAL_AI_KEY_VERSION_UNAVAILABLE");
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.nonceB64, "base64"));
      decipher.setAAD(aad(jobId, taskType, value.keyVersion));
      decipher.setAuthTag(Buffer.from(value.authTagB64, "base64"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(value.ciphertextB64, "base64")),
        decipher.final(),
      ]).toString("utf8");
      return JSON.parse(plaintext) as unknown;
    },
  };
}

export function getLocalAiCryptoStatus(
  variables: Record<string, string | undefined> = process.env,
) {
  try {
    const crypto = createLocalAiPayloadCrypto(variables);
    return { ready: true as const, activeKeyVersion: crypto.keyVersion };
  } catch {
    return { ready: false as const, activeKeyVersion: null };
  }
}
