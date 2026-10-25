import Image from "next/image";
import Link from "next/link";
import { getPublicCopy } from "@/lib/content/public-copy";
import { getHomeCopyFaqs, publicCopyText, type PublicCopyValues } from "@/lib/content/public-copy-registry";
import { v5AdvisorProfile, v5Partners } from "@/components/layout/v5/advisor-profile";
import { HOME_CORE_GUIDE_SLUGS } from "@/lib/content/topic-navigation";
import type { Article, ArticleAuthorProfile } from "@/lib/content/types";
import V5Page from "@/components/layout/v5/V5Page";
import shell from "@/components/layout/v5/V5.module.css";
import { V5ArticleCard, V5ContactBand, V5SectionHeading, v5Label } from "@/components/layout/v5/V5Primitives";
import { newestFirst, toV5Cards } from "@/components/layout/v5/article-card-data";
import { getPublishedArticles, getShellTopics } from "@/components/layout/v5/shell-data";
import { V5_LINE_URL, V5_TOOLS_HUB } from "@/components/layout/v5/constants";
import V5HealthHappyCountdown from "@/components/layout/v5/V5HealthHappyCountdown";
import V5LegacyBridge from "@/components/layout/v5/V5LegacyBridge";
import protectionGapIcon from "../../../public/assets/website-43/icon-protection-gap.svg";
import taxIcon from "../../../public/assets/website-43/icon-tax.svg";
import investmentRiskIcon from "../../../public/assets/website-43/icon-investment-risk.svg";
import styles from "./V5Home.module.css";

async function readArticles(): Promise<Article[]> {
  try { return await getPublishedArticles(); } catch { return []; }
}

/**
 * v5 homepage (FigCraft 01, UAT prototype). Copy comes from the existing home/site
 * registry keys; owner-input copy stays the current live text. Adds the permanent
 * "core guides" block and topic links (internal-linking plan T01).
 */
