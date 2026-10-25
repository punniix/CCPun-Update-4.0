import { getLineChatConfig } from "@/lib/content/line-chat-config";
import { selectChatConfigForPage, type ChatPageContext } from "@/lib/line/chat-panel";
import V5ChatDock from "./V5ChatDock";

/**
 * Reads the published chat config (Sanity UAT on test.ccpun.com, Production on ccpun.com, with the
 * shipped defaults on any failure) and hands the client only this page's slice.
 */
export default async function V5ChatDockServer({ context }: { context: ChatPageContext }) {
  const { config } = await getLineChatConfig();
  return <V5ChatDock config={selectChatConfigForPage(config, context, new Date())} context={context} />;
}
