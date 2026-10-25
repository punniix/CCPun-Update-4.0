import Link from 'next/link';
import { getPublicCopy } from '@/lib/content/public-copy';
import { publicCopyText, type PublicCopyValues } from '@/lib/content/public-copy-registry';
import V5Page from '@/components/layout/v5/V5Page';
import shell from '@/components/layout/v5/V5.module.css';
import { V5ArticleCard, V5Breadcrumbs, V5SectionHeading, v5Label } from '@/components/layout/v5/V5Primitives';
import { V5Faq, V5InfoCards, V5ToolHero, v5ToolStyles as styles } from '@/components/layout/v5/V5ToolParts';
import { toV5Cards } from '@/components/layout/v5/article-card-data';
import { getPublishedArticles } from '@/components/layout/v5/shell-data';
import { listToolGuides, TOOL_GUIDE_HUB } from '@/components/layout/v5/tool-guides';
import functionalMotion from '@/components/ui/FunctionalMotion.module.css';
import CIWizard from '@/features/ci-planning/components/CIWizard';
import CiLandingViewTracker from './CiLandingViewTracker';

/**
 * v5 CI planning page (FigCraft 07, UAT prototype). The calculator, its formulas,
 * analytics and copy keys are unchanged; only the page frame and styling are v5.
 * JSON-LD (breadcrumb, WebApplication, FAQPage) is byte-equivalent to the 4.3 page.
 */