export default async function V5Home({ authorProfile = null, copy = {}, faqs = getHomeCopyFaqs(copy), siteCopy }: { authorProfile?: ArticleAuthorProfile | null; copy?: PublicCopyValues; faqs?: readonly { question: string; answer: string }[]; siteCopy?: PublicCopyValues }) {
  const text = publicCopyText(copy);
  const [articles, topics, liveSiteCopy] = await Promise.all([readArticles(), getShellTopics(), siteCopy ? Promise.resolve(siteCopy) : getPublicCopy("site")]);
  const siteText = publicCopyText(liveSiteCopy);

  const { qualifications, primary, displayName, role, credentials } = v5AdvisorProfile(authorProfile, text);

  const pains = [
    [protectionGapIcon, text("home.painsText"), text("home.painsText2")],
    [taxIcon, text("home.painsText3"), text("home.painsText4")],
    [investmentRiskIcon, text("home.painsText5"), text("home.painsText6")],
  ] as const;
  const partners = v5Partners(text);
  const tools = [
    { href: "/blog/", title: text("home.h3"), body: text("home.p4"), action: v5Label(text("home.toolCtaAction")), label: text("home.website43Homearialabel") },
    { href: "/tools/financial-health-check/", title: text("home.h32"), body: text("home.p5"), action: v5Label(text("home.toolCtaAction2")), label: text("home.website43Homearialabel2") },
    { href: "/ci-planning/", title: text("home.h33"), body: text("home.p6"), action: v5Label(text("home.toolCtaAction2")), label: text("home.website43Homearialabel3") },
    { href: "/play/money-story/", title: siteText("site.tools.moneyStory"), body: text("home.moneyStory.description"), action: v5Label(text("home.toolCtaAction2")), label: siteText("site.tools.moneyStory") },
  ];
  const coreGuides = toV5Cards(HOME_CORE_GUIDE_SLUGS.map((slug) => articles.find((article) => article.slug === slug)).filter((article): article is Article => Boolean(article)), {});
  const latest = toV5Cards(newestFirst(articles).slice(0, 3), {});

  return (
    <V5Page current="/" siteCopy={siteCopy}>
      <section id="home" className={styles.hero} aria-labelledby="home-hero-title">
        <div className={`${shell.inner} ${styles.heroGrid}`}>
          <div>
            <h1 id="home-hero-title" className={styles.heroTitle}>{text.node("home.hero.titleBefore")}<em>{text.node("home.hero.titleEmphasis")}</em>{text.node("home.hero.titleAfter")}</h1>
            <p className={styles.heroBody}>{text.node("home.hero.eyebrow")} {text.node("home.hero.description")}</p>
            <div className={shell.buttonRow}>
              <a className={shell.button} href={V5_LINE_URL} target="_blank" rel="noopener noreferrer" data-analytics-location="home_hero">{text.node("home.contactCta")}</a>
              <Link className={shell.buttonOutline} href="#about-ccpun">{text.node("home.hero.aboutCta")}</Link>
            </div>
            <dl className={styles.credentials}>
              {credentials.map((item) => <div key={item.term + item.detail}><dt>{item.term}</dt>{item.detail ? <dd>{item.detail}</dd> : null}</div>)}
            </dl>
          </div>
          <div className={styles.portrait}>
            <Image src="/assets/website-43/home-hero-desktop.png" alt={text("home.website43Homealt")} fill preload loading="eager" fetchPriority="high" sizes="(max-width: 899px) calc(100vw - 40px), 560px" />
          </div>
        </div>
      </section>

      <V5LegacyBridge><V5HealthHappyCountdown placement="home" /></V5LegacyBridge>

      <section className={shell.section} aria-labelledby="home-pains">
        <div className={shell.inner}>
          <V5SectionHeading id="home-pains" title={text.node("home.website43Hometitle")} description={text.node("home.website43Homedescription")} />
          <div className={styles.cards3}>
            {pains.map(([icon, title, body]) => (
              <article className={styles.painCard} key={title}>
                <span className={styles.painIcon}><Image src={icon} alt="" width={24} height={24} /></span>
                <h3>{title}</h3><p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${shell.sectionAlt} ${styles.partnerStrip}`} aria-labelledby="home-partners">
        <div className={shell.inner}>
          <h2 id="home-partners" className={shell.h3}>{text.node("home.partnerLabel")}</h2>
          <ul className={styles.partners} style={{ listStyle: "none", padding: 0, margin: "24px 0 0" }}>
            {partners.map((partner) => (
              <li className={styles.partner} key={partner.name}>
                <Image src={partner.src} alt={partner.name} width={partner.width} height={partner.height} sizes="120px" loading="lazy" />
                <strong>{partner.name}</strong><span>{partner.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={shell.section} aria-labelledby="home-voices">
        <div className={shell.inner}>
          <V5SectionHeading id="home-voices" title={text.node("home.website43Hometitle2")} />
          <div className={styles.quotes}>
            <figure className={styles.quote}><blockquote>{text.node("home.blockquote")}</blockquote><figcaption>{text.node("home.cite")}</figcaption></figure>
            <figure className={styles.quote}><blockquote>{text.node("home.blockquote2")}</blockquote><figcaption>{text.node("home.cite2")}</figcaption></figure>
          </div>
        </div>
      </section>

      <section id="about-ccpun" className={shell.sectionAlt} aria-labelledby="home-about">
        <div className={`${shell.inner} ${styles.about}`}>
          <Image className={styles.aboutPortrait} src="/assets/ccpun.webp" alt={text("home.website43Homealt8")} width={1200} height={1800} sizes="(max-width: 899px) calc(100vw - 40px), 400px" loading="lazy" />
          <div>
            <V5SectionHeading id="home-about" title={text.node("home.h2")} />
            {qualifications.length > 0 && <p className={styles.aboutIdentity}><strong>{displayName}</strong><span>{role}{primary?.identifier ? text("home.advisor.qualificationPrefix") + primary.identifier : ""}</span></p>}
            <div className={styles.aboutCopy}><p>{text.node("home.p")}</p><p>{text.node("home.p2")}</p><p>{text.node("home.p3")}</p></div>
            <p className={styles.advisorNote}>{text.node("home.advisorNote")}</p>
            <div className={shell.buttonRow}>
              <a className={shell.button} href={V5_LINE_URL} target="_blank" rel="noopener noreferrer">{siteText.node("site.extra.a")}</a>
            </div>
            <p><Link className={shell.textLink} href="/about/">{text.node("home.hero.aboutCta")}</Link></p>
          </div>
        </div>
      </section>

      <section className={shell.section} data-uat-section="home-learning" aria-labelledby="home-start">
        <div className={shell.inner}>
          <V5SectionHeading id="home-start" title={text.node("home.website43Hometitle4")} description={text.node("home.website43Homedescription3")} />
          <div className={styles.tools}>
            {tools.map((tool) => (
              <div className={styles.toolCard} key={tool.href}>
                <h3><Link href={tool.href} aria-label={tool.label}>{tool.title}</Link></h3>
                <p>{tool.body}</p>
                <span aria-hidden="true">{tool.action}</span>
              </div>
            ))}
          </div>
          <p><Link className={shell.textLink} href={V5_TOOLS_HUB.href}>ดูเครื่องมือทั้งหมด</Link></p>

          {coreGuides.length > 0 && <div style={{ marginTop: 64 }} aria-labelledby="home-core-guides" role="region">
            <h2 id="home-core-guides" className={shell.h2}>{text.node("home.coreGuides.title")}</h2>
            <div className={styles.guides}>
              {coreGuides.map((card) => <V5ArticleCard key={card.id} article={card} horizontal sizes="(max-width: 479px) calc(100vw - 40px), 240px" />)}
            </div>
            {topics.length > 0 && <>
              <p className={styles.topicsLabel}>{siteText.node("site.nav.topics")}</p>
              <ul className={shell.chips}>{topics.map((topic) => <li key={topic.slug}><Link className={shell.chip} href={topic.href}>{topic.title}</Link></li>)}</ul>
            </>}
          </div>}
        </div>
      </section>

      {latest.length > 0 && <section className={shell.section} style={{ paddingTop: 0 }} aria-labelledby="home-latest">
        <div className={shell.inner}>
          <div className={shell.headingRow}>
            <h2 id="home-latest" className={shell.h2}>{text.node("home.latest.title")}</h2>
            <Link className={shell.textLink} href="/blog/">{v5Label(text("home.toolCtaAction"))}</Link>
          </div>
          <div className={shell.cardGrid}>{latest.map((card) => <V5ArticleCard key={card.id} article={card} />)}</div>
        </div>
      </section>}

      <section className={shell.sectionAlt} id="faq" data-uat-section="home-faq" aria-labelledby="home-faq-title">
        <div className={`${shell.inner} ${styles.faq}`}>
          <div>
            <V5SectionHeading id="home-faq-title" title={text.node("home.website43Hometitle5")} />
            <div className={shell.buttonRow}><a className={shell.buttonOutline} href={V5_LINE_URL} target="_blank" rel="noopener noreferrer" data-analytics-location="home_faq">{text.node("home.contactCta")}</a></div>
          </div>
          <div className={styles.faqList}>
            {faqs.map(({ question, answer }) => <details className={styles.faqItem} key={question}><summary>{question}</summary><p>{answer}</p></details>)}
          </div>
        </div>
      </section>

      <V5ContactBand analyticsSection="contact" title={text.node("home.contactBand.title")} cta={text.node("home.contactCta")} />
    </V5Page>
  );
}
