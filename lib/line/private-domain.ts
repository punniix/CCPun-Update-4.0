import { parseLinePostbackContext, type LinePostbackContext } from "./ecosystem";
import type { LineEncryptedValue, LinePrivateCrypto } from "./private-crypto";

export type LinePrivateIdentity = {
  lookupDigest: string;
  encryptedExternalRef: LineEncryptedValue;
};

export type LinePrivateMessage = {
  providerMessageDigest: string;
  encryptedProviderMessageId: LineEncryptedValue;
  messageType: string;
  encryptedContent: LineEncryptedValue | null;
  materialReceived: boolean;
};

export type LinePrivateIngestEvent = {
  eventDigest: string;
  eventType: "message" | "follow" | "unfollow" | "postback" | "unsend";
  occurredAt: string;
  isRedelivery: boolean;
  sourceType: "user" | "group" | "room" | "unknown";
  identity: LinePrivateIdentity | null;
  message: LinePrivateMessage | null;
  postback: LinePostbackContext | null;
  unsendTargetDigest: string | null;
  needsHuman: boolean;
};

export type LineEventNormalizationResult =
  | { kind: "accepted"; event: LinePrivateIngestEvent }
  | { kind: "unsupported" }
  | { kind: "malformed" };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function eventTimestamp(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sourceTypeOf(source: Record<string, unknown> | null): LinePrivateIngestEvent["sourceType"] {
  const type = source?.type;
  return type === "user" || type === "group" || type === "room" ? type : "unknown";
}

function identityFromSource(source: Record<string, unknown> | null, crypto: LinePrivateCrypto): LinePrivateIdentity | null {
  const userId = nonEmptyString(source?.userId);
  if (!userId) return null;
  return {
    lookupDigest: crypto.lookupDigest(userId, "line-user-id"),
    encryptedExternalRef: crypto.encrypt(userId, "line-user-id"),
  };
}

const MATERIAL_MESSAGE_TYPES = new Set(["image", "video", "audio", "file"]);
const SUPPORTED_MESSAGE_TYPES = new Set([
  "text",
  "image",
  "video",
  "audio",
  "file",
  "location",
  "sticker",
]);

export function normalizeLinePrivateEvent(
  input: unknown,
  crypto: LinePrivateCrypto,
): LineEventNormalizationResult {
  const event = asRecord(input);
  if (!event) return { kind: "malformed" };

  const webhookEventId = nonEmptyString(event.webhookEventId);
  const type = nonEmptyString(event.type);
  const occurredAt = eventTimestamp(event.timestamp);
  if (!webhookEventId || !type || !occurredAt) return { kind: "malformed" };

  const source = asRecord(event.source);
  const deliveryContext = asRecord(event.deliveryContext);
  const identity = identityFromSource(source, crypto);
  const base = {
    eventDigest: crypto.lookupDigest(webhookEventId, "event-id"),
    occurredAt,
    isRedelivery: deliveryContext?.isRedelivery === true,
    sourceType: sourceTypeOf(source),
    identity,
    postback: null as LinePostbackContext | null,
  };

  if (type === "unsend") {
    const unsend = asRecord(event.unsend);
    const targetMessageId = nonEmptyString(unsend?.messageId);
    if (!targetMessageId) return { kind: "malformed" };
    return {
      kind: "accepted",
      event: {
        ...base,
        eventType: "unsend",
        message: null,
        unsendTargetDigest: crypto.lookupDigest(targetMessageId, "message-id"),
        needsHuman: false,
      },
    };
  }

  if (type !== "message" && type !== "follow" && type !== "unfollow" && type !== "postback") {
    return { kind: "unsupported" };
  }

  if (!identity) return { kind: "malformed" };

  if (type === "follow" || type === "unfollow") {
    return {
      kind: "accepted",
      event: {
        ...base,
        eventType: type,
        message: null,
        unsendTargetDigest: null,
        needsHuman: false,
      },
    };
  }

  if (type === "postback") {
    const postback = asRecord(event.postback);
    const context = parseLinePostbackContext(nonEmptyString(postback?.data));
    return {
      kind: "accepted",
      event: {
        ...base,
        eventType: "postback",
        message: null,
        postback: context,
        unsendTargetDigest: null,
        needsHuman: context?.needsHuman ?? false,
      },
    };
  }

  if (type !== "message") return { kind: "unsupported" };

  const message = asRecord(event.message);
  const providerMessageId = nonEmptyString(message?.id);
  const messageType = nonEmptyString(message?.type);
  if (!providerMessageId || !messageType || !SUPPORTED_MESSAGE_TYPES.has(messageType)) {
    return messageType && !SUPPORTED_MESSAGE_TYPES.has(messageType)
      ? { kind: "unsupported" }
      : { kind: "malformed" };
  }

  let encryptedContent: LineEncryptedValue | null = null;
  if (messageType === "text") {
    const text = nonEmptyString(message?.text);
    if (!text) return { kind: "malformed" };
    encryptedContent = crypto.encrypt(text, "message-content");
  }

  return {
    kind: "accepted",
    event: {
      ...base,
      eventType: "message",
      message: {
        providerMessageDigest: crypto.lookupDigest(providerMessageId, "message-id"),
        encryptedProviderMessageId: crypto.encrypt(providerMessageId, "message-provider-id"),
        messageType,
        encryptedContent,
        materialReceived: MATERIAL_MESSAGE_TYPES.has(messageType),
      },
      unsendTargetDigest: null,
      needsHuman: true,
    },
  };
}
