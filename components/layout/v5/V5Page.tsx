import type { ReactNode } from "react";
import type { PublicCopyValues } from "@/lib/content/public-copy-registry";
import styles from "./V5.module.css";
import V5Header from "./V5Header";
import V5Footer from "./V5Footer";

/**
 * v5 page frame: header, one focusable main landmark (skip-link target) and the
 * single shared footer. Server-rendered; no client-only navigation.
 */
export default function V5Page({ current, children, siteCopy }: { current?: string; children: ReactNode; siteCopy?: PublicCopyValues }) {
  return (
    <div className={styles.root}>
      <V5Header current={current} siteCopy={siteCopy} />
      <main id="main-content" tabIndex={-1}>{children}</main>
      <V5Footer siteCopy={siteCopy} />
    </div>
  );
}

export { styles as v5Styles };
