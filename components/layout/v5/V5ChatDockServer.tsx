import { getLineChatConfig } from "@/lib/content/line-chat-config";
import { selectChatConfigForPage, withPageTopic, type ChatPageContext, type LineChatTopic } from "@/lib/line/chat-panel";
import V5ChatDock from "./V5ChatDock";

/**
 * Reads the published chat config (Sanity UAT on test.ccpun.com, Production on ccpun.com, with the
 * shipped defaults on any failure) and hands the client only this page's slice. A page may add one
 * code-fallback topic for its own group (Coming Soon); the published config still wins.
 */
export default async function V5ChatDockServer({ context, pageTopic }: { context: ChatPageContext; pageTopic?: LineChatTopic }) {
  const { config } = await getLineChatConfig();
  const pageConfig = pageTopic ? withPageTopic(config, context.pageGroup, pageTopic) : config;
  return <V5ChatDock config={selectChatConfigForPage(pageConfig, context, new Date())} context={context} />;
}
