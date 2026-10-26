import styles from "./V5Tool.module.css";

/** Decorative completion cue. Native mount plays once; the result heading remains the spoken label. */
export default function V5ResultTick() {
  return <span className={styles.resultTick} aria-hidden="true" data-v5-result-tick="">
    <svg viewBox="0 0 24 24" focusable="false"><path d="M5 12.5 9.5 17 19 7" pathLength={1} /></svg>
  </span>;
}
