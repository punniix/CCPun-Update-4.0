"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import styles from '@/components/layout/website-43/Website43.module.css';
export function ArticleTableAccess({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setOverflow(node.scrollWidth > node.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, []);
  return <>
    {overflow && <p id={hintId} className={styles.tableHint}>เลื่อนตารางเพื่อดูทั้งหมด</p>}
    <div ref={ref} className={styles.articleTableWrap} tabIndex={overflow ? 0 : undefined} role={overflow ? 'region' : undefined} aria-label={overflow ? 'ตารางที่เลื่อนได้' : undefined} aria-describedby={overflow ? hintId : undefined}>{children}</div>
  </>;
}
