import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Application-level encryption for financial planning room data.
 *
 * Same pattern as lib/line/private-crypto.ts: AES-256-GCM, 12-byte random
 * nonce, versioned 32-byte base64 keys from environment variables, and an AAD
 * that binds the key version and a purpose string. The FA room uses its own
 * key family and AAD namespace (`ccpun-fa`) so a LINE key can never decrypt
 * planning data and vice versa. Purposes include the household and row IDs,
 * so a ciphertext copied onto another row or household fails authentication.
 *
 * Environment variables (never commit their values):
 *   CCPUN_FA_ENCRYPTION_KEY_V1, CCPUN_FA_ENCRYPTION_KEY_V2 (optional, rotation)
 *   CCPUN_FA_ACTIVE_ENCRYPTION_KEY_VERSION ("1" default, or "2")
 */

export const FA_KEY_VERSIONS = [1, 2] as const;
export type FaKeyVersion = (typeof FA_KEY_VERSIONS)[number];

export type FaEncryptedValue = {
  keyVersion: FaKeyVersion;
  ciphertextB64: string;
  nonceB64: string;
  authTagB64: string;
};

export type FaCrypto = {
  keyVersion: FaKeyVersion;
  availableKeyVersions: readonly FaKeyVersion[];
  encryptJson(value: unknown, purpose: string): FaEncryptedValue;
  decryptJson(value: FaEncryptedValue, purpose: string): unknown;
};

export const FA_CRYPTO_ENV_KEYS = [
  "CCPUN_FA_ENCRYPTION_KEY_V1",
  "CCPUN_FA_ENCRYPTION_KEY_V2",
  "CCPUN_FA_ACTIVE_ENCRYPTION_KEY_VERSION",
] as const;

export function isFaKeyVersion(value: unknown): value is FaKeyVersion {
  return value === 1 || value === 2;
}

function optionalKey(value: string | undefined): Buffer | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error("FA_CRYPTO_UNAVAILABLE");
  }
  const decoded = Buffer.from(normalized, "base64");
  if (decoded.length !== 32) throw new Error("FA_CRYPTO_UNAVAILABLE");
  return decoded;
}

function activeVersion(variables: Record<string, string | undefined>): FaKeyVersion {
  const configured = variables.CCPUN_FA_ACTIVE_ENCRYPTION_KEY_VERSION?.trim();
  if (!configured || configured === "1") return 1;
  if (configured === "2") return 2;
  throw new Error("FA_ACTIVE_KEY_VERSION_INVALID");
}

function aad(version: FaKeyVersion, purpose: string) {
  if (!/^[a-z0-9:_-]{1,128}$/.test(purpose)) throw new Error("FA_CRYPTO_PURPOSE_INVALID");
  return Buffer.from(`ccpun-fa:v${version}:${purpose}`, "utf8");
}

export function createFinancialPlanningCrypto(
  variables: Record<string, string | undefined> = process.env,
): FaCrypto {
  const version = activeVersion(variables);
  const keys = new Map<FaKeyVersion, Buffer>();
  const v1 = optionalKey(variables.CCPUN_FA_ENCRYPTION_KEY_V1);
  const v2 = optionalKey(variables.CCPUN_FA_ENCRYPTION_KEY_V2);
  if (v1) keys.set(1, v1);
  if (v2) keys.set(2, v2);
  if (!keys.has(version)) throw new Error("FA_CRYPTO_UNAVAILABLE");
  if (v1 && v2 && v1.equals(v2)) throw new Error("FA_CRYPTO_KEYS_MUST_DIFFER");

  return {
    keyVersion: version,
    availableKeyVersions: FA_KEY_VERSIONS.filter((candidate) => keys.has(candidate)),
    encryptJson(value, purpose) {
      const key = keys.get(version);
      if (!key) throw new Error("FA_CRYPTO_UNAVAILABLE");
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      cipher.setAAD(aad(version, purpose));
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
      return {
        keyVersion: version,
        ciphertextB64: ciphertext.toString("base64"),
        nonceB64: nonce.toString("base64"),
        authTagB64: cipher.getAuthTag().toString("base64"),
      };
    },
    decryptJson(value, purpose) {
      if (!isFaKeyVersion(value.keyVersion)) throw new Error("FA_KEY_VERSION_UNSUPPORTED");
      const key = keys.get(value.keyVersion);
      if (!key) throw new Error("FA_KEY_VERSION_UNAVAILABLE");
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.nonceB64, "base64"));
      decipher.setAAD(aad(value.keyVersion, purpose));
      decipher.setAuthTag(Buffer.from(value.authTagB64, "base64"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(value.ciphertextB64, "base64")),
        decipher.final(),
      ]).toString("utf8");
      return JSON.parse(plaintext) as unknown;
    },
  };
}

/** Returns null instead of throwing, for status pages and fail-closed routes. */
export function tryCreateFinancialPlanningCrypto(
  variables: Record<string, string | undefined> = process.env,
): FaCrypto | null {
  try {
    return createFinancialPlanningCrypto(variables);
  } catch {
    return null;
  }
}
