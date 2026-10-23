import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import Image from 'next/image';
import type { ReactNode } from 'react';
import type { ArticleBlock, ArticleRichText } from '@/lib/content/types';
import styles from '@/components/layout/website-43/Website43.module.css';
import { ArticleTableAccess } from './ArticleDetailAccess';

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

export function renderWebsite43ArticleBody(items: ArticleBlock[], headingIds: Map<number, string>, copy: PublicCopyValues = {}) {
  const copyText = publicCopyText(copy);

  const introEnd = items.findIndex(item => item.type !== 'paragraph');
  return items.map((item, index) => {
    const key = `article-block-${index}`;
    if (item.type === 'paragraph') return <p key={key} style={index < (introEnd < 0 ? items.length : introEnd) ? { fontSize: 19, lineHeight: 1.75, color: 'rgba(250,249,249,.9)' } : undefined}>{richContent(item)}</p>;
    if (item.type === 'heading') {
      const id = headingIds.get(index);
      return item.level === 2
        ? <h2 id={id} key={key}>{richContent(item)}</h2>
        : item.level === 3
          ? <h3 id={id} key={key}>{richContent(item)}</h3>
          : <h4 id={id} key={key}>{richContent(item)}</h4>;
    }
    if (item.type === 'bulletList') return <ul key={key}>{item.items.map((entry, itemIndex) => <li key={`${key}-${itemIndex}`}>{listItemContent(entry)}</li>)}</ul>;
    if (item.type === 'numberList') return <ol key={key}>{item.items.map((entry, itemIndex) => <li key={`${key}-${itemIndex}`}>{listItemContent(entry)}</li>)}</ol>;
    if (item.type === 'quote') return <blockquote className={styles.articleQuote} key={key}>{richContent(item)}</blockquote>;
    if (item.type === 'callout') return <aside className={styles.articleCallout} key={key}>{item.title && <strong>{item.title}</strong>}<p>{item.text}</p></aside>;
    if (item.type === 'image') {
      return (
        <figure className={styles.articleInlineFigure} key={key}>
          <Image src={item.src} alt={item.alt} width={item.width} height={item.height} sizes="(max-width: 767px) calc(100vw - 48px), 720px" loading="lazy" />
          <a href={item.src} target="_blank" rel="noopener noreferrer" className={styles.imageDetailLink}>{copyText.node("blog.imageDetailLink")}<span className="sr-only">{copyText.node("blog.span")}</span></a>
          {(item.caption || item.credit) && <figcaption>{item.caption}{item.caption && item.credit ? ' · ' : ''}{item.credit ? copyText("blog.dynamic2").replaceAll("{0}", String(item.credit)) : ''}</figcaption>}
        </figure>
      );
    }
    if (item.type === 'gallery') {
      return (
        <div className={styles.articleGallery} key={key}>
          {item.images.map((image, imageIndex) => (
            <figure key={`${key}-${imageIndex}`}>
              <Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes="(max-width: 767px) calc(100vw - 48px), 360px" loading="lazy" />
              {(image.caption || image.credit) && <figcaption>{image.caption}{image.caption && image.credit ? ' · ' : ''}{image.credit ? copyText("blog.dynamic2").replaceAll("{0}", String(image.credit)) : ''}</figcaption>}
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
      return <a className={styles.articleDownload} href={item.url} target="_blank" rel="noopener noreferrer" key={key}><strong>{item.title}</strong>{item.description && <span>{item.description}</span>}<span>{copyText.node("blog.span2")}{item.size ? ` (${(item.size / 1048576).toFixed(1)} MB)` : ''}</span></a>;
    }
    if (item.type === 'details') {
      return <details className={styles.articleDetails} key={key}><summary>{item.summary}</summary><p>{item.text}</p></details>;
    }
    if (item.type === 'table') {
      const columnCount = item.rows.reduce((count, row) => Math.max(count, row.length), item.headers.length);
      return (
        <ArticleTableAccess key={key} stickyFirstColumn={columnCount >= 3} columnCount={columnCount}>
          <table className={styles.articleTable}>
            {item.headers.length > 0 && <thead><tr>{item.headers.map((header, cellIndex) => <th scope="col" key={`${key}-header-${cellIndex}`}>{header}</th>)}</tr></thead>}
            <tbody>{item.rows.map((row, rowIndex) => <tr key={`${key}-row-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${key}-${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </ArticleTableAccess>
      );
    }
    // Keep legacy Checklist data in Sanity Draft for future membership workflows,
    // but do not render a progress-oriented block for anonymous article readers.
    if (item.type === 'divider') return <hr className={styles.articleDivider} key={key} />;

    const exhaustive: never = item;
    return exhaustive;
  });
}
