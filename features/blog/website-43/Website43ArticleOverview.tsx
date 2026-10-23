"use client";
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { BLOG_COPY_DEFAULTS } from "@/lib/content/blog-copy-defaults";

import { useEffect, useRef } from 'react';
import styles from './Website43ArticleOverview.module.css';

const ownedHighlightSets = new WeakSet<Highlight>();
const highlightName = 'ccpun-overview-pending';

// Native text nodes and their layout stay intact: only a Range's ink changes.
export function overviewGraphemeEnds(text: string) {
  return Array.from(new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(text), part => part.index + part.segment.length);
}

export default function Website43ArticleOverview({ summary }: { summary?: string | null }) {
  const copyText = usePublicCopy(BLOG_COPY_DEFAULTS);


  const detailsRef = useRef<HTMLDetailsElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const details = detailsRef.current, content = contentRef.current;
    if (!details || !content || !summary?.trim() || typeof Intl.Segmenter !== 'function'
      || typeof IntersectionObserver === 'undefined' || typeof Highlight === 'undefined'
      || typeof CSS === 'undefined' || !CSS.highlights || typeof matchMedia !== 'function') return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches || overviewGraphemeEnds(summary).length > 200) return;
    // Never hide text that the reader can already see when hydration completes.
    const rect = content.getBoundingClientRect();
    if (rect.top < innerHeight && rect.bottom > 0) return;
    let started = false, finished = false, isInView = false, timer: ReturnType<typeof setTimeout> | undefined;
    let observer: IntersectionObserver | undefined;
    let pendingRange: Range | undefined, pendingSet: Highlight | undefined;
    const finish = () => {
      finished = true;
      if (timer !== undefined) clearTimeout(timer);
      if (pendingRange && pendingSet) {
        pendingSet.delete(pendingRange);
        if (pendingSet.size === 0 && CSS.highlights.get(highlightName) === pendingSet) CSS.highlights.delete(highlightName);
      }
      observer?.disconnect();
    };
    const start = () => {
      if (started || finished || !isInView || !details.open) return;
      started = true;
      try {
        const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
        const boundaries: Array<{ node: Text; offset: number }> = [];
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const text = node as Text;
          for (const offset of overviewGraphemeEnds(text.data)) boundaries.push({ node: text, offset });
        }
        if (!boundaries.length) { finish(); return; }
        const range = new Range();
        const last = boundaries[boundaries.length - 1];
        range.setEnd(last.node, last.offset);
        range.setStart(boundaries[0].node, 0);
        const registered = CSS.highlights.get(highlightName);
        if (registered && !ownedHighlightSets.has(registered)) { finish(); return; }
        pendingSet = registered ?? new Highlight();
        ownedHighlightSets.add(pendingSet);
        pendingRange = range; pendingSet.add(range);
        if (!registered) CSS.highlights.set(highlightName, pendingSet);
        let revealed = 0;
        const step = () => {
          try {
            if (motion.matches || document.hidden || !details.open) { finish(); return; }
            revealed = Math.min(boundaries.length, revealed + 3);
            const boundary = boundaries[revealed - 1];
            range.setStart(boundary.node, boundary.offset);
            if (revealed === boundaries.length) finish();
            else timer = setTimeout(step, 28);
          } catch { finish(); }
        };
        step();
      } catch { finish(); }
    };
    const toggle = () => { if (!details.open && started) finish(); else start(); };
    const visibility = () => { if (document.hidden) finish(); };
    const selection = () => { if (content.contains(document.getSelection()?.anchorNode ?? null)) finish(); };
    const search = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') finish(); };
    try {
      observer = new IntersectionObserver(entries => { isInView = entries.some(entry => entry.isIntersecting); if (isInView) start(); else if (started) finish(); });
      observer.observe(content);
      details.addEventListener('toggle', toggle);
      document.addEventListener('visibilitychange', visibility);
      document.addEventListener('selectionchange', selection);
      window.addEventListener('beforeprint', finish);
      window.addEventListener('keydown', search);
      motion.addEventListener('change', finish);
    } catch { finish(); }
    return () => {
      finish();
      details.removeEventListener('toggle', toggle);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('selectionchange', selection);
      window.removeEventListener('beforeprint', finish);
      window.removeEventListener('keydown', search);
      motion.removeEventListener('change', finish);
    };
  }, [summary]);
  if (!summary?.trim()) return null;
  const points = summary.split(/\r?\n/).filter(point => point.trim());
  return <details className={styles.overview} open lang="th" ref={detailsRef}>
    <summary className={styles.heading}>{copyText.node("blog.heading")}<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
    <div className={styles.content} ref={contentRef}>
      <ul>{points.map((point, index) => <li key={index}>{point}</li>)}</ul>
    </div>
  </details>;
}
