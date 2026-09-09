import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Article, ArticleBlock, ArticleRichText } from '@/lib/content/types';
import { getArticleSemanticTopic } from '@/lib/content/taxonomy';
import { getArticlePath } from '@/lib/content/url';
import styles from '@/components/layout/website-43/Website43.module.css';
import { SectionHeading, Website43Footer, Website43Navbar } from '@/components/layout/website-43/Website43Shared';
import { WEBSITE43_BASE as BASE } from '@/components/layout/website-43/constants';

const thaiDateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Bangkok',
});

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

function renderBody(items: ArticleBlock[], headingIds: Map<number, string>) {
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

export default function Website43Article({ article, relatedArticles = [], preview = false }: { article: Article; relatedArticles?: Article[]; preview?: boolean }) {
  const author = {
    name: article.author?.profileName ?? article.author?.name ?? article.authorName ?? 'ชนาธิป ชิตประเสริฐ',
    role: article.author?.profileRole ?? 'ที่ปรึกษาการเงินส่วนบุคคล',
    bio: article.author?.profileBio ?? 'ผู้แนะนำการลงทุนและตัวแทนประกันชีวิต เน้นอธิบายจากเป้าหมายและสถานการณ์จริง เพื่อช่วยให้เห็นภาพรวมก่อนตัดสินใจ',
    profileCtaLabel: article.author?.profileCtaLabel ?? 'รู้จัก CCPun เพิ่มเติม',
    profileCtaUrl: article.author?.profileCtaUrl?.startsWith('#') ? `/${article.author.profileCtaUrl}` : article.author?.profileCtaUrl ?? '/#about-ccpun',
    avatar: article.author?.profileAvatar ?? { src: '/assets/pun.jpg', alt: 'ชนาธิป ชิตประเสริฐ', width: 96, height: 96 },
  };
  const semanticTopic = getArticleSemanticTopic({
    articleSlug: article.slug,
    semanticTopic: article.semanticTopic,
    categoryTitle: article.category,
    categorySlug: article.categorySlug,
    tags: article.tags,
  });
  const topicName = semanticTopic?.title ?? article.category;
  const topicHref = semanticTopic ? `/blog/${semanticTopic.slug}/` : '/blog/';
  const headings = article.body.flatMap((item, index) => item.type === 'heading'
    ? [{ index, id: `section-${index + 1}`, label: item.text, level: item.level }]
    : []);
  const headingIds = new Map(headings.map((heading) => [heading.index, heading.id]));
  const tocGroups = headings.reduce<Array<{ primary: (typeof headings)[number]; children: Array<(typeof headings)[number]> }>>((groups, heading) => {
    if (heading.level === 2 || groups.length === 0) groups.push({ primary: heading, children: [] });
    else groups[groups.length - 1].children.push(heading);
    return groups;
  }, []);

  return (
    <div className={styles.root}>
      <Website43Navbar responsiveOverlay />
      <main id="main-content" tabIndex={-1}>
        {preview && <aside className={styles.section} role="status"><div className={styles.inner}>
          <p>ฉบับร่าง Preview · noindex</p><form action="/api/preview/disable/" method="post"><button type="submit" className={styles.outlineButton}>ปิด Preview</button></form>
        </div></aside>}
        <header className={styles.articleHeader}>
          <div className={styles.inner}>
            <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
              <Link href="/">หน้าแรก</Link> <span>›</span> <Link href={`${BASE}/blog`}>บทความ</Link> <span>›</span> <Link href={topicHref}>{topicName}</Link>
            </nav>
            <h1 className={styles.articleHeadline}>{article.title}</h1>
            <p className={styles.articleHeaderMeta}>
              {article.publishedAt ? `เผยแพร่เมื่อ ${thaiDateFormatter.format(new Date(article.publishedAt))} · ` : ''}
              {`อัปเดตล่าสุด ${thaiDateFormatter.format(new Date(article.updatedAt))}`}
            </p>
            {article.featuredImage && (
              <figure className={styles.articleInlineFigure}>
              <Image
                className={styles.articleFeature}
                src={article.featuredImage.src}
                alt={article.featuredImage.alt}
                width={article.featuredImage.width}
                height={article.featuredImage.height}
                sizes="(max-width: 767px) calc(100vw - 48px), 1100px"
                priority
              />
              {article.featuredImage.caption && <figcaption>{article.featuredImage.caption}</figcaption>}
              </figure>
            )}
          </div>
        </header>

        <section className={styles.articleReadingWrap}>
          <div className={styles.articleReadingGrid}>
            {headings.length > 0 && (
              <aside className={styles.toc} aria-label="หัวข้อเนื้อหา">
                <strong>หัวข้อเนื้อหา</strong>
                <div className={styles.tocList}>
                  {tocGroups.map((group) => (
                    <div className={styles.tocGroup} key={group.primary.id}>
                      <a className={styles.tocPrimary} href={`#${group.primary.id}`}><span aria-hidden="true" />{group.primary.label}</a>
                      {group.children.length > 0 && <div className={styles.tocSublist}>{group.children.map((heading) => <a className={styles.tocSecondary} href={`#${heading.id}`} key={heading.id}>{heading.label}</a>)}</div>}
                    </div>
                  ))}
                </div>
              </aside>
            )}
            {headings.length > 0 && (
              <details className={styles.tocMobile}>
                <summary>หัวข้อเนื้อหา</summary>
                <div className={styles.tocMobileList}>
                  {tocGroups.map((group) => (
                    <div className={styles.tocGroup} key={group.primary.id}>
                      <a className={styles.tocPrimary} href={`#${group.primary.id}`}><span aria-hidden="true" />{group.primary.label}</a>
                      {group.children.length > 0 && <div className={styles.tocSublist}>{group.children.map((heading) => <a className={styles.tocSecondary} href={`#${heading.id}`} key={heading.id}>{heading.label}</a>)}</div>}
                    </div>
                  ))}
                </div>
              </details>
            )}
            <article className={styles.prose}>{renderBody(article.body, headingIds)}</article>
          </div>
        </section>

        {article.sources && article.sources.length > 0 && (
          <section className={styles.section}>
            <div className={styles.inner}>
              <h2 className={styles.h2}>แหล่งอ้างอิง</h2>
              <ul className={styles.articleSources}>
                {article.sources.map((source, index) => <li key={`${source.label}-${index}`}>{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a> : source.label}</li>)}
              </ul>
            </div>
          </section>
        )}

        {article.faq && article.faq.length > 0 && (
          <section id="faq" className={`${styles.section} ${styles.sectionBottomLarge}`}>
            <div className={styles.inner}>
              <SectionHeading eyebrow="คำถามที่พบบ่อย" title="คำถามเกี่ยวกับบทความนี้" />
              <div className={styles.faqList}>
                {article.faq.map(({ question, answer }) => (
                  <details className={styles.faqItem} key={question}>
                    <summary className={styles.faqSummary}><span>{question}</span><span className={styles.faqIcon} aria-hidden="true">+</span></summary>
                    <p className={styles.faqAnswer}>{answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.inner}>
            <div className={styles.authorCard}>
              <Image className={styles.authorAvatar} src={author.avatar.src} alt={author.avatar.alt} width={author.avatar.width} height={author.avatar.height} sizes="(max-width: 639px) 72px, 96px" />
              <div className={styles.authorIdentity}>
                <strong className={styles.authorName}>{author.name}</strong>
                <span className={styles.authorRole}>{author.role}</span>
              </div>
              <p className={styles.authorBio}>{author.bio}</p>
              <Link className={styles.authorLink} href={author.profileCtaUrl}>{author.profileCtaLabel} →</Link>
            </div>
          </div>
        </section>

        <section className={`${styles.sectionDeep} ${styles.sectionTopLarge} ${styles.sectionBottomLarge}`}>
          <div className={styles.inner}>
            <h2 className={styles.h2}>อยากจัดลำดับแผนให้เหมาะกับชีวิตคุณ?</h2>
            <p className={styles.lead} style={{ color: '#faf9f9' }}>เตรียมข้อมูลรายได้ รายจ่าย หนี้ และเป้าหมาย แล้วคุยกันแบบเห็นภาพรวม</p>
            <a className={styles.faqCta} href="https://lin.ee/tqLCs4f" target="_blank" rel="noopener noreferrer" data-analytics-surface="blog" data-analytics-location="blog_article">ปรึกษากับ CCPun</a>
          </div>
        </section>

        {relatedArticles.length > 0 && (
          <section className={`${styles.sectionDeep} ${styles.sectionTopLarge} ${styles.sectionBottomLarge}`}>
            <div className={styles.inner}>
              <h2 className={styles.h2}>อ่านต่อ</h2>
              <div className={styles.relatedGrid}>
                {relatedArticles.slice(0, 2).map((candidate) => {
                  const candidateTopic = getArticleSemanticTopic({ articleSlug: candidate.slug, semanticTopic: candidate.semanticTopic, categoryTitle: candidate.category, categorySlug: candidate.categorySlug, tags: candidate.tags });
                  const href = `${BASE}${getArticlePath(candidate)}`;
                  return (
                    <Link className={styles.articleCard} href={href} key={candidate.slug}>
                      {candidate.featuredImage && <Image className={styles.articleImage} src={candidate.featuredImage.src} alt="" width={candidate.featuredImage.width} height={candidate.featuredImage.height} sizes="(max-width: 639px) calc(100vw - 48px), 520px" loading="lazy" />}
                      <div className={styles.articleCardBody}>
                        <span className={styles.articleCategory}>{candidateTopic?.title ?? candidate.category}</span>
                        <h3 className={styles.articleTitle}>{candidate.title}</h3>
                        <p className={styles.articleExcerpt}>{candidate.excerpt.trim() || candidate.title}</p>
                        <span className={styles.articleCategory}>อ่านบทความ →</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}
        <section className={styles.section}><div className={styles.inner}><p className={styles.cardBody}>บทความนี้จัดทำเพื่อให้ข้อมูลทั่วไป ผลิตภัณฑ์ประกันไม่ใช่เงินฝาก และการลงทุนมีความเสี่ยง ควรศึกษาความคุ้มครอง เงื่อนไข ข้อยกเว้น และความเหมาะสมก่อนตัดสินใจ</p></div></section>
      </main>
      <Website43Footer />
    </div>
  );
}
