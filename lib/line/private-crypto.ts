import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

export const LINE_PRIVATE_KEY_VERSIONS = [1, 2] as const;
export type LinePrivateKeyVersion = (typeof LINE_PRIVATE_KEY_VERSIONS)[number];

export type LineEncryptedValue = {
  keyVersion: LinePrivateKeyVersion;
  ciphertextB64: string;
  nonceB64: string;
  authTagB64: string;
};

export type LinePrivateCrypto = {
  keyVersion: LinePrivateKeyVersion;
  availableKeyVersions: readonly LinePrivateKeyVersion[];
  lookupDigest(value: string, purpose: string): string;
  encrypt(value: string, purpose: string): LineEncryptedValue;
  decrypt(value: LineEncryptedValue, purpose: string): string;
  hasKeyVersion(version: LinePrivateKeyVersion): boolean;
};

export type LineContentCrypto = {
  keyVersion: LinePrivateKeyVersion;
  availableKeyVersions: readonly LinePrivateKeyVersion[];
  encrypt(value: string, purpose: string): LineEncryptedValue;
  decrypt(value: LineEncryptedValue, purpose: string): string;
  hasKeyVersion(version: LinePrivateKeyVersion): boolean;
};

export class LinePrivateKeyUnavailableError extends Error {
  readonly code = "LINE_PRIVATE_KEY_VERSION_UNAVAILABLE";
  readonly keyVersion: LinePrivateKeyVersion;

  constructor(keyVersion: LinePrivateKeyVersion) {
    super("LINE_PRIVATE_KEY_VERSION_UNAVAILABLE");
    this.name = "LinePrivateKeyUnavailableError";
    this.keyVersion = keyVersion;
  }
}

export function isLinePrivateKeyVersion(value: unknown): value is LinePrivateKeyVersion {
  return value === 1 || value === 2;
}

export function isLinePrivateKeyUnavailableError(
  error: unknown,
): error is LinePrivateKeyUnavailableError {
  return error instanceof LinePrivateKeyUnavailableError;
}

function decodeBase64Key(value: string | undefined, minimumBytes: number, exactBytes?: number): Buffer {
  const normalized = value?.trim();
  if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error("LINE_PRIVATE_CRYPTO_UNAVAILABLE");
  }

  const decoded = Buffer.from(normalized, "base64");
  if (decoded.length < minimumBytes || (exactBytes !== undefined && decoded.length !== exactBytes)) {
    throw new Error("LINE_PRIVATE_CRYPTO_UNAVAILABLE");
  }
  return decoded;
}

function optionalBase64Key(value: string | undefined): Buffer | null {
  if (!value?.trim()) return null;
  return decodeBase64Key(value, 32, 32);
}

function activeEncryptionVersion(
  variables: Record<string, string | undefined>,
): LinePrivateKeyVersion {
  const configured = variables.CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION?.trim();
  if (!configured || configured === "1") return 1;
  if (configured === "2") return 2;
  throw new Error("LINE_PRIVATE_ACTIVE_KEY_VERSION_INVALID");
}

function aadFor(version: LinePrivateKeyVersion, purpose: string) {
  if (!/^[a-z0-9:_-]{1,80}$/.test(purpose)) throw new Error("LINE_PRIVATE_CRYPTO_PURPOSE_INVALID");
  return Buffer.from(`ccpun-line:v${version}:${purpose}`, "utf8");
}

function contentCryptoFromKeys(
  activeVersion: LinePrivateKeyVersion,
  keys: ReadonlyMap<LinePrivateKeyVersion, Buffer>,
): LineContentCrypto {
  if (!keys.has(activeVersion)) throw new Error("LINE_PRIVATE_CRYPTO_UNAVAILABLE");
  const availableKeyVersions = LINE_PRIVATE_KEY_VERSIONS.filter((version) => keys.has(version));

  return {
    keyVersion: activeVersion,
    availableKeyVersions,
    hasKeyVersion(version) {
      return keys.has(version);
    },
    encrypt(value, purpose) {
      if (!value) throw new Error("LINE_PRIVATE_ENCRYPT_VALUE_REQUIRED");
      const encryptionKey = keys.get(activeVersion);
      if (!encryptionKey) throw new LinePrivateKeyUnavailableError(activeVersion);
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", encryptionKey, nonce);
      cipher.setAAD(aadFor(activeVersion, purpose));
      const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
      return {
        keyVersion: activeVersion,
        ciphertextB64: ciphertext.toString("base64"),
        nonceB64: nonce.toString("base64"),
        authTagB64: cipher.getAuthTag().toString("base64"),
      };
    },
    decrypt(value, purpose) {
      if (!isLinePrivateKeyVersion(value.keyVersion)) {
        throw new Error("LINE_PRIVATE_KEY_VERSION_UNSUPPORTED");
      }
      const encryptionKey = keys.get(value.keyVersion);
      if (!encryptionKey) throw new LinePrivateKeyUnavailableError(value.keyVersion);
      const decipher = createDecipheriv(
        "aes-256-gcm",
        encryptionKey,
        Buffer.from(value.nonceB64, "base64"),
      );
      decipher.setAAD(aadFor(value.keyVersion, purpose));
      decipher.setAuthTag(Buffer.from(value.authTagB64, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(value.ciphertextB64, "base64")),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}

export function createLineContentCrypto(
  variables: Record<string, string | undefined> = process.env,
): LineContentCrypto {
  const activeVersion = activeEncryptionVersion(variables);
  const keys = new Map<LinePrivateKeyVersion, Buffer>();
  const v1 = optionalBase64Key(variables.CCPUN_LINE_ENCRYPTION_KEY_V1);
  const v2 = optionalBase64Key(variables.CCPUN_LINE_ENCRYPTION_KEY_V2);
  if (v1) keys.set(1, v1);
  if (v2) keys.set(2, v2);
  return contentCryptoFromKeys(activeVersion, keys);
}

export function createLinePrivateCrypto(
  variables: Record<string, string | undefined> = process.env,
): LinePrivateCrypto {
  const lookupKey = decodeBase64Key(variables.CCPUN_LINE_IDENTITY_HMAC_KEY_V1, 32);
  const content = createLineContentCrypto(variables);

  return {
    ...content,
    lookupDigest(value, purpose) {
      if (!value) throw new Error("LINE_PRIVATE_LOOKUP_VALUE_REQUIRED");
      // Lookup digests are a stable identity/index contract. They deliberately
      // remain on the original v1 AAD namespace while encryption keys rotate.
      return createHmac("sha256", lookupKey)
        .update(aadFor(1, purpose))
        .update("\0")
        .update(value, "utf8")
        .digest("hex");
    },
  };
}
