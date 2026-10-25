import Image from "next/image";
import Link from "next/link";
import { PublicCopyProvider } from "@/components/ui/PublicCopyProvider";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText } from "@/lib/content/public-copy-registry";
import { getPublicAuthorName } from "@/lib/content/author-identity";
import { getArticleSemanticTopic } from "@/lib/content/taxonomy";
import { getArticlePath } from "@/lib/content/url";
import { getTopicFeaturedLink } from "@/lib/content/topic-navigation";
import type { Article } from "@/lib/content/types";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import { V5ArticleCard, V5Breadcrumbs, V5ContactBand, V5SectionHeading, v5Label } from "@/components/layout/v5/V5Primitives";
import { toV5Cards } from "@/components/layout/v5/article-card-data";
import { V5_TOOL_LINKS } from "@/components/layout/v5/constants";
import V5HealthHappyCountdown from "@/components/layout/v5/V5HealthHappyCountdown";
import V5LegacyBridge from "@/components/layout/v5/V5LegacyBridge";
import Website43ArticleOverview from "@/features/blog/website-43/Website43ArticleOverview";
import ArticleShareActions from "@/features/blog/website-43/ArticleShareActions";
import { ArticleEngagementProvider, ArticleEngagementSummary } from "@/features/blog/website-43/ArticleEngagement";
import { estimateArticleReadingMinutes } from "@/features/blog/website-43/articleReadingTime";
import styles from "./V5Blog.module.css";
import { renderV5ArticleBody } from "./V5ArticleBody";
import { resolveNextSteps } from "./next-step";
import NextStepCiLink from "./NextStepCiLink";

const thaiDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });
const HEALTH_HAPPY_SLUG = "aia-health-happy-describe";

type Heading = { index: number; id: string; label: string; level: number };

function Toc({ groups }: { groups: Array<{ primary: Heading; children: Heading[] }> }) {
  return (
    <ol>
      {groups.map(({ primary, children }) => (
        <li key={primary.id}>
          <a href={`#${primary.id}`}>{primary.label}</a>
          {children.length > 0 && <ol>{children.map((child) => <li key={child.id}><a href={`#${child.id}`}>{child.label}</a></li>)}</ol>}
        </li>
      ))}
    </ol>
  );
}

