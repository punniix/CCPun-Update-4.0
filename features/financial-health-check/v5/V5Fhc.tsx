import Link from 'next/link';
import { getPublicCopy } from '@/lib/content/public-copy';
import { publicCopyText, type PublicCopyValues } from '@/lib/content/public-copy-registry';
import { getFhcFaqs } from '@/lib/content/tool-copy-defaults';
import V5Page from '@/components/layout/v5/V5Page';
import shell from '@/components/layout/v5/V5.module.css';
import { V5ArticleCard, V5Breadcrumbs, V5ContactBand, V5SectionHeading } from '@/components/layout/v5/V5Primitives';
import { V5Faq, V5InfoCards, V5ToolHero, v5ToolStyles as styles } from '@/components/layout/v5/V5ToolParts';
import { toV5Cards } from '@/components/layout/v5/article-card-data';
import { getPublishedArticles } from '@/components/layout/v5/shell-data';
import { listToolGuides, TOOL_GUIDE_HUB } from '@/components/layout/v5/tool-guides';
import functionalMotion from '@/components/ui/FunctionalMotion.module.css';
import LifeCoverageWizard from '@/features/financial-health-check/components/LifeCoverageWizard';

const PYRAMID_HREF = '/blog/personal-finance/financial-pyramid/';

/**
 * v5 Financial Health Check (FigCraft 08, UAT prototype). Reuses the life-coverage wizard
 * (formulas, `fhc_landing_view` and the other events unchanged) inside the v5 frame.
 * JSON-LD matches the 4.3 page (breadcrumb, WebApplication, FAQPage).
 */
export default async function V5Fhc({ copy, siteCopy }: { copy?: PublicCopyValues; siteCopy?: PublicCopyValues } = {}) {
  const [fhcCopy, homeCopy, blogCopy, articles] = await Promise.all([
    copy ? Promise.resolve(copy) : getPublicCopy('fhc'),
    getPublicCopy('home'),
    getPublicCopy('blog'),
    getPublishedArticles().catch(() => []),
  ]);
  const t = publicCopyText(fhcCopy);
  const home = publicCopyText(homeCopy);
  const blog = publicCopyText(blogCopy);
  const site = publicCopyText(siteCopy ?? await getPublicCopy('site'));
  const faqs = getFhcFaqs(t);

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('fhc.breadcrumb.home'), item: 'https://ccpun.com/' },
      { '@type': 'ListItem', position: 2, name: t('fhc.breadcrumb.tool'), item: 'https://ccpun.com/tools/financial-health-check/' },
    ],
  };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: t('fhc.schema.name'),
    url: 'https://ccpun.com/tools/financial-health-check/',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    author: { '@type': 'Organization', name: 'CCPun Financial Advisor', url: 'https://ccpun.com' },
    description: t('fhc.schema.description'),
  };
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({ '@type': 'Question', name: faq.question, acceptedAnswer: { '@type': 'Answer', text: faq.answer } })),
  };
  const guides = toV5Cards(listToolGuides('fhc', articles), blogCopy);

  return (
    <V5Page current="/tools/financial-health-check/" siteCopy={siteCopy}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <V5ToolHero
        title={<>{t('fhc.landing.line1Text')} <span>{t('fhc.landing.line2Text')}</span></>}
        lead={t('fhc.landing.description')}
        cta={{ href: '#fhc-calculator', label: t('fhc.landing.ctaLabel') }}
        breadcrumbs={<V5Breadcrumbs label={site('site.nav.mainLabel')} items={[{ href: '/', label: t('fhc.breadcrumb.home') }, { label: t('fhc.breadcrumb.tool') }]} />}
      />

      <section id="fhc-calculator" className={`${shell.section} ${styles.calcFirst}`} aria-labelledby="fhc-calculator-heading">
        <div className={shell.inner}>
          <div className={styles.calcHeader}>
            <V5SectionHeading id="fhc-calculator-heading" title={t.node('fhc.landing.calculatorHeading.heading')} description={t.node('fhc.landing.description3')} />
          </div>
          <div className={styles.calcGrid}>
            <div className={`${styles.calcScope} ${functionalMotion.scope}`}><LifeCoverageWizard /></div>
            <aside className={styles.calcAside} aria-labelledby="fhc-module-title">
              <div className={styles.asideCard}>
                <h3 id="fhc-module-title">{t.node('fhc.intro.heading')}</h3>
                <p>{t.node('fhc.intro.description5')}</p>
                <p>{t.node('fhc.intro.description6')}</p>
                <p>
                  {t.node('fhc.intro.description7')}{' '}
                  <Link href={PYRAMID_HREF} className={styles.inlineLink}>{t.node('fhc.intro.label')}</Link>
                  {' '}{t.node('fhc.intro.description8')}{' '}
                  <Link href="/ci-planning/" className={styles.inlineLink}>{t.node('fhc.intro.label2')}</Link>
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className={shell.sectionAlt} aria-labelledby="fhc-intro-title">
        <div className={`${shell.inner} ${styles.split}`}>
          <h2 id="fhc-intro-title" className={shell.h2}>{t.node('fhc.intro.introTitle.heading')}</h2>
          <div className={styles.story}>
            <p>{t.node('fhc.intro.description')}</p>
            <p>{t.node('fhc.intro.description2')}</p>
          </div>
        </div>
      </section>

      <section className={shell.section} aria-labelledby="fhc-context-title">
        <div className={shell.inner}>
          <V5SectionHeading id="fhc-context-title" title={t.node('fhc.intro.contextTitle.heading')} />
          <V5InfoCards numbered items={[
            { title: t.node('fhc.intro.truths'), body: t.node('fhc.intro.truths2') },
            { title: t.node('fhc.intro.truths3'), body: t.node('fhc.intro.truths4') },
            { title: t.node('fhc.intro.truths5'), body: t.node('fhc.intro.truths6') },
          ]} />
        </div>
      </section>

      {guides.length > 0 && <section className={shell.sectionAlt} aria-labelledby="fhc-guides-title">
        <div className={shell.inner}>
          <div className={shell.headingRow}>
            <h2 id="fhc-guides-title" className={shell.h2}>{blog.node('blog.h22')}</h2>
            <Link className={shell.textLink} href={`/blog/${TOOL_GUIDE_HUB.fhc}/`}>{blog.node('blog.group.viewAll')}</Link>
          </div>
          <div className={shell.cardGrid}>{guides.map((card) => <V5ArticleCard key={card.id} article={card} showExcerpt />)}</div>
        </div>
      </section>}

      <section className={shell.section} aria-labelledby="fhc-faq-title">
        <div className={shell.inner}>
          <V5SectionHeading id="fhc-faq-title" title={t.node('fhc.landing.faqTitle.heading')} />
          <V5Faq items={faqs} />
          <p className={styles.note}>{t.node('fhc.landing.description5')}</p>
        </div>
      </section>

      <V5ContactBand title={home.node('home.contactBand.title')} cta={site.node('site.extra.a')} />
    </V5Page>
  );
}
