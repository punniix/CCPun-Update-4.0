"use client";

import { useEffect, useId, useState } from "react";
import styles from "./V5Blog.module.css";

type Heading = { id: string; label: string };

/** Disclosure state belongs to navigation only; the article and every heading anchor stay intact. */
export default function V5ArticleToc({ groups }: { groups: Array<{ primary: Heading; children: Heading[] }> }) {
  const listId = useId();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState("");
  useEffect(() => {
    const revealHash = () => {
      let id = window.location.hash.slice(1);
      try { id = decodeURIComponent(id); } catch { /* A malformed fragment cannot break navigation. */ }
      setActive(id);
      const group = groups.find(({ primary, children }) => primary.id === id || children.some((child) => child.id === id));
      if (group?.children.length) setExpanded((current) => ({ ...current, [group.primary.id]: true }));
    };
    revealHash();
    window.addEventListener("hashchange", revealHash);
    return () => window.removeEventListener("hashchange", revealHash);
  }, [groups]);
  return <ol>{groups.map(({ primary, children }) => {
    const open = expanded[primary.id] === true;
    const childrenId = `${listId}-${primary.id}`;
    return <li key={primary.id}>
      <div className={styles.tocRow}>
        <a href={`#${primary.id}`} aria-current={active === primary.id ? "location" : undefined}>{primary.label}</a>
        {children.length > 0 && <button type="button" aria-label={primary.label} aria-expanded={open} aria-controls={childrenId} onClick={() => setExpanded((current) => ({ ...current, [primary.id]: !open }))}><span aria-hidden="true">{open ? "⌃" : "⌄"}</span></button>}
      </div>
      {children.length > 0 && <ol id={childrenId} hidden={!open}>{children.map((child) => <li key={child.id}><a href={`#${child.id}`} aria-current={active === child.id ? "location" : undefined}>{child.label}</a></li>)}</ol>}
    </li>;
  })}</ol>;
}
