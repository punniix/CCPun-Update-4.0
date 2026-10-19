"use client";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import styles from '@/components/layout/website-43/Website43.module.css';
export function ArticleTableAccess({ children, stickyFirstColumn = false, columnCount = 2 }: { children: ReactNode; stickyFirstColumn?: boolean; columnCount?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [overflow, setOverflow] = useState(false);
  const [scroll, setScroll] = useState({ end: true, width: 100, left: 0 });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      setOverflow(node.scrollWidth > node.clientWidth + 1);
      const width = Math.min(100, node.clientWidth / Math.max(1, node.scrollWidth) * 100);
      const progress = node.scrollLeft / Math.max(1, node.scrollWidth - node.clientWidth);
      setScroll({ end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 2, width, left: progress * (100 - width) });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    measure();
    node.addEventListener('scroll', measure, { passive: true });
    return () => { observer.disconnect(); node.removeEventListener('scroll', measure); };
  }, []);
  return <>
    {overflow && <p id={hintId} className={styles.tableHint}>เลื่อนตารางเพื่อดูทั้งหมด</p>}
    <div className={styles.articleTableViewport} data-overflow={overflow || undefined} data-scroll-end={scroll.end} style={{ '--article-table-remainder': `${Math.max(0, columnCount - 1) * 246}px` } as CSSProperties}>
      <div ref={ref} className={styles.articleTableWrap} data-wide-table={stickyFirstColumn || undefined} tabIndex={overflow ? 0 : undefined} role={overflow ? 'region' : undefined} aria-label={overflow ? 'ตารางที่เลื่อนได้' : undefined} aria-describedby={overflow ? hintId : undefined}>{children}</div>
      {overflow && <div className={styles.articleTableTrack} aria-hidden="true"><span style={{ width: `${scroll.width}%`, left: `${scroll.left}%` }} /></div>}
    </div>
  </>;
}
