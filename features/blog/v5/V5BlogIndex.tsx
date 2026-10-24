import Image from "next/image";
import Link from "next/link";
import { PublicCopyProvider } from "@/components/ui/PublicCopyProvider";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import { getPublicAuthorName } from "@/lib/content/author-identity";
import { articleBelongsToPhysicalCategory } from "@/lib/content/category-registry";
import { BLOG_GROUP_MIN_ARTICLES, BLOG_START_HERE_SLUGS, type TopicLink } from "@/lib/content/topic-navigation";
import type { Article, ArticleAuthorProfile } from "@/lib/content/types";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import { V5ArticleCard, V5ContactBand, type V5CardArticle } from "@/components/layout/v5/V5Primitives";
import { newestFirst, toV5Card, toV5Cards } from "@/components/layout/v5/article-card-data";
import HealthHappyCountdown from "@/components/ui/health-happy/HealthHappyCountdown";
import V5LegacyBridge from "@/components/layout/v5/V5LegacyBridge";
import styles from "./V5Blog.module.css";
import V5BlogSearch from "./V5BlogSearch";
import V5GroupPager, { GROUP_PAGE_SIZE } from "./V5GroupPager";

type Group = { id: string; title: string; href?: string; cards: V5CardArticle[]; searchText: Map<string, string> };

function searchText(article: Article, card: V5CardArticle) {
  return `${article.title} ${article.excerpt} ${card.topic} ${(article.tags ?? []).join(" ")}`;
}

