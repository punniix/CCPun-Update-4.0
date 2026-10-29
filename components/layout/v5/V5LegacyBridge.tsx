import type { ReactNode } from "react";
import styles from "./V5.module.css";

/**
 * Hosts a reused widget (countdown, share/engagement, table access) inside a v5 page without
 * re-implementing its behaviour or analytics. Phase B moved those widgets off the Website 4.3
 * stylesheet, so the bridge only maps the legacy token names onto v5 tokens.
 */
export default function V5LegacyBridge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.compat} ${className}`.trim()}>{children}</div>;
}
