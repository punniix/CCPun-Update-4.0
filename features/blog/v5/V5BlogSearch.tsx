'use client';

import { useEffect, useState } from "react";
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { BLOG_COPY_DEFAULTS } from "@/lib/content/blog-copy-defaults";
import styles from "./V5Blog.module.css";

/**
 * Client-side filter over the server-rendered cards. It never removes cards from
 * the HTML and keeps the existing `?q=` deep-link behaviour without adding history entries.
 */
export default function V5BlogSearch({ scopeId, initialQuery = "" }: { scopeId: string; initialQuery?: string }) {
  const text = usePublicCopy(BLOG_COPY_DEFAULTS);
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    const scope = document.getElementById(scopeId);
    if (!scope) return;
    const needle = query.trim().toLocaleLowerCase("th");
    scope.toggleAttribute("data-v5-searching", Boolean(needle));
    let matches = 0;
    scope.querySelectorAll<HTMLElement>("[data-v5-search]").forEach((card) => {
      const hit = !needle || (card.dataset.v5Search ?? "").toLocaleLowerCase("th").includes(needle);
      card.hidden = !hit;
      if (hit) matches += 1;
    });
    scope.querySelectorAll<HTMLElement>("[data-v5-group]").forEach((group) => {
      group.hidden = Boolean(needle) && !group.querySelector("[data-v5-search]:not([hidden])");
    });
    scope.querySelectorAll<HTMLElement>("[data-v5-search-hide]").forEach((element) => { element.hidden = Boolean(needle); });
    const empty = scope.querySelector<HTMLElement>("[data-v5-search-empty]");
    if (empty) empty.hidden = !needle || matches > 0;
  }, [query, scopeId]);

  return (
    <div className={styles.search} role="search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      <input
        type="search"
        value={query}
        placeholder={text("blog.website43BlogInteractiveplaceholder")}
        aria-label={text("blog.website43BlogInteractivearialabel2")}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          const url = new URL(window.location.href);
          url.searchParams.delete("page");
          if (value.trim()) url.searchParams.set("q", value); else url.searchParams.delete("q");
          window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
        }}
      />
    </div>
  );
}