export default function V5BlogIndex({ articles, featured, topics, copy, siteCopy, author, initialQuery = "" }: {
  articles: Article[];
  featured: Article[];
  topics: TopicLink[];
  copy: PublicCopyValues;
  siteCopy?: PublicCopyValues;
  author: ArticleAuthorProfile | null;
  initialQuery?: string;
}) {
  const text = publicCopyText(copy);
  const sorted = newestFirst(articles);
  const authorSuffix = (author?.professionalQualifications ?? []).map((item) => item.shortName.trim()).filter(Boolean).join(", ");
  const authorName = author ? `${getPublicAuthorName(author)}${authorSuffix ? `, ${authorSuffix}` : ""}` : text("blog.baseAuthorNameText");

  // Version B groups: categories with ≥3 articles get their own group; the rest share "latest".
  const groups: Group[] = [];
  const grouped = new Set<string>();
  for (const topic of topics) {
    const members = sorted.filter((article) => articleBelongsToPhysicalCategory(article, { slug: topic.slug }));
    if (members.length < BLOG_GROUP_MIN_ARTICLES) continue;
    members.forEach((article) => grouped.add(article.id));
    groups.push(toGroup(topic.slug, topic.title, topic.href, members, copy));
  }
  const rest = sorted.filter((article) => !grouped.has(article.id));
  if (rest.length) groups.push(toGroup("latest", text("blog.group.latest"), undefined, rest, copy));

  const featuredCards = toV5Cards(featured.slice(0, 3), copy);
  const startHere = BLOG_START_HERE_SLUGS.map((slug) => sorted.find((article) => article.slug === slug)).filter((article): article is Article => Boolean(article))
    .map((article) => toV5Card(article, copy)).filter((card): card is V5CardArticle => Boolean(card));

  return (
    <PublicCopyProvider values={copy}>
      <V5Page current="/blog/" siteCopy={siteCopy}>
        <div id="v5-blog-scope" className={styles.searchScope}>
          <section className={styles.hero} aria-labelledby="blog-title">
            <div className={shell.inner}>
              <div className={styles.heroTop}>
                <div>
                  <h1 id="blog-title" className={shell.h1}>{text.node("blog.activeCategoryText")}</h1>
                  <p className={styles.heroLead}>{text.node("blog.website43BlogText")}</p>
                  <p className={styles.authorChip}>
                    <Image src={author?.profileAvatar?.src ?? "/assets/ccpun.webp"} alt="" width={72} height={72} sizes="36px" loading="lazy" />
                    <span>{authorName}</span>
                  </p>
                </div>
                <V5BlogSearch scopeId="v5-blog-scope" initialQuery={initialQuery} />
              </div>
              <nav className={styles.chipRow} aria-label={text("blog.website43BlogInteractivearialabel3")}>
                <ul className={shell.chips}>
                  <li><Link className={shell.chip} href="/blog/" aria-current="page">{text.node("blog.blogCategoriesText")} <span>{articles.length}</span></Link></li>
                  {topics.map((topic) => <li key={topic.slug}><Link className={shell.chip} href={topic.href}>{topic.title} <span>{topic.count}</span></Link></li>)}
                </ul>
              </nav>
            </div>
          </section>

          {featuredCards.length > 0 && <section className={shell.section} data-v5-search-hide="" aria-labelledby="v5-featured">
            <div className={shell.inner}>
              <h2 id="v5-featured" className={shell.h2} style={{ marginBottom: 24 }}>{text.node("blog.p")}</h2>
              <div className={styles.featuredGrid}>
                {featuredCards.map((card, index) => (
                  <V5ArticleCard key={card.id} article={card} className={index === 0 ? styles.featuredLead : undefined} horizontal={index > 0} priority={index === 0} showExcerpt={index === 0}
                    headingLevel={3} sizes={index === 0 ? "(max-width: 899px) calc(100vw - 40px), 640px" : "(max-width: 479px) calc(100vw - 40px), 240px"} />
                ))}
              </div>
            </div>
          </section>}

          {startHere.length > 0 && <section className={shell.sectionAlt} data-v5-search-hide="" aria-labelledby="v5-start-here">
            <div className={shell.inner}>
              <h2 id="v5-start-here" className={shell.h2} style={{ marginBottom: 24 }}>{text.node("blog.startHere.title")}</h2>
              <ol className={styles.startList}>
                {startHere.map((card, index) => (
                  <li key={card.id} className={styles.startItem}>
                    <span className={styles.startNumber} aria-hidden="true">{index + 1}</span>
                    <div><p className={styles.startTopic}>{card.topic}</p><h3 className={styles.startTitle}><Link href={card.href}>{card.title}</Link></h3></div>
                  </li>
                ))}
              </ol>
            </div>
          </section>}

          <V5LegacyBridge><div data-v5-search-hide=""><HealthHappyCountdown placement="blog" /></div></V5LegacyBridge>

          <section className={shell.section} aria-label={text("blog.website43BlogInteractiveText")}>
            <div className={shell.inner}>
              {groups.map((group) => {
                const gridId = `v5-group-${group.id}`;
                return (
                  <section key={group.id} className={styles.group} data-v5-group="" aria-labelledby={`${gridId}-title`}>
                    <div className={shell.headingRow}>
                      <h2 id={`${gridId}-title`} className={shell.h2}>{group.title} <span className={shell.count}>{text("blog.group.count").replaceAll("{0}", String(group.cards.length))}</span></h2>
                      {group.href && <Link className={shell.textLink} href={group.href}>{text.node("blog.group.viewAll")}<span className={shell.srOnly}> {group.title}</span></Link>}
                    </div>
                    <div id={gridId} className={`${shell.cardGrid} ${styles.groupGrid}`}>
                      {group.cards.map((card, index) => (
                        <div key={card.id} data-v5-search={group.searchText.get(card.id)} data-pager-hidden={index >= GROUP_PAGE_SIZE ? "" : undefined}>
                          <V5ArticleCard article={card} showExcerpt />
                        </div>
                      ))}
                    </div>
                    {group.cards.length > GROUP_PAGE_SIZE && <V5GroupPager gridId={gridId} total={group.cards.length} groupTitle={group.title} />}
                  </section>
                );
              })}
              <p className={styles.empty} data-v5-search-empty="" hidden>{text.node("blog.div")}</p>
            </div>
          </section>
        </div>
        <V5ContactBand title={text.node("blog.h2")} lead={text.node("blog.lead")} cta={text.node("blog.faqCta")} />
      </V5Page>
    </PublicCopyProvider>
  );
}

function toGroup(id: string, title: string, href: string | undefined, members: Article[], copy: PublicCopyValues): Group {
  const cards: V5CardArticle[] = [];
  const search = new Map<string, string>();
  for (const article of members) {
    const card = toV5Card(article, copy);
    if (!card) continue;
    cards.push(card);
    search.set(card.id, searchText(article, card));
  }
  return { id, title, href, cards, searchText: search };
}
