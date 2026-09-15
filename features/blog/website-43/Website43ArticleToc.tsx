'use client';

import { useState } from 'react';
import styles from '@/components/layout/website-43/Website43.module.css';

type TocHeading = {
  id: string;
  label: string;
  level: number;
};

export type TocGroup = {
  primary: TocHeading;
  children: TocHeading[];
};

export default function Website43ArticleToc({ groups }: { groups: TocGroup[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggleGroup = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={styles.tocList}>
      {groups.map((group) => {
        const hasChildren = group.children.length > 0;
        const isExpanded = expanded.has(group.primary.id);
        const sublistId = `toc-children-${group.primary.id}`;

        return (
          <div className={styles.tocGroup} key={group.primary.id}>
            <div className={styles.tocGroupRow}>
              <a className={styles.tocPrimary} href={`#${group.primary.id}`}>
                <span aria-hidden="true" />
                {group.primary.label}
              </a>
              {hasChildren ? (
                <button
                  type="button"
                  className={styles.tocToggle}
                  aria-expanded={isExpanded}
                  aria-controls={sublistId}
                  aria-label={`${isExpanded ? 'ย่อ' : 'ขยาย'}หัวข้อย่อยของ ${group.primary.label}`}
                  onClick={() => toggleGroup(group.primary.id)}
                >
                  <span className={styles.tocChevron} aria-hidden="true">⌄</span>
                </button>
              ) : null}
            </div>
            {hasChildren ? (
              <div id={sublistId} className={styles.tocSublist} hidden={!isExpanded}>
                {group.children.map((heading) => (
                  <a className={styles.tocSecondary} href={`#${heading.id}`} key={heading.id}>
                    {heading.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
