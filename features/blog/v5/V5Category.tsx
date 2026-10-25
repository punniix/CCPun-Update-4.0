import Link from "next/link";
import { PublicCopyProvider } from "@/components/ui/PublicCopyProvider";
import { getPublicCopy } from "@/lib/content/public-copy";
import { publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import type { BlogTopicHub } from "@/lib/content/taxonomy";
import { getTopicFeaturedLink, type TopicLink } from "@/lib/content/topic-navigation";
import type { Article } from "@/lib/content/types";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import { V5ArticleCard, V5Breadcrumbs, V5ContactBand } from "@/components/layout/v5/V5Primitives";
import { newestFirst, toV5Cards } from "@/components/layout/v5/article-card-data";
import { V5_TOOL_LINKS } from "@/components/layout/v5/constants";
import styles from "./V5Blog.module.css";
import { resolveHubTools } from "./next-step";

/**
 * Category / topic hub (FigCraft 03). Lists every article of the hub on the one
 * physical URL (no ?page= owner), renders the hub intro and the CI hub's
 * `featuredLink` (plan T03), and links only non-empty sibling hubs (plan T11).
 */
export default async function V5Category({ slug, title, description, hub, articles, topics, copy }: {
  slug: string;
  title: string;
  description?: string;
  hub: BlogTopicHub | null;
  articles: Article[];
  topics: TopicLink[];
  copy: PublicCopyValues;
}) {
  const text = publicCopyText(copy);
  const siteText = publicCopyText(await getPublicCopy("site"));
  const cards = toV5Cards(newestFirst(articles), copy);
  const featuredLink = getTopicFeaturedLink(slug);
  const tools = resolveHubTools(slug).map((id) => V5_TOOL_LINKS.find((tool) => tool.id === id)!).filter(Boolean);
  const path = `/blog/${slug}/`;
  const listTitle = text("blog.dynamic5").replaceAll("{0}", title);

  return (
    <PublicCopyProvider values={copy}>
      <V5Page current={path}>
        <section className={styles.categoryHero} aria-labelledby="category-title">
          <div className={shell.inner}>
            <V5Breadcrumbs label={text("blog.website43Articlearialabel")} items={[{ href: "/", label: text.node("blog.link") }, { href: "/blog/", label: text.node("blog.activeCategoryText") }, { label: title }]} />
            <div className={styles.categoryHeroGrid}>
              <h1 id="category-title" className={shell.h1}>{title}</h1>
              {description ? <p className={styles.heroLead}>{description}</p> : null}
            </div>
          </div>
        </section>

        {topics.length > 0 && <div className={styles.categoryChips}>
          <div className={shell.inner}>
            <nav className={styles.chipRow} aria-label={text("blog.website43BlogInteractivearialabel3")}>
              <ul className={shell.chips}>
                <li><Link className={shell.chip} href="/blog/">{text.node("blog.blogCategoriesText")}</Link></li>
                {topics.map((topic) => <li key={topic.slug}><Link className={shell.chip} href={topic.href} aria-current={topic.slug === slug ? "page" : undefined}>{topic.title}</Link></li>)}
              </ul>
            </nav>
          </div>
        </div>}

        {hub && hub.intro.length > 0 && <section className={shell.section} aria-labelledby={`hub-intro-${hub.slug}`}>
          <div className={`${shell.inner} ${styles.intro}`}>
            <div>
              <p className={shell.eyebrow}>{hub.eyebrow}</p>
              <h2 id={`hub-intro-${hub.slug}`} className={shell.h2}>{text("blog.category.heading").replaceAll("{title}", hub.title)}</h2>
            </div>
            <div>
              <div className={styles.introCopy}>{hub.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
              {featuredLink && <div className={styles.featuredTool}>
                <strong>{featuredLink.title}</strong>
                <p>{featuredLink.description}</p>
                <div><Link className={shell.button} href={featuredLink.href}>{featuredLink.label}</Link></div>
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
              ? <div className={shell.cardGrid}>{cards.map((card, index) => <V5ArticleCard key={card.id} article={card} showExcerpt priority={index === 0 && !(hub && hub.intro.length > 0)} />)}</div>
              : <p className={styles.empty}>{text.node("blog.div")}</p>}
            {tools.length > 0 && <div className={styles.toolsCard}>
              <div>
                <h2>{text.node("blog.topicTools.title")}</h2>
                <p>{text.node("blog.topicTools.description")}</p>
              </div>
              <div className={styles.toolsActions}>
                {tools.map((tool) => <Link key={tool.id} className={shell.buttonOutline} href={tool.href}>{siteText.node(tool.nameKey)}</Link>)}
              </div>
            </div>}
          </div>
        </section>

        <V5ContactBand title={text.node("blog.h2")} lead={text.node("blog.lead")} cta={text.node("blog.faqCta")} />
      </V5Page>
    </PublicCopyProvider>
  );
}
