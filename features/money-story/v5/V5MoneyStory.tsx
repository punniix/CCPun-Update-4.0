import Link from 'next/link';
import { getPublicCopy } from '@/lib/content/public-copy';
import { publicCopyText, type PublicCopyValues } from '@/lib/content/public-copy-registry';
import { PublicCopyProvider } from '@/components/ui/PublicCopyProvider';
import V5Page from '@/components/layout/v5/V5Page';
import shell from '@/components/layout/v5/V5.module.css';
import { V5ArticleCard, V5ContactBand, V5SectionHeading } from '@/components/layout/v5/V5Primitives';
import { V5InfoCards, V5ToolHero, v5ToolStyles as styles } from '@/components/layout/v5/V5ToolParts';
import { toV5Cards } from '@/components/layout/v5/article-card-data';
import { getPublishedArticles } from '@/components/layout/v5/shell-data';
import { listToolGuides, TOOL_GUIDE_HUB } from '@/components/layout/v5/tool-guides';
import { IS_REVIEW_ENVIRONMENT } from '@/lib/deployment-environment';
import MoneyStoryGame from '@/features/money-story/components/MoneyStoryGame';
import { MONEY_STORY_PYRAMID_URL } from '@/features/money-story/config';
import gameStyles from '@/features/money-story/MoneyStory.module.css';

/** v5 Money Story (FigCraft 09, UAT prototype). The game, its engine and copy are unchanged. */
export default async function V5MoneyStory({ copy, siteCopy }: { copy?: PublicCopyValues; siteCopy?: PublicCopyValues } = {}) {
  const [storyCopy, homeCopy, blogCopy, articles] = await Promise.all([
    copy ? Promise.resolve(copy) : getPublicCopy('moneyStory'),
    getPublicCopy('home'),
    getPublicCopy('blog'),
    getPublishedArticles().catch(() => []),
  ]);
  const text = publicCopyText(storyCopy);
  const home = publicCopyText(homeCopy);
  const blog = publicCopyText(blogCopy);
  const site = publicCopyText(siteCopy ?? await getPublicCopy('site'));
  const guides = toV5Cards(listToolGuides('moneyStory', articles), blogCopy);

  return (
    <V5Page current="/play/money-story/" siteCopy={siteCopy}>
      <V5ToolHero id="money-story-title" title={text('moneyStory.title')} lead={text('moneyStory.subtitle')} />

      <section className={shell.section} aria-label={text('moneyStory.moneyStoryPagearialabel')}>
        <div className={shell.inner}>
          <div className={`${gameStyles.root} ${styles.calcScope} ${styles.msWrap}`}>
            <PublicCopyProvider values={storyCopy}><MoneyStoryGame showSeed={IS_REVIEW_ENVIRONMENT} pyramidHref={MONEY_STORY_PYRAMID_URL} /></PublicCopyProvider>
          </div>
        </div>
      </section>

      <section className={shell.sectionAlt} aria-labelledby="money-story-about">
        <div className={shell.inner}>
          <V5SectionHeading id="money-story-about" title={text.node('moneyStory.h2')} />
          <V5InfoCards items={[
            { title: text.node('moneyStory.strong'), body: text.node('moneyStory.p') },
            { title: text.node('moneyStory.strong2'), body: text.node('moneyStory.p2') },
            { title: text.node('moneyStory.strong3'), body: text.node('moneyStory.p3') },
          ]} />
          <p className={styles.note}>{text.node('moneyStory.disclaimer')}{' '}<Link href={MONEY_STORY_PYRAMID_URL}>{text.node('moneyStory.link')}</Link></p>
          <p className={styles.note} style={{ marginTop: 8 }}>{text.node('moneyStory.config.label449')}</p>
        </div>
      </section>

      {guides.length > 0 && <section className={shell.section} aria-labelledby="money-story-guides">
        <div className={shell.inner}>
          <div className={shell.headingRow}>
            <h2 id="money-story-guides" className={shell.h2}>{blog.node('blog.h22')}</h2>
            <Link className={shell.textLink} href={`/blog/${TOOL_GUIDE_HUB.moneyStory}/`}>{blog.node('blog.group.viewAll')}</Link>
          </div>
          <div className={shell.cardGrid}>{guides.map((card) => <V5ArticleCard key={card.id} article={card} showExcerpt />)}</div>
        </div>
      </section>}

      <V5ContactBand title={home.node('home.contactBand.title')} cta={site.node('site.extra.a')} />
    </V5Page>
  );
}
