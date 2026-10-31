import Link from "next/link";
import { BLOG_COPY_DEFAULTS } from "@/lib/content/blog-copy-defaults";
import { PublicCopyProvider } from "@/components/ui/PublicCopyProvider";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import type { BlogTopicHub } from "@/lib/content/taxonomy";
import { getTopicFeaturedLink, type TopicLink } from "@/lib/content/topic-navigation";
import type { Article } from "@/lib/content/types";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import { V5ArticleCard, V5Breadcrumbs, v5CardGridSizes } from "@/components/layout/v5/V5Primitives";
import { newestFirst, toV5Cards } from "@/components/layout/v5/article-card-data";
import { V5_ACCOUNT_LINKS, V5_LINE_URL } from "@/components/layout/v5/constants";
import styles from "./V5Blog.module.css";
import V5GroupPager from "./V5GroupPager";
import { GROUP_PAGE_SIZE, GROUP_PAGE_SIZE_MOBILE } from "@/components/layout/v5/constants";
import V5CardEngagement, { V5CardMetricsProvider } from "./V5ArticleCardEngagement";
/**
 * Category / topic hub (FigCraft 03). Lists every article of the hub on the one
 * physical URL (no ?page= owner), renders the hub intro and the CI hub's
 * `featuredLink` (plan T03), and links only non-empty sibling hubs (plan T11).
 */
export default async function V5Category({ slug, title, description, hub, articles, topics, copy, totalArticleCount, categoryOwner = false }: {
    slug: string;
    title: string;
    description?: string;
    hub: BlogTopicHub | null;
    articles: Article[];
    topics: TopicLink[];
    copy: PublicCopyValues;
    totalArticleCount?: number;
    categoryOwner?: boolean;
}) {
    const text = publicCopyText(copy);
    const hubText = (suffix: string, fallback: string) => {
      const key = `blog.hub.${slug}.${suffix}`;
      return Object.hasOwn(BLOG_COPY_DEFAULTS, key) ? text(key as keyof typeof BLOG_COPY_DEFAULTS) : fallback;
    };
    const headingTitle = categoryOwner ? title : hubText("title", title);
    const headingDescription = categoryOwner ? description : hubText("description", description ?? "");
    const cards = toV5Cards(newestFirst(articles), copy);
    const featuredLink = getTopicFeaturedLink(slug);
    const path = `/blog/${slug}/`;
    const relatedTopics = topics.filter((topic) => topic.slug !== slug);
    const listTitle = text("blog.dynamic5").replaceAll("{0}", headingTitle);
    return (<PublicCopyProvider values={copy}>
      <V5Page current={path}>
        <section className={styles.categoryHero} aria-labelledby="category-title">
          <div className={shell.inner}>
            <V5Breadcrumbs label={text("blog.website43Articlearialabel")} items={[{ href: "/", label: text.node("blog.link") }, { href: "/blog/", label: text.node("blog.activeCategoryText") }, { label: headingTitle }]}/>
            <div className={styles.categoryHeroGrid}>
              <h1 id="category-title" className={shell.h1}>{headingTitle}</h1>
              {headingDescription ? <p className={styles.heroLead}>{headingDescription}</p> : null}
            </div>
              <nav className={styles.chipRow} aria-label={text("blog.website43BlogInteractivearialabel3")}>
                <ul className={shell.chips}>
                  <li><Link className={shell.chip} href="/blog/">{text.node("blog.blogCategoriesText")}{totalArticleCount !== undefined && <> <span>{totalArticleCount}</span></>}</Link></li>
                  {topics.map((topic) => <li key={topic.slug}><Link className={shell.chip} href={topic.href} aria-current={topic.slug === slug ? "page" : undefined}>{topic.title} <span>{topic.count}</span></Link></li>)}
                  {!topics.some((topic) => topic.slug === slug) && <li><span className={shell.chip} aria-current="page">{title} <span>{articles.length}</span></span></li>}
                </ul>
              </nav>
          </div>
        </section>



        {hub && hub.intro.length > 0 && <section className={shell.section} aria-labelledby={`hub-intro-${hub.slug}`}>
          <div className={`${shell.inner} ${styles.intro}`}>
            <h2 id={`hub-intro-${hub.slug}`} className={shell.h2}>{text("blog.category.heading").replaceAll("{title}", headingTitle)}</h2>
            <div>
              <div className={styles.introCopy}>{hub.intro.map((paragraph, index) => <p key={index}>{hubText(`intro${index + 1}`, paragraph)}</p>)}</div>
              {featuredLink && <div className={styles.featuredTool}>
                <strong>{hubText("featured.title", featuredLink.title)}</strong>
                <p>{hubText("featured.description", featuredLink.description)}</p>
                <div><Link className={shell.button} href={featuredLink.href}>{hubText("featured.label", featuredLink.label)}</Link></div>
              </div>}
            </div>
          </div>
        </section>}

        <section className={hub && hub.intro.length > 0 ? shell.sectionAlt : shell.section} aria-labelledby="category-articles">
          <div className={shell.inner}>
            <div className={shell.headingRow}>
              <h2 id="category-articles" className={shell.h2}>{listTitle} <span className={shell.count}>{text("blog.group.count").replaceAll("{0}", String(cards.length))}</span></h2>
            </div>
            {cards.length > 0
            ? <V5CardMetricsProvider>{<>
                <div id="v5-category-grid" className={`${shell.cardGrid} ${styles.categoryGrid}`}>
                  {cards.map((card, index) => <div key={card.id} data-pager-hidden={index >= GROUP_PAGE_SIZE ? "" : undefined}>
                    <V5ArticleCard article={card} className={styles.categoryCard} showExcerpt sizes={v5CardGridSizes(cards.length)} priority={index === 0 && !(hub && hub.intro.length > 0)} metaEnd={<V5CardEngagement articleId={card.id} title={card.title} />}/>
                  </div>)}
                </div>
                {cards.length > GROUP_PAGE_SIZE_MOBILE && <V5GroupPager gridId="v5-category-grid" total={cards.length} groupTitle={title}/>}
              </>}</V5CardMetricsProvider>
            : <p className={styles.empty}>{text.node("blog.div")}</p>}
            <div className={styles.toolsCard}>
              <div>
                <h2>{text.node(slug === "investment" ? "blog.categoryAccounts.title" : "blog.h2")}</h2>
                {slug !== "investment" && <p>{text.node("blog.lead")}</p>}
              </div>
              <div className={styles.toolsActions}>
                {slug === "investment"
            ? V5_ACCOUNT_LINKS.map((account) => <a key={account.id} className={shell.buttonOutline} href={account.href} target="_blank" rel="noopener noreferrer">{text.node(account.labelKey)}</a>)
            : <a className={shell.button} href={V5_LINE_URL} target="_blank" rel="noopener noreferrer" data-analytics-surface="blog" data-analytics-location="blog_article">{text.node("blog.faqCta")}</a>}
              </div>
            </div>
          </div>
        </section>

        {relatedTopics.length > 0 && <section className={styles.relatedCategories} aria-labelledby="category-related">
          <div className={shell.inner}>
            <h2 id="category-related">{text.node("blog.category.related")}</h2>
            <nav aria-labelledby="category-related"><ul className={shell.chips}>{relatedTopics.map((topic) => <li key={topic.slug}><Link className={shell.chip} href={topic.href}>{topic.title}</Link></li>)}</ul></nav>
          </div>
        </section>}
      </V5Page>
    </PublicCopyProvider>);
}
