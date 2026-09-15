import Image from 'next/image';
import styles from './Website43.module.css';
import { Website43Navbar } from './Website43Shared';

type Website43ToolHeroProps = {
  image: string;
  badge: string;
  line1: string;
  line2: string;
  description: string;
  ctaHref: string;
  ctaLabel?: string;
};

export default function Website43ToolHero({
  image,
  badge,
  line1,
  line2,
  description,
  ctaHref,
  ctaLabel = 'เริ่มประเมิน',
}: Website43ToolHeroProps) {
  return (
    <section className={styles.toolHero} aria-labelledby="tool-hero-title">
      <Image
        className={styles.toolHeroImage}
        src={image}
        alt=""
        aria-hidden="true"
        width={1448}
        height={1086}
        sizes="(max-width: 639px) 100vw, (max-width: 1023px) 560px, 820px"
        priority
      />
      <div className={styles.toolHeroGradient} aria-hidden="true" />
      <Website43Navbar overlay />
      <div className={styles.toolHeroCopy}>
        <span className={styles.toolBadge}>{badge}</span>
        <h1 id="tool-hero-title" className={styles.toolTitle}>
          {line1}
          <br />
          <span className={styles.toolTitleGold}>{line2}</span>
        </h1>
        <p className={styles.toolDescription}>{description}</p>
        <a className={styles.primaryButton} href={ctaHref}>{ctaLabel}</a>
      </div>
    </section>
  );
}
