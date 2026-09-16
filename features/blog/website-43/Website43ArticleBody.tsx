import Image from 'next/image';
import type { ReactNode } from 'react';
import type { ArticleBlock, ArticleRichText } from '@/lib/content/types';
import styles from '@/components/layout/website-43/Website43.module.css';

function richContent(content: ArticleRichText) {
  const segments = content.segments?.length ? content.segments : [{ text: content.text }];
  return segments.map((segment, index) => {
    let node: ReactNode = segment.text;
    if (segment.strong) node = <strong>{node}</strong>;
    if (segment.emphasis) node = <em>{node}</em>;
    if (segment.href) {
      const newTab = segment.openInNewTab || (/^https?:\/\//.test(segment.href) && !segment.href.startsWith('https://ccpun.com/'));
      const rel = [newTab ? 'noopener noreferrer' : '', segment.nofollow ? 'nofollow' : '', segment.sponsored ? 'sponsored' : '']
        .filter(Boolean)
        .join(' ');
      node = <a href={segment.href} target={newTab ? '_blank' : undefined} rel={rel || undefined}>{node}</a>;
    }
    return <span key={`${segment.text}-${index}`}>{node}</span>;
  });
}

function listItemContent(item: string | ArticleRichText) {
  return typeof item === 'string' ? item : richContent(item);
}

export function renderWebsite43ArticleBody(items: ArticleBlock[], headingIds: Map<number, string>) {
  return items.map((item, index) => {
    const key = `article-block-${index}`;
    if (item.type === 'paragraph') return <p key={key}>{richContent(item)}</p>;
    if (item.type === 'heading') {
      const id = headingIds.get(index);
      return item.level === 2
        ? <h2 id={id} key={key}>{richContent(item)}</h2>
        : <h3 id={id} key={key}>{richContent(item)}</h3>;
    }
    if (item.type === 'bulletList') return <ul key={key}>{item.items.map((entry, itemIndex) => <li key={`${key}-${itemIndex}`}>{listItemContent(entry)}</li>)}</ul>;
    if (item.type === 'numberList') return <ol key={key}>{item.items.map((entry, itemIndex) => <li key={`${key}-${itemIndex}`}>{listItemContent(entry)}</li>)}</ol>;
    if (item.type === 'quote') return <blockquote className={styles.articleQuote} key={key}>{richContent(item)}</blockquote>;
    if (item.type === 'callout') return <aside className={styles.articleCallout} key={key}>{item.title && <strong>{item.title}</strong>}<p>{item.text}</p></aside>;
    if (item.type === 'image') {
      return (
        <figure className={styles.articleInlineFigure} key={key}>
          <Image src={item.src} alt={item.alt} width={item.width} height={item.height} sizes="(max-width: 767px) calc(100vw - 48px), 720px" loading="lazy" />
          {(item.caption || item.credit) && <figcaption>{item.caption}{item.caption && item.credit ? " · " : ""}{item.credit ? `เครดิต: ${item.credit}` : ""}</figcaption>}
        </figure>
      );
    }
    if (item.type === 'gallery') {
      return (
        <div className={styles.articleGallery} key={key}>
          {item.images.map((image, imageIndex) => (
            <figure key={`${key}-${imageIndex}`}>
              <Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes="(max-width: 767px) calc(100vw - 48px), 360px" loading="lazy" />
              {(image.caption || image.credit) && <figcaption>{image.caption}{image.caption && image.credit ? " · " : ""}{image.credit ? `เครดิต: ${image.credit}` : ""}</figcaption>}
            </figure>
          ))}
        </div>
      );
    }
    if (item.type === 'cta') {
      const newTab = item.openInNewTab || (/^https?:\/\//.test(item.url) && !item.url.startsWith('https://ccpun.com/'));
      return <a className={item.style === 'primary' ? styles.primaryButton : styles.outlineButton} href={item.url} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined} key={key}>{item.label}</a>;
    }
    if (item.type === 'pdf') {
      return <a className={styles.articleDownload} href={item.url} target="_blank" rel="noopener noreferrer" key={key}><strong>{item.title}</strong>{item.description && <span>{item.description}</span>}<span>เปิดไฟล์ PDF{item.size ? ` (${(item.size / 1048576).toFixed(1)} MB)` : ""}</span></a>;
    }
    if (item.type === 'details') {
      return <details className={styles.articleDetails} key={key}><summary>{item.summary}</summary><p>{item.text}</p></details>;
    }
    if (item.type === 'table') {
      return (
        <div className={styles.articleTableWrap} key={key}>
          <table className={styles.articleTable}>
            {item.headers.length > 0 && <thead><tr>{item.headers.map((header, cellIndex) => <th key={`${key}-header-${cellIndex}`}>{header}</th>)}</tr></thead>}
            <tbody>{item.rows.map((row, rowIndex) => <tr key={`${key}-row-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${key}-${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    }
    return <hr className={styles.articleDivider} key={key} />;
  });
}
