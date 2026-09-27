import { z } from "zod";
import { parseLinePostbackContext } from "../../line/ecosystem";

const digest = z.string().regex(/^[0-9a-f]{64}$/);
function base64(bytes?: number) {
  return z.string().min(4).max(100_000).refine((value) => {
    const decoded = Buffer.from(value, "base64");
    return decoded.toString("base64") === value && (!bytes || decoded.length === bytes);
  });
}
const encrypted = z.object({
  keyVersion: z.union([z.literal(1), z.literal(2)]),
  ciphertextB64: base64(), nonceB64: base64(12), authTagB64: base64(16),
}).strict();
const postback = z.object({
  journey: z.enum(["motor_quote_review", "life_health_policy_review", "investment_before_you_act", "human_handoff"]),
  stage: z.string().min(1).max(80), needsHuman: z.boolean(),
}).strict().refine((value) => {
  const locked = parseLinePostbackContext(`journey=${value.journey}&stage=${value.stage}`);
  return locked?.journey === value.journey && locked.stage === value.stage && locked.needsHuman === value.needsHuman;
});

export const encryptedLineEventSchema = z.object({
  eventDigest: digest,
  eventType: z.enum(["message", "follow", "unfollow", "postback", "unsend"]),
  occurredAt: z.iso.datetime(), isRedelivery: z.boolean(),
  sourceType: z.enum(["user", "group", "room", "unknown"]),
  identity: z.object({ lookupDigest: digest, encryptedExternalRef: encrypted }).strict().nullable(),
  message: z.object({
    providerMessageDigest: digest, encryptedProviderMessageId: encrypted,
    messageType: z.enum(["text", "image", "video", "audio", "file", "location", "sticker"]),
    encryptedContent: encrypted.nullable(), materialReceived: z.boolean(),
  }).strict().nullable(),
  postback: postback.nullable(), unsendTargetDigest: digest.nullable(), needsHuman: z.boolean(),
}).strict().refine((value) => {
  if (value.eventType !== "unsend" && !value.identity) return false;
  return (value.eventType === "message") === Boolean(value.message)
    && (value.eventType === "postback" || !value.postback)
    && (value.eventType === "unsend") === Boolean(value.unsendTargetDigest);
});

export async function readEncryptedLineEventBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256_000) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { reader.releaseLock(); }
}
