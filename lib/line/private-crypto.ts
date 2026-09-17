import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

export const LINE_PRIVATE_KEY_VERSION = 1 as const;

export type LineEncryptedValue = {
  keyVersion: typeof LINE_PRIVATE_KEY_VERSION;
  ciphertextB64: string;
  nonceB64: string;
  authTagB64: string;
};

export type LinePrivateCrypto = {
  keyVersion: typeof LINE_PRIVATE_KEY_VERSION;
  lookupDigest(value: string, purpose: string): string;
  encrypt(value: string, purpose: string): LineEncryptedValue;
  decrypt(value: LineEncryptedValue, purpose: string): string;
};

export type LineContentCrypto = {
  keyVersion: typeof LINE_PRIVATE_KEY_VERSION;
  encrypt(value: string, purpose: string): LineEncryptedValue;
  decrypt(value: LineEncryptedValue, purpose: string): string;
};

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

function aadFor(purpose: string) {
  if (!/^[a-z0-9:_-]{1,80}$/.test(purpose)) throw new Error("LINE_PRIVATE_CRYPTO_PURPOSE_INVALID");
  return Buffer.from(`ccpun-line:v${LINE_PRIVATE_KEY_VERSION}:${purpose}`, "utf8");
}

function contentCryptoFromKey(encryptionKey: Buffer): LineContentCrypto {
  return {
    keyVersion: LINE_PRIVATE_KEY_VERSION,
    encrypt(value, purpose) {
      if (!value) throw new Error("LINE_PRIVATE_ENCRYPT_VALUE_REQUIRED");
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", encryptionKey, nonce);
      cipher.setAAD(aadFor(purpose));
      const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
      return {
        keyVersion: LINE_PRIVATE_KEY_VERSION,
        ciphertextB64: ciphertext.toString("base64"),
        nonceB64: nonce.toString("base64"),
        authTagB64: cipher.getAuthTag().toString("base64"),
      };
    },
    decrypt(value, purpose) {
      if (value.keyVersion !== LINE_PRIVATE_KEY_VERSION) throw new Error("LINE_PRIVATE_KEY_VERSION_UNSUPPORTED");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        encryptionKey,
        Buffer.from(value.nonceB64, "base64"),
      );
      decipher.setAAD(aadFor(purpose));
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
  return contentCryptoFromKey(decodeBase64Key(variables.CCPUN_LINE_ENCRYPTION_KEY_V1, 32, 32));
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
      return createHmac("sha256", lookupKey)
        .update(aadFor(purpose))
        .update("\0")
        .update(value, "utf8")
        .digest("hex");
    },
  };
}
