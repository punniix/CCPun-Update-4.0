import type { ReactNode } from "react";
import w43 from "@/components/layout/website-43/Website43.module.css";
import styles from "./V5.module.css";

/** Hosts a reused Website 4.3 widget inside a v5 page without re-implementing its behaviour or analytics. */
export default function V5LegacyBridge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${w43.root} ${styles.compat} ${className}`.trim()}>{children}</div>;
}
