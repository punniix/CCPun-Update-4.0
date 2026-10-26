import "server-only";
import { cache } from "react";
import { sanityFetch } from "./sanity-fetch";
import {
  LINE_CHAT_CONFIG_ID,
  LINE_CHAT_CONFIG_PROJECTION,
  LINE_CHAT_DEFAULTS,
  lineChatConfigFromProjection,
  parseLineChatConfig,
  type LineChatConfigRead,
} from "@/lib/line/chat-config";

const READ_TIMEOUT_MS = 1_500;

/**
 * Published LINE chat config for this request (test.ccpun.com reads Sanity UAT, ccpun.com reads
 * Production, through the existing lane-guarded content client). Any failure, timeout or invalid
 * value returns the shipped defaults: the chat button must always render.
 */
export const getLineChatConfig = cache(async (): Promise<LineChatConfigRead> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const read = sanityFetch({
      query: `*[_id == $id && _type == "lineChatConfig"][0]${LINE_CHAT_CONFIG_PROJECTION}`,
      params: { id: LINE_CHAT_CONFIG_ID },
      perspective: "published",
      stega: false,
    });
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("line-chat-config-timeout")), READ_TIMEOUT_MS); });
    const { data } = await Promise.race([read, timeout]);
    return parseLineChatConfig(lineChatConfigFromProjection(data));
  } catch {
    return { config: LINE_CHAT_DEFAULTS, source: "default", invalid: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
});
