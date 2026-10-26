'use client';

import { useEffect, useState } from "react";
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { BLOG_COPY_DEFAULTS } from "@/lib/content/blog-copy-defaults";
import styles from "./V5Blog.module.css";

export const GROUP_PAGE_SIZE = 6;
export const GROUP_PAGE_SIZE_MOBILE = 4;

/**
 * Per-group pagination on the same /blog/ URL (FigCraft 02b Version B).
 * Every card stays in the server HTML; paging only toggles `data-pager-hidden`,
 * so no ?page= URL is created and older articles are never hidden from crawlers.
 */
export default function V5GroupPager({ gridId, total, groupTitle }: { gridId: string; total: number; groupTitle: string }) {
  const text = usePublicCopy(BLOG_COPY_DEFAULTS);
  const [size, setSize] = useState(GROUP_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(total / size));

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 639px)");
    const update = () => setSize(mobile.matches ? GROUP_PAGE_SIZE_MOBILE : GROUP_PAGE_SIZE);
    update();
    mobile.addEventListener("change", update);
    return () => mobile.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const current = Math.min(page, pages);
    Array.from(grid.children).forEach((card, index) => {
      const visible = index >= (current - 1) * size && index < current * size;
      if (visible) card.removeAttribute("data-pager-hidden"); else card.setAttribute("data-pager-hidden", "");
    });
  }, [gridId, page, pages, size]);

  if (pages <= 1) return null;
  const current = Math.min(page, pages);
  const go = (next: number) => {
    setPage(next);
    document.getElementById(gridId)?.closest("section")?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const numbers = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - current) <= 1);

  return (
    <div data-v5-pager="">
      <nav className={styles.pager} aria-label={text("blog.pager.label").replaceAll("{0}", groupTitle)}>
        <button type="button" disabled={current === 1} onClick={() => go(1)}>{text.node("blog.pager.first")}</button>
        <button type="button" disabled={current === 1} onClick={() => go(current - 1)}>{text.node("blog.button")}</button>
        {numbers.map((n) => <button type="button" key={n} aria-current={n === current ? "page" : undefined} onClick={() => go(n)}>{n}</button>)}
        <button type="button" disabled={current === pages} onClick={() => go(current + 1)}>{text.node("blog.button2")}</button>
        <button type="button" disabled={current === pages} onClick={() => go(pages)}>{text.node("blog.pager.last")}</button>
      </nav>
      <p className={styles.pagerStatus} aria-live="polite">{text("blog.pager.status").replaceAll("{0}", String(current)).replaceAll("{1}", String(pages))}</p>
    </div>
  );
}