export default async function V5Article({ article, relatedArticles = [], allArticles = [], preview = false }: { article: Article; relatedArticles?: Article[]; allArticles?: readonly Article[]; preview?: boolean }) {
  const [copy, homeCopy, siteCopy] = await Promise.all([getPublicCopy("blog"), getPublicCopy("home"), getPublicCopy("site")]);
  const text = publicCopyText(copy);
  const homeText = publicCopyText(homeCopy);
  const siteText = publicCopyText(siteCopy);

  const qualifications = article.author?.professionalQualifications ?? [];
  const managed = qualifications.length > 0;
  const baseName = article.author ? getPublicAuthorName(article.author) : (article.authorName || text("blog.baseAuthorNameText"));
  const suffix = qualifications.map((item) => item.shortName.trim()).filter(Boolean).join(", ");
  const author = {
    name: suffix ? `${baseName}, ${suffix}` : baseName,
    role: managed ? article.author?.profileRole?.trim() || text("blog.dEFAULTAUTHORROLEText") : text("blog.dEFAULTAUTHORROLEText"),
    bio: managed ? article.author?.profileBio?.trim() || text("blog.dEFAULTAUTHORBIOText") : text("blog.dEFAULTAUTHORBIOText"),
    ctaLabel: article.author?.profileCtaLabel ?? text("blog.authorText"),
    ctaUrl: article.author?.profileCtaUrl?.startsWith("#") ? `/${article.author.profileCtaUrl}` : article.author?.profileCtaUrl ?? "/#about-ccpun",
    avatar: article.author?.profileAvatar ?? { src: "/assets/ccpun.webp", alt: text("blog.baseAuthorNameText"), width: 1200, height: 1800 },
  };

  const topic = getArticleSemanticTopic({ articleSlug: article.slug, semanticTopic: article.semanticTopic, categoryTitle: article.category, categorySlug: article.categorySlug, tags: article.tags });
  const topicName = topic?.title ?? article.category;
  const topicHref = topic ? `/blog/${topic.slug}/` : "/blog/";
  const headings: Heading[] = article.body.flatMap((item, index) => item.type === "heading" ? [{ index, id: `section-${index + 1}`, label: item.text, level: item.level }] : []);
  const headingIds = new Map(headings.map((heading) => [heading.index, heading.id]));
  const tocGroups = headings.reduce<Array<{ primary: Heading; children: Heading[] }>>((groups, heading) => {
    if (heading.level === 2 || groups.length === 0) groups.push({ primary: heading, children: [] });
    else groups[groups.length - 1].children.push(heading);
    return groups;
  }, []);
  const published = article.publishedAt ? thaiDate.format(new Date(article.publishedAt)) : null;
  const optimized = article.optimizedAt && Number.isFinite(Date.parse(article.optimizedAt)) ? thaiDate.format(new Date(article.optimizedAt)) : null;
  const readingMinutes = estimateArticleReadingMinutes(article);
  const path = getArticlePath(article);
  const relatedCards = toV5Cards(relatedArticles, copy);

  const nextSteps = resolveNextSteps(topic?.slug, article.slug).flatMap((step) => {
    if (step.kind === "tool") {
      const tool = V5_TOOL_LINKS.find((item) => item.id === step.tool)!;
      const ciLink = getTopicFeaturedLink("critical-illness-insurance");
      const body = step.tool === "ci" ? (ciLink?.description ?? homeText("home.p6")) : step.tool === "fhc" ? homeText("home.p5") : homeText("home.moneyStory.description");
      return [{ key: tool.id, href: tool.href, title: siteText(tool.navKey), body, action: v5Label(homeText("home.toolCtaAction2")), ci: step.tool === "ci", external: false }];
    }
    if (step.kind === "article") {
      const target = allArticles.find((candidate) => candidate.slug === step.slug && candidate.status === "published");
      if (!target) return [];
      return [{ key: target.slug, href: getArticlePath(target), title: target.title, body: target.excerpt, action: v5Label(text("blog.articleCategory")), ci: false, external: false }];
    }
    // LINE next step: the gold contact band directly below is the CTA, so no duplicate card.
    return [] as Array<{ key: string; href: string; title: string; body: string; action: string; ci: boolean; external: boolean }>;
  });

  return (
    <PublicCopyProvider values={copy}>
      <ArticleEngagementProvider key={article.id} articleId={article.id} disabled={preview}>
        <V5Page current={path}>
          {preview && <aside className={styles.previewBar} role="status"><div className={shell.inner} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
            <p>{text.node("blog.p2")}</p>
            <form action="/api/preview/disable/" method="post"><button type="submit" className={shell.buttonDark}>{text.node("blog.outlineButton")}</button></form>
          </div></aside>}
          <header className={`${shell.inner} ${shell.narrow} ${styles.articleHeader}`}>
            <V5Breadcrumbs label={text("blog.website43Articlearialabel")} items={[{ href: "/", label: text.node("blog.link") }, { href: "/blog/", label: text.node("blog.activeCategoryText") }, { href: topicHref, label: topicName }]} />
            <p className={styles.byline}>{text.node("blog.articleHeaderMeta")}{author.name.replaceAll("™", "")}</p>
            <h1 className={styles.articleTitle}>{article.title}</h1>
            <div className={styles.metaRow}>
              <div className={styles.metaDates}>
                {published && <span>{text.node("blog.articleDateLabel")} <time dateTime={article.publishedAt}>{published}</time></span>}
                {optimized && <span>{text.node("blog.articleDateLabel2")} <time dateTime={article.optimizedAt}>{optimized}</time></span>}
                <V5LegacyBridge><ArticleEngagementSummary readingMinutes={readingMinutes} /></V5LegacyBridge>
              </div>
              {!preview && <V5LegacyBridge className={styles.shareSlot}><ArticleShareActions origin="https://ccpun.com" path={path} title={article.title} placement="header" /></V5LegacyBridge>}
            </div>
          </header>

          {article.slug === HEALTH_HAPPY_SLUG && <V5LegacyBridge className={styles.countdownSlot}><V5HealthHappyCountdown placement="article" /></V5LegacyBridge>}

          <div className={`${shell.inner} ${styles.readingGrid}`} id={article.slug === HEALTH_HAPPY_SLUG ? "health-happy-details" : undefined}>
            {tocGroups.length > 0 && <aside className={styles.tocAside} aria-label={text("blog.website43Articlearialabel2")}>
              <p className={styles.tocTitle}>{text.node("blog.website43Articlearialabel2")}</p>
              <nav className={styles.toc} aria-label={text("blog.website43ArticleTocarialabel")}><Toc groups={tocGroups} /></nav>
            </aside>}
            <div>
              {article.featuredImage && <figure className={styles.feature}>
                <Image src={article.featuredImage.src} alt={article.featuredImage.alt} width={article.featuredImage.width} height={article.featuredImage.height} sizes="(max-width: 767px) calc(100vw - 40px), 720px" preload loading="eager" fetchPriority="high" />
                {article.featuredImage.caption && <figcaption>{article.featuredImage.caption}</figcaption>}
              </figure>}
              {tocGroups.length > 0 && <details className={styles.tocMobile}>
                <summary>{text.node("blog.website43Articlearialabel2")}<span aria-hidden="true">⌄</span></summary>
                <div className={styles.toc}><Toc groups={tocGroups} /></div>
              </details>}
              {(preview || article.status === "published") && <Website43ArticleOverview summary={article.geo?.summary} />}
              <article className={styles.prose}>{renderV5ArticleBody(article.body, headingIds, copy)}</article>
              {!preview && <V5LegacyBridge className={`${styles.bottomShare} ${styles.shareSlot}`}>
                <ArticleEngagementSummary />
                <ArticleShareActions origin="https://ccpun.com" path={path} title={article.title} placement="footer" />
              </V5LegacyBridge>}
            </div>
          </div>

          {article.faq && article.faq.length > 0 && <section id="faq" className={shell.sectionAlt}>
            <div className={`${shell.inner} ${shell.narrow}`}>
              <V5SectionHeading title={text.node("blog.website43Articletitle")} />
              <div className={styles.faqList}>
                {article.faq.map(({ question, answer }) => (
                  <details className={styles.faqItem} key={question}><summary>{question}</summary><p>{answer}</p></details>
                ))}
              </div>
            </div>
          </section>}

          <section className={shell.section}>
            <div className={`${shell.inner} ${shell.narrow}`}>
              <div className={styles.authorCard}>
                <Image src={author.avatar.src} alt={author.avatar.alt} width={author.avatar.width} height={author.avatar.height} sizes="88px" loading="lazy" />
                <div><p className={styles.authorName}>{author.name}</p><p className={styles.authorRole}>{author.role}</p></div>
                <p className={styles.authorBio}>{author.bio}</p>
                <Link className={`${shell.textLink} ${styles.authorLink}`} href={author.ctaUrl}>{v5Label(author.ctaLabel)}</Link>
              </div>
            </div>
          </section>

          {nextSteps.length > 0 && <section className={shell.section} style={{ paddingTop: 0 }} aria-label={text("blog.nextStep.eyebrow")}>
            <div className={`${shell.inner} ${shell.narrow}`}>
              <div className={styles.nextStep}>
                {nextSteps.map((step) => (
                  <div className={styles.nextCard} key={step.key}>
                    <h3>{step.ci ? <NextStepCiLink href={step.href}>{step.title}</NextStepCiLink>
                      : <Link href={step.href}>{step.title}</Link>}</h3>
                    <p>{step.body}</p>
                    <span aria-hidden="true">{step.action}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>}

          <V5ContactBand title={text.node("blog.h2")} lead={text.node("blog.lead")} cta={text.node("blog.faqCta")} analyticsLocation="blog_article" />

          {relatedCards.length > 0 && <section className={shell.section}>
            <div className={`${shell.inner} ${shell.narrow}`}>
              <h2 className={shell.h2} style={{ marginBottom: 24 }}>{text.node("blog.h22")}</h2>
              <div className={shell.cardGrid2}>
                {relatedCards.map((card) => <V5ArticleCard key={card.id} article={card} showExcerpt sizes="(max-width: 639px) calc(100vw - 40px), 500px" />)}
              </div>
            </div>
          </section>}
          <div className={`${shell.inner} ${shell.narrow}`} style={{ paddingBottom: 48 }}><p className={styles.disclaimer}>{text.node("blog.cardBody")}</p></div>
        </V5Page>
      </ArticleEngagementProvider>
    </PublicCopyProvider>
  );
}
