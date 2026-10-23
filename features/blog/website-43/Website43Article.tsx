import { PublicCopyProvider } from "@/components/ui/PublicCopyProvider";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText } from "@/lib/content/public-copy-registry";
import Image from 'next/image';
import Link from 'next/link';
import { getPublicAuthorName } from "@/lib/content/author-identity";
import type { Article } from '@/lib/content/types';
import { getArticleSemanticTopic } from '@/lib/content/taxonomy';
import { getArticlePath } from '@/lib/content/url';
import styles from '@/components/layout/website-43/Website43.module.css';
import { SectionHeading, Website43Footer, Website43Navbar } from '@/components/layout/website-43/Website43Shared';
import { WEBSITE43_BASE as BASE } from '@/components/layout/website-43/constants';
import Website43ArticleToc from './Website43ArticleToc';
import Website43ArticleOverview from './Website43ArticleOverview';
import HealthHappyCountdown from '@/components/ui/health-happy/HealthHappyCountdown';
import { renderWebsite43ArticleBody } from './Website43ArticleBody';
import ArticleShareActions from './ArticleShareActions';
import { estimateArticleReadingMinutes } from './articleReadingTime';
import { ArticleEngagementProvider, ArticleEngagementSummary } from './ArticleEngagement';

const thaiDateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Bangkok',
});




