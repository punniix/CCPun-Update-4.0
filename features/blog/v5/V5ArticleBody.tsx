import Image from "next/image";
import type { ReactNode } from "react";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import type { ArticleBlock, ArticleRichText } from "@/lib/content/types";
import { articleFontSizeStyle } from "@/lib/content/article-font-size";
import { ArticleTableAccess } from "@/features/blog/website-43/ArticleDetailAccess";
import V5LegacyBridge from "@/components/layout/v5/V5LegacyBridge";
import styles from "./V5Blog.module.css";
import shell from "@/components/layout/v5/V5.module.css";
import { normalizeInternalHref } from "./internal-links";

function linkProps(href: string, openInNewTab?: boolean, nofollow?: boolean, sponsored?: boolean) {
  const normalized = normalizeInternalHref(href);
  const internal = normalized.startsWith("/") && !normalized.startsWith("//");
  const newTab = Boolean(openInNewTab) || !internal;
  const rel = [newTab ? "noopener noreferrer" : "", nofollow ? "nofollow" : "", sponsored ? "sponsored" : ""].filter(Boolean).join(" ");
  return { href: normalized, target: newTab ? "_blank" : undefined, rel: rel || undefined };
}

function richContent(content: ArticleRichText) {
  const segments = content.segments?.length ? content.segments : [{ text: content.text }];
  return segments.map((segment, index) => {
    let node: ReactNode = segment.text;
    if (segment.strong) node = <strong>{node}</strong>;
    if (segment.emphasis) node = <em>{node}</em>;
    if (segment.href) node = <a {...linkProps(segment.href, segment.openInNewTab, segment.nofollow, segment.sponsored)}>{node}</a>;
    return <span key={`${segment.text}-${index}`} style={articleFontSizeStyle(segment.size)}>{node}</span>;
  });
}

const listItem = (item: string | ArticleRichText) => typeof item === "string" ? item : richContent(item);

/** v5 Portable Text renderer: same block coverage as Website 4.3, theme-aware, T09 link hygiene. */
export function renderV5ArticleBody(items: ArticleBlock[], headingIds: Map<number, string>, copy: PublicCopyValues = {}) {
  const text = publicCopyText(copy);
  const introEnd = items.findIndex((item) => item.type !== "paragraph");
  return items.map((item, index) => {
    const key = `block-${index}`;
    switch (item.type) {
      case "paragraph": return <p key={key} className={index < (introEnd < 0 ? items.length : introEnd) ? styles.introParagraph : undefined}>{richContent(item)}</p>;
      case "heading": {
        const id = headingIds.get(index);
        return item.level === 2 ? <h2 id={id} key={key}>{richContent(item)}</h2> : item.level === 3 ? <h3 id={id} key={key}>{richContent(item)}</h3> : <h4 id={id} key={key}>{richContent(item)}</h4>;
      }
      case "bulletList": return <ul key={key}>{item.items.map((entry, i) => <li key={i}>{listItem(entry)}</li>)}</ul>;
      case "numberList": return <ol key={key}>{item.items.map((entry, i) => <li key={i}>{listItem(entry)}</li>)}</ol>;
      case "quote": return <blockquote className={styles.quote} key={key}>{richContent(item)}</blockquote>;
      case "callout": return <aside className={styles.callout} key={key}>{item.title && <strong>{item.title}</strong>}<p>{item.text}</p></aside>;
      case "image": return (
        <figure key={key}>
          <Image src={item.src} alt={item.alt} width={item.width} height={item.height} sizes="(max-width: 767px) calc(100vw - 40px), 720px" loading="lazy" />
          <a href={item.src} target="_blank" rel="noopener noreferrer" className={styles.imageLink}>{text.node("blog.imageDetailLink")}<span className="sr-only">{text.node("blog.span")}</span></a>
          {(item.caption || item.credit) && <figcaption>{item.caption}{item.caption && item.credit ? " · " : ""}{item.credit ? text("blog.dynamic2").replaceAll("{0}", String(item.credit)) : ""}</figcaption>}
        </figure>
      );
      case "gallery": return (
        <div className={styles.gallery} key={key}>
          {item.images.map((image, i) => (
            <figure key={i}>
              <Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes="(max-width: 767px) calc(50vw - 26px), 354px" loading="lazy" />
              {(image.caption || image.credit) && <figcaption>{image.caption}{image.caption && image.credit ? " · " : ""}{image.credit ? text("blog.dynamic2").replaceAll("{0}", String(image.credit)) : ""}</figcaption>}
            </figure>
          ))}
        </div>
      );
      case "cta": {
        const props = linkProps(item.url, item.openInNewTab);
        return <p key={key}><a className={item.style === "primary" ? shell.button : shell.buttonOutline} {...props}>{item.label}</a></p>;
      }
      case "pdf": return <a className={styles.download} href={item.url} target="_blank" rel="noopener noreferrer" key={key}><strong>{item.title}</strong>{item.description && <span>{item.description}</span>}<span>{text.node("blog.span2")}{item.size ? ` (${(item.size / 1048576).toFixed(1)} MB)` : ""}</span></a>;
      case "details": return <details className={styles.detailsBlock} key={key}><summary>{item.summary}</summary><p>{item.text}</p></details>;
      case "table": {
        const columns = item.rows.reduce((count, row) => Math.max(count, row.length), item.headers.length);
        return (
          <V5LegacyBridge key={key}><ArticleTableAccess stickyFirstColumn={columns >= 3} columnCount={columns}>
            <table className={styles.table}>
              {item.headers.length > 0 && <thead><tr>{item.headers.map((header, i) => <th scope="col" key={i}>{header}</th>)}</tr></thead>}
              <tbody>{item.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>)}</tbody>
            </table>
          </ArticleTableAccess></V5LegacyBridge>
        );
      }
      case "divider": return <hr className={styles.divider} key={key} />;
      default: {
        const exhaustive: never = item;
        return exhaustive;
      }
    }
  });
}
