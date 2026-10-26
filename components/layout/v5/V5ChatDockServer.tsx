import { getLineChatConfig } from "@/lib/content/line-chat-config";
import { resolveChatPanel, selectChatConfigForPage, withPageTopic, type ChatPageContext, type LineChatConfig, type LineChatTopic } from "@/lib/line/chat-panel";
import { LINE_OA_CHAT_URL } from "@/lib/line/oa-link";
import V5ChatDock from "./V5ChatDock";

/**
 * No-JS fallback for the page's LINE controls: the real LINE OA link with this page's first
 * topic prefill (owner-written text and reference code only), or the plain chat link.
 */
function fallbackHref(config: LineChatConfig, context: ChatPageContext, now: Date): string {
  const panel = resolveChatPanel({ ...context, config, now, consentGiven: false });
  return panel.mode === "panel" ? panel.topics[0]?.href ?? LINE_OA_CHAT_URL : panel.href;
}

/** The fallback href article-body LINE CTAs use on this page (same as the dock's, including a page topic). */
export async function getV5ChatFallbackHref(context: ChatPageContext, pageTopic?: LineChatTopic): Promise<string> {
  const { config } = await getLineChatConfig();
  const now = new Date();
  return fallbackHref(selectChatConfigForPage(pageTopic ? withPageTopic(config, context.pageGroup, pageTopic) : config, context, now), context, now);
}

/**
 * Reads the published chat config (Sanity UAT on test.ccpun.com, Production on ccpun.com, with the
 * shipped defaults on any failure) and hands the client only this page's slice. A page may add one
 * code-fallback topic for its own group (Coming Soon); the published config still wins.
 */
export default async function V5ChatDockServer({ context, pageTopic }: { context: ChatPageContext; pageTopic?: LineChatTopic }) {
  const { config } = await getLineChatConfig();
  const now = new Date();
  const pageConfig = selectChatConfigForPage(pageTopic ? withPageTopic(config, context.pageGroup, pageTopic) : config, context, now);
  return <V5ChatDock config={pageConfig} context={context} fallbackHref={fallbackHref(pageConfig, context, now)} />;
}