export default async function V5CiPlanning({ copy, siteCopy }: { copy?: PublicCopyValues; siteCopy?: PublicCopyValues } = {}) {
  const [ciCopy, blogCopy, articles] = await Promise.all([
    copy ? Promise.resolve(copy) : getPublicCopy('ci'),
    getPublicCopy('blog'),
    getPublishedArticles().catch(() => []),
  ]);
  const t = publicCopyText(ciCopy);
  const blog = publicCopyText(blogCopy);
  const site = publicCopyText(siteCopy ?? await getPublicCopy('site'));

  const faqs = [
    { question: t('ci.landing.question'), answer: t('ci.landing.answer') },
    { question: t('ci.landing.question2'), answer: t('ci.landing.answer2') },
    { question: t('ci.landing.question3'), answer: t('ci.landing.answer3') },
  ];
  const faqSchema = {
    '@type': 'FAQPage',
    '@context': 'https://schema.org',
    mainEntity: faqs.map((faq) => ({ '@type': 'Question', name: faq.question, acceptedAnswer: { '@type': 'Answer', text: faq.answer } })),
  };
  const ciPlanningSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: t('ci.landing.name3'),
    url: 'https://ccpun.com/ci-planning/',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    author: { '@type': 'Organization', name: 'CCPun Financial Advisor', url: 'https://ccpun.com' },
    description: t('ci.landing.description'),
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('ci.landing.name'), item: 'https://ccpun.com/' },
      { '@type': 'ListItem', position: 2, name: t('ci.landing.name2'), item: 'https://ccpun.com/ci-planning/' },
    ],
  };
  const guides = toV5Cards(listToolGuides('ci', articles), blogCopy);
  const hub = TOOL_GUIDE_HUB.ci;

  return (
    <V5Page current="/ci-planning/" siteCopy={siteCopy}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ciPlanningSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <CiLandingViewTracker />

      <V5ToolHero
        title={<>{t('ci.landing.line1Text')}<span>{t('ci.landing.line2Text')}</span></>}
        lead={t('ci.landing.description2')}
        cta={{ href: '#ci-calculator', label: t('ci.landing.ctaLabel') }}
        breadcrumbs={<V5Breadcrumbs label={site('site.nav.mainLabel')} items={[{ href: '/', label: t('ci.landing.name') }, { label: t('ci.landing.name2') }]} />}
      />

      <section id="ci-calculator" className={`${shell.section} ${styles.calcFirst}`} aria-labelledby="ci-calculator-title">
        <div className={shell.inner}>
          <div className={styles.calcHeader}>
            <V5SectionHeading id="ci-calculator-title" title={<>{t.node('ci.landing.calculatorTitle.heading')}{t.node('ci.landing.label')}</>} description={t.node('ci.landing.description4')} />
          </div>
          <div className={styles.calcGrid}>
            <div className={`${styles.calcScope} ${functionalMotion.scope}`}><CIWizard /></div>
            <aside className={styles.calcAside} aria-labelledby="ci-reading-title">
              <div className={styles.asideCard}>
                <h3 id="ci-reading-title">{t.node('ci.landing.readingTitle.heading')}</h3>
                <p>{t.node('ci.landing.description6')}</p>
              </div>
              <div className={styles.asideCard}><h3>{t.node('ci.landing.heading')}</h3><p>{t.node('ci.landing.description7')}</p></div>
              <div className={styles.asideCard}><h3>{t.node('ci.landing.heading2')}</h3><p>{t.node('ci.landing.description8')}</p></div>
              <div className={styles.asideCard}>
                <h3>{t.node('ci.landing.heading3')}</h3>
                <p>{t.node('ci.landing.description10')}</p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className={shell.sectionAlt} aria-labelledby="ci-problem-title">
        <div className={`${shell.inner} ${styles.split}`}>
          <h2 id="ci-problem-title" className={shell.h2}>{t.node('ci.story.problemTitle.heading')}</h2>
          <div>
            <div className={styles.story}>
              <p>{t.node('ci.story.description4')}</p>
              <p>{t.node('ci.story.description5')}</p>
              <p>{t.node('ci.story.description6')}</p>
            </div>
            <V5InfoCards items={[
              { title: t.node('ci.story.title'), body: t.node('ci.story.description') },
              { title: t.node('ci.story.title2'), body: t.node('ci.story.description2') },
              { title: t.node('ci.story.title3'), body: t.node('ci.story.description3') },
            ]} />
            <p className={styles.note}>{t.node('ci.story.description8')}</p>
          </div>
        </div>
      </section>

      {guides.length > 0 && <section className={shell.section} aria-labelledby="ci-guides-title">
        <div className={shell.inner}>
          <div className={shell.headingRow}>
            <h2 id="ci-guides-title" className={shell.h2}>{blog.node('blog.h22')}</h2>
            <Link className={shell.textLink} href={`/blog/${hub}/`}>{v5Label(blog('blog.group.viewAll'))}</Link>
          </div>
          <div className={shell.cardGrid}>{guides.map((card) => <V5ArticleCard key={card.id} article={card} showExcerpt />)}</div>
        </div>
      </section>}

      <section className={guides.length > 0 ? shell.sectionAlt : shell.section} aria-labelledby="ci-faq-title">
        <div className={shell.inner}>
          <V5SectionHeading id="ci-faq-title" title={t.node('ci.landing.heading4')} />
          <V5Faq items={faqs} />
          <p className={styles.note}>{t.node('ci.landing.description12')}</p>
          <div className={styles.badgeRow}>
            <p className={styles.note} style={{ marginTop: 0 }}>{t.node('ci.landing.description13')}</p>
            <a href="https://www.toryod.co/projects/35d2877e-e97a-45ee-a6df-aefa5e09e2b3-ccpun-s-ci-planning" target="_blank" rel="noopener" aria-label={t('ci.landing.ariaLabel')}>
              {/* eslint-disable-next-line @next/next/no-img-element -- TorYod badge is a vendor-hosted SVG that must remain external. */}
              <img src="https://www.toryod.co/badge/35d2877e-e97a-45ee-a6df-aefa5e09e2b3" alt={t('ci.landing.alt')} width="240" height="54" loading="lazy" decoding="async" />
            </a>
          </div>
        </div>
      </section>
    </V5Page>
  );
}