export default async function Website43Article({ article, relatedArticles = [], preview = false }: { article: Article; relatedArticles?: Article[]; preview?: boolean }) {
  const copy = await getPublicCopy("blog");
  const copyText = publicCopyText(copy);
const DEFAULT_AUTHOR_ROLE = copyText("blog.dEFAULTAUTHORROLEText");
const DEFAULT_AUTHOR_BIO = copyText("blog.dEFAULTAUTHORBIOText");

  const professionalQualifications = article.author?.professionalQualifications ?? [];
  const managedProfile = professionalQualifications.length > 0;
  const baseAuthorName = article.author ? getPublicAuthorName(article.author) : (article.authorName || "ชนาธิป ชิตประเสริฐ");
  const qualificationSuffix = professionalQualifications.map((qualification) => qualification.shortName.trim()).filter(Boolean).join(', ');
  const author = {
    name: qualificationSuffix ? `${baseAuthorName}, ${qualificationSuffix}` : baseAuthorName,
    role: managedProfile ? article.author?.profileRole?.trim() || DEFAULT_AUTHOR_ROLE : DEFAULT_AUTHOR_ROLE,
    bio: managedProfile ? article.author?.profileBio?.trim() || DEFAULT_AUTHOR_BIO : DEFAULT_AUTHOR_BIO,
    profileCtaLabel: article.author?.profileCtaLabel ?? copyText("blog.authorText"),
    profileCtaUrl: article.author?.profileCtaUrl?.startsWith('#') ? `/${article.author.profileCtaUrl}` : article.author?.profileCtaUrl ?? '/#about-ccpun',
    avatar: article.author?.profileAvatar ?? { src: '/assets/ccpun.webp', alt: 'ชนาธิป ชิตประเสริฐ', width: 96, height: 96 },
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
  const publishedDateLabel = article.publishedAt ? thaiDateFormatter.format(new Date(article.publishedAt)) : null;
  const optimizedDateLabel = article.optimizedAt && Number.isFinite(Date.parse(article.optimizedAt))
    ? thaiDateFormatter.format(new Date(article.optimizedAt)) : null;
  const readingMinutes = estimateArticleReadingMinutes(article);
  const sharePath = getArticlePath(article);

  return (<PublicCopyProvider values={copy}><ArticleEngagementProvider key={article.id} articleId={article.id} disabled={preview}><div className={styles.root}>
      <Website43Navbar responsiveOverlay />
      <main id="main-content" tabIndex={-1}>
        {preview && <aside className={styles.section} role="status"><div className={styles.inner}>
          <p>{copyText("blog.p2")}</p><form action="/api/preview/disable/" method="post"><button type="submit" className={styles.outlineButton}>{copyText("blog.outlineButton")}</button></form>
        </div></aside>}
        <header className={styles.articleHeader}>
          <div className={styles.inner}>
            <nav className={styles.breadcrumbs} aria-label={copyText("blog.website43Articlearialabel")}>
              <Link href="/">{copyText("blog.link")}</Link> <span>›</span> <Link href={`${BASE}/blog`}>{copyText("blog.activeCategoryText")}</Link> <span>›</span> <Link href={topicHref}>{topicName}</Link>
            </nav>
            <p className={styles.articleHeaderMeta} style={{ width: 'min(1028px,100%)', margin: '24px auto 0' }}>{copyText("blog.articleHeaderMeta")}{author.name.replaceAll('™', '')}</p>
            <h1 className={styles.articleHeadline} style={{ textWrap: 'balance', marginTop: 12 }}>{article.title}</h1>
            <div className={styles.articleMetaRow}>
              <div className={styles.articleMetaGroup}>
                <p className={styles.articleHeaderMeta}>
                  {publishedDateLabel && <span><span className={styles.articleDateLabel}>{copyText("blog.articleDateLabel")}</span> <time dateTime={article.publishedAt}>{publishedDateLabel}</time></span>}
                  {optimizedDateLabel && <span className={styles.articleUpdatedDate}><span className={styles.articleDateLabel}>{copyText("blog.articleDateLabel2")}</span> <time dateTime={article.optimizedAt}>{optimizedDateLabel}</time></span>}
                </p>
                <ArticleEngagementSummary readingMinutes={readingMinutes} />
              </div>
              {!preview && <ArticleShareActions origin={"https://ccpun.com"} path={sharePath} title={article.title} placement="header" />}
            </div>
          </div>
        </header>

        {article.slug === 'aia-health-happy-describe' && <HealthHappyCountdown placement="article" />}
        <section className={styles.articleReadingWrap} id={article.slug === 'aia-health-happy-describe' ? 'health-happy-details' : undefined}>
          <div className={styles.articleReadingGrid}>
            {tocGroups.length > 0 && (
              <aside className={styles.toc} aria-label={copyText("blog.website43Articlearialabel2")}>
                <details className={styles.tocDisclosure} open>
                  <summary>{copyText("blog.website43Articlearialabel2")}<svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="m3 5 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
                  <Website43ArticleToc groups={tocGroups} />
                </details>
              </aside>
            )}
            <div className={styles.articleMainColumn}>
              {article.featuredImage && (
                <figure className={styles.articleInlineFigure}>
                  <Image
                    className={styles.articleFeature}
                    src={article.featuredImage.src}
                    alt={article.featuredImage.alt}
                    width={article.featuredImage.width}
                    height={article.featuredImage.height}
                    sizes="(max-width: 767px) calc(100vw - 48px), 720px"
                    priority
                  />
                  {article.featuredImage.caption && <figcaption>{article.featuredImage.caption}</figcaption>}
                </figure>
              )}
              {tocGroups.length > 0 && (
                <details className={styles.tocMobile}>
                  <summary>{copyText("blog.website43Articlearialabel2")}<svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="m3 5 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
                  <div className={styles.tocMobileList}>
                    <Website43ArticleToc groups={tocGroups} />
                  </div>
                </details>
              )}
              {(preview || article.status === 'published') && <Website43ArticleOverview summary={article.geo?.summary} />}
              <article className={styles.prose}>{renderWebsite43ArticleBody(article.body, headingIds, copy)}</article>
              {!preview && <div className={styles.articleBottomShare}>
                <ArticleEngagementSummary />
                <ArticleShareActions origin={"https://ccpun.com"} path={sharePath} title={article.title} placement="footer" />
              </div>}
            </div>
          </div>
        </section>

        {article.faq && article.faq.length > 0 && (
          <section id="faq" className={`${styles.section} ${styles.sectionBottomLarge}`}>
            <div className={`${styles.inner} ${styles.articleSupportInner}`}>
              <SectionHeading eyebrow={copyText("blog.website43Articleeyebrow")} title={copyText("blog.website43Articletitle")} />
              <div className={styles.faqList}>
                {article.faq.map(({ question, answer }) => (
                  <details className={styles.faqItem} key={question}>
                    <summary className={styles.faqSummary}><span>{question}</span><span className={styles.faqIcon} aria-hidden="true">+</span></summary>
                    <p className={styles.faqAnswer} style={{ whiteSpace: 'pre-line' }}>{answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className={styles.section}>
          <div className={`${styles.inner} ${styles.articleSupportInner}`}>
            <div className={styles.authorCard}>
              {author.avatar && <Image className={styles.authorAvatar} src={author.avatar.src} alt={author.avatar.alt} width={author.avatar.width} height={author.avatar.height} sizes="(max-width: 639px) 72px, 96px" />}
              <div className={styles.authorIdentity}>
                <strong className={styles.authorName}>{author.name}</strong>
                {author.role && <span className={styles.authorRole}>{author.role}</span>}
              </div>
              {author.bio && <p className={styles.authorBio}>{author.bio}</p>}
              {author.profileCtaUrl && <Link className={styles.authorLink} href={author.profileCtaUrl}>{author.profileCtaLabel} →</Link>}
            </div>
          </div>
        </section>

        <section className={`${styles.sectionDeep} ${styles.articlePlanCtaSection}`}>
          <div className={`${styles.inner} ${styles.articleSupportInner}`}>
            <h2 className={styles.h2}>{copyText("blog.h2")}</h2>
            <p className={styles.lead} style={{ color: '#faf9f9' }}>{copyText("blog.lead")}</p>
            <a className={styles.faqCta} href="https://lin.ee/tqLCs4f" target="_blank" rel="noopener noreferrer" data-analytics-surface="blog" data-analytics-location="blog_article">{copyText("blog.faqCta")}</a>
          </div>
        </section>

        {relatedArticles.length > 0 && (
          <section className={`${styles.sectionDeep} ${styles.articleRelatedSection}`}>
            <div className={`${styles.inner} ${styles.articleSupportInner}`}>
              <h2 className={styles.h2}>{copyText("blog.h22")}</h2>
              <div className={styles.relatedGrid}>
                {relatedArticles.slice(0, 2).map((candidate) => {
                  const candidateTopic = getArticleSemanticTopic({ articleSlug: candidate.slug, semanticTopic: candidate.semanticTopic, categoryTitle: candidate.category, categorySlug: candidate.categorySlug, tags: candidate.tags });
                  const href = `${BASE}${getArticlePath(candidate)}`;
                  return (
                    <Link className={styles.articleCard} href={href} key={candidate.slug}>
                      {candidate.featuredImage && <Image className={styles.articleImage} src={candidate.featuredImage.src} alt="" width={candidate.featuredImage.width} height={candidate.featuredImage.height} sizes="(max-width: 639px) calc(100vw - 48px), 520px" loading="lazy" />}
                      <div className={styles.articleCardBody}>
                        <span className={styles.articleCategory}>{candidateTopic?.title ?? candidate.category}</span>
                        <h3 className={styles.articleTitle} style={{ textWrap: 'pretty' }}>{candidate.title}</h3>
                        <p className={styles.articleExcerpt} style={{ textWrap: 'pretty' }}>{candidate.excerpt.trim() || candidate.title}</p>
                        <span className={styles.articleCategory}>{copyText("blog.articleCategory")}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}
        <section className={styles.section}><div className={`${styles.inner} ${styles.articleSupportInner}`}><p className={styles.cardBody}>{copyText("blog.cardBody")}</p></div></section>
      </main>
      <Website43Footer />
    </div></ArticleEngagementProvider></PublicCopyProvider>);
}
