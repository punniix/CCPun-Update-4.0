import Image from "next/image";
import type { ReactNode } from "react";
import type { ArticleBlock, ArticleRichText } from "@/lib/content/types";

function headingId(index: number) {
  return `section-${index + 1}`;
}

export function ArticleTableOfContents({ blocks }: { blocks: ArticleBlock[] }) {
  const headings = blocks.flatMap((block, index) => block.type === "heading" && block.level === 2
    ? [{ id: headingId(index), label: block.text }]
    : []);
  if (headings.length < 2) return null;
  return (
    <nav aria-labelledby="article-toc-title" className="my-8 rounded-2xl border border-border/40 bg-white/[0.03] p-5 md:p-6">
      <h2 id="article-toc-title" className="mb-3 text-lg font-semibold text-foreground">สารบัญบทความ</h2>
      <ol className="space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
        {headings.map((heading) => <li key={heading.id}><a href={`#${heading.id}`} className="citation-link">{heading.label}</a></li>)}
      </ol>
    </nav>
  );
}

function RichText({ value }: { value: string | ArticleRichText }) {
  const rich = typeof value === "string" ? { text: value } : value;
  if (!rich.segments?.length) return <>{rich.text}</>;

  return (
    <>
      {rich.segments.map((segment, index) => {
        let content: ReactNode = segment.text;
        if (segment.strong) content = <strong>{content}</strong>;
        if (segment.emphasis) content = <em>{content}</em>;
        if (segment.href) {
          const external = /^https?:\/\//.test(segment.href) && !segment.href.startsWith("https://ccpun.com/");
          const newTab = segment.openInNewTab || external;
          const rel = [newTab ? "noopener noreferrer" : "", segment.nofollow ? "nofollow" : "", segment.sponsored ? "sponsored" : ""].filter(Boolean).join(" ");
          content = (
            <a
              href={segment.href}
              {...(newTab ? { target: "_blank" } : {})}
              {...(rel ? { rel } : {})}
              className="citation-link"
            >
              {content}
            </a>
          );
        }
        return <span key={`${index}-${segment.text.slice(0, 24)}`}>{content}</span>;
      })}
    </>
  );
}

export default function ArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className="blog-content">
      {blocks.map((block, index) => {
        if (block.type === "paragraph") return <p key={index}><RichText value={block} /></p>;
        if (block.type === "heading") {
          return block.level === 2
            ? <h2 key={index} id={headingId(index)} className="scroll-mt-24"><RichText value={block} /></h2>
            : <h3 key={index}><RichText value={block} /></h3>;
        }
        if (block.type === "bulletList") {
          return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><RichText value={item} /></li>)}</ul>;
        }
        if (block.type === "numberList") {
          return <ol key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><RichText value={item} /></li>)}</ol>;
        }
        if (block.type === "quote") return <blockquote key={index}><p><RichText value={block} /></p></blockquote>;
        if (block.type === "image") {
          return (
            <figure key={index} className="my-8">
              <Image
                src={block.src}
                alt={block.alt}
                width={block.width}
                height={block.height}
                sizes="(max-width: 768px) 100vw, 768px"
                className="h-auto w-full rounded-2xl"
              />
              {(block.caption || block.credit) && (
                <figcaption className="mt-2 text-center text-sm text-muted-foreground">
                  {block.caption}{block.caption && block.credit ? " · " : ""}{block.credit ? `เครดิต: ${block.credit}` : ""}
                </figcaption>
              )}
            </figure>
          );
        }
        if (block.type === "gallery") {
          return (
            <div key={index} className="my-8 grid gap-4 sm:grid-cols-2">
              {block.images.map((image, imageIndex) => (
                <figure key={`${image.src}-${imageIndex}`} className="overflow-hidden rounded-2xl border border-border/30 bg-white/[0.02]">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    width={image.width}
                    height={image.height}
                    sizes="(max-width: 640px) 100vw, 384px"
                    className="h-auto w-full"
                  />
                  {(image.caption || image.credit) && (
                    <figcaption className="px-3 py-2 text-center text-sm text-muted-foreground">
                      {image.caption}{image.caption && image.credit ? " · " : ""}{image.credit ? `เครดิต: ${image.credit}` : ""}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          );
        }
        if (block.type === "cta") {
          const external = /^https?:\/\//.test(block.url) && !block.url.startsWith("https://ccpun.com/");
          const newTab = block.openInNewTab || external;
          return (
            <div key={index} className="my-8 flex justify-center">
              <a
                href={block.url}
                {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className={block.style === "primary"
                  ? "inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:brightness-105"
                  : "inline-flex min-h-12 items-center justify-center rounded-full border border-primary/50 px-6 py-3 font-semibold text-primary transition hover:bg-primary/10"}
              >
                {block.label}
              </a>
            </div>
          );
        }
        if (block.type === "pdf") {
          return (
            <aside key={index} className="my-8 rounded-2xl border border-border/40 bg-white/[0.03] p-5 md:p-6">
              <p className="mb-1 font-semibold text-foreground">{block.title}</p>
              {block.description && <p className="mb-3 text-sm text-muted-foreground">{block.description}</p>}
              <a href={block.url} target="_blank" rel="noopener noreferrer" className="citation-link font-semibold">
                เปิดไฟล์ PDF{block.size ? ` (${(block.size / 1048576).toFixed(1)} MB)` : ""}
              </a>
            </aside>
          );
        }
        if (block.type === "details") {
          return (
            <details key={index} className="my-7 rounded-2xl border border-border/40 bg-white/[0.02] p-5">
              <summary className="cursor-pointer font-semibold text-foreground">{block.summary}</summary>
              <p className="mb-0 mt-3 whitespace-pre-line text-muted-foreground">{block.text}</p>
            </details>
          );
        }
        if (block.type === "table") {
          return (
            <div key={index} className="my-8 overflow-x-auto rounded-xl border border-border/40">
              <table className="min-w-full border-collapse text-left text-sm">
                {block.headers.length > 0 && (
                  <thead className="bg-white/[0.04]">
                    <tr>{block.headers.map((header, cellIndex) => <th key={cellIndex} className="border-b border-border/40 px-4 py-3 font-semibold text-foreground">{header}</th>)}</tr>
                  </thead>
                )}
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-border/20 last:border-b-0">
                      {row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 align-top text-muted-foreground">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === "divider") return <hr key={index} className="my-8 border-border/40" />;
        if (block.type === "callout") return (
          <aside key={index} className="my-7 rounded-2xl border border-primary/20 bg-primary/[0.06] p-5 md:p-6">
            {block.title && <p className="mb-2 text-sm font-semibold text-primary">{block.title}</p>}
            <p className="mb-0 text-sm text-foreground/90 md:text-base">{block.text}</p>
          </aside>
        );
        return null;
      })}
    </div>
  );
}
