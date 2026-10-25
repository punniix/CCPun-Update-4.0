import type { ReactNode } from "react";
import type { PublicCopyValues } from "@/lib/content/public-copy-registry";
import { chatContextForPath, type ChatPageContext, type LineChatTopic } from "@/lib/line/chat-panel";
import styles from "./V5.module.css";
import V5Header from "./V5Header";
import V5Footer from "./V5Footer";
import V5ChatDockServer from "./V5ChatDockServer";

/**
 * v5 page frame: header, one focusable main landmark (skip-link target), the single shared
 * footer and the one bottom LINE chat element. Server-rendered; no client-only navigation.
 * The chat topics follow the page's physical path (`current`) unless `chat` names a page group;
 * `chatTopic` adds one code-fallback topic for that group (Coming Soon pages).
 */
export default function V5Page({ current, children, siteCopy, chat, chatTopic }: { current?: string; children: ReactNode; siteCopy?: PublicCopyValues; chat?: ChatPageContext; chatTopic?: LineChatTopic }) {
  return (
    <div className={styles.root}>
      <V5Header current={current} siteCopy={siteCopy} />
      <main id="main-content" tabIndex={-1}>{children}</main>
      <V5Footer siteCopy={siteCopy} />
      <V5ChatDockServer context={chat ?? chatContextForPath(current)} pageTopic={chatTopic} />
    </div>
  );
}

export { styles as v5Styles };
