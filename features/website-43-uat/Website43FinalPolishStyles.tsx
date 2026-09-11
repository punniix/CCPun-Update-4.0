import styles from './Website43.module.css';

/**
 * Final component-level visual polish after responsive UAT.
 *
 * IMPORTANT: this layer must not own horizontal page-shell alignment. Shared
 * shell centering and hero alignment belong to Website43LayoutContractStyles.
 * 600 and 1100 remain transition QA references, not independent breakpoints.
 */
export function Website43FinalPolishStyles() {
  const css = String.raw`
/* Thai copy uses native dictionary line breaking. URLs retain emergency wrap. */
.${styles.root} {
  word-break: normal;
  overflow-wrap: normal;
  line-break: auto;
  hyphens: none;
}
.${styles.root} h1,
.${styles.root} h2,
.${styles.root} h3,
.${styles.root} p,
.${styles.root} li,
.${styles.root} summary,
.${styles.root} a,
.${styles.root} button,
.${styles.root} span {
  word-break: normal;
  overflow-wrap: normal;
  line-break: auto;
  hyphens: none;
}
.${styles.articleSources} a {
  overflow-wrap: anywhere;
}

/* Blog rows intentionally start from the shared shell edge. */
.${styles.articleGrid} {
  justify-content: flex-start;
}

.${styles.categoryMenu} {
  width: 157px;
}
.${styles.categoryMenuButton},
.${styles.categoryMenuButton} > span:first-child {
  white-space: nowrap;
}

.${styles.homeHeroPicture} img {
  object-position: center center;
}

@media (min-width: 1024px) {
  /* Interpolate Home text/gradient geometry without changing its shell anchor. */
  .${styles.homeHeroGradient} {
    width: clamp(840px, calc(82.35294vw - 65.88235px), 1120px);
  }
  .${styles.homeHeroTitle} {
    width: clamp(580.556px, 52.77778vw, 760px);
  }
  .${styles.homeHeroBody} {
    width: clamp(465.972px, 42.36111vw, 610px);
  }

  /* Image safe areas are full-bleed composition decisions, not shell offsets. */
  .${styles.blogHeroImage} {
    inset: 80px 0 auto auto;
    height: calc(100% - 18px);
  }
  .${styles.toolHeroImage} {
    inset: 96px 0 auto auto;
    height: 620px;
  }

  .${styles.notFound} {
    height: clamp(390px, calc(16.4706vw + 208.8235px), 446px);
    padding-top: clamp(72px, calc(4.70588vw + 20.2353px), 88px);
    padding-bottom: clamp(30px, calc(2.94118vw - 2.35294px), 40px);
  }
  .${styles.notFoundCode} {
    font-size: clamp(96px, calc(7.05882vw + 18.3529px), 120px);
  }
  .${styles.notFoundFooterWrap} {
    padding-top: clamp(16px, calc(7.05882vw - 61.6471px), 40px);
    padding-bottom: clamp(0px, calc(11.7647vw - 129.4118px), 40px);
  }
}

@media (min-width: 640px) and (max-width: 1023px) {
  .${styles.blogHeroImage} {
    top: 76px;
    right: 0;
    bottom: auto;
    left: auto;
    width: 508px;
    height: 346px;
  }

  .${styles.featuredCard} {
    width: calc((100vw - 98px) / 2);
    flex-basis: calc((100vw - 98px) / 2);
  }
  .${styles.featuredScroller} {
    padding-inline: calc(25vw + 24.5px);
  }

  .${styles.toolHeroImage} {
    inset: 80px 0 auto 0;
    width: 100%;
    height: 600px;
  }
}

@media (max-width: 1023px) {
  .${styles.notFound} {
    height: auto;
    padding-top: 72px;
  }
  .${styles.notFoundCode} {
    font-size: 96px;
  }
  .${styles.notFoundFooterWrap} {
    padding-top: 40px;
    padding-bottom: 40px;
  }
}

@media (max-width: 639px) {
  /* Blog controls fill the shared mobile reading shell. */
  .${styles.searchFilters},
  .${styles.searchField} {
    width: 100%;
    max-width: 100%;
  }
  .${styles.featuredCard} {
    width: var(--w43-mobile-reading-width);
    flex-basis: var(--w43-mobile-reading-width);
  }
  .${styles.featuredScroller} {
    padding-inline: var(--w43-hero-gutter);
  }
  .${styles.threeCols} > *,
  .${styles.stats} > * {
    width: 100%;
  }

  /* Tool hero mobile composition: full-bleed image, shell-aligned copy. */
  .${styles.toolHero} {
    height: 740px;
  }
  .${styles.toolHeroImage} {
    top: 300px;
    right: auto;
    bottom: auto;
    left: 0;
    width: 100%;
    height: 440px;
    object-fit: cover;
    object-position: center center;
    -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 20%, #000 100%);
    mask-image: linear-gradient(180deg, transparent 0, #000 20%, #000 100%);
  }
  .${styles.toolHeroGradient} {
    inset: 0;
    width: 100%;
    height: 740px;
    background: linear-gradient(180deg,rgb(4,6,5) 0%,rgb(4,6,5) 34%,rgba(4,6,5,.88) 37%,rgba(4,6,5,.55) 40%,rgba(4,6,5,.25) 42%,rgba(4,6,5,0) 44%,rgba(4,6,5,0) 100%);
  }
  .${styles.toolHero}::after {
    content: '';
    position: absolute;
    z-index: 2;
    top: 505px;
    right: 0;
    left: 0;
    height: 235px;
    pointer-events: none;
    background: linear-gradient(180deg,rgba(4,5,4,.1) 0%,rgba(4,5,4,.34) 22%,rgba(4,5,4,.58) 52%,rgba(4,5,4,.7) 78%,rgba(4,5,4,.74) 100%);
  }
  .${styles.toolHeroCopy} {
    top: 0;
    width: calc(100% - var(--w43-hero-gutter) - var(--w43-hero-gutter));
    height: 740px;
  }
  .${styles.toolBadge} {
    position: absolute;
    top: 104px;
    left: 0;
  }
  .${styles.toolTitle} {
    position: absolute;
    top: 164px;
    left: 0;
    width: 100%;
    margin: 0;
    font-size: 30px;
    line-height: 39px;
  }
  .${styles.toolDescription} {
    position: absolute;
    top: 548px;
    left: 0;
    width: 100%;
    margin: 0;
    font-size: 15px;
    line-height: 1.6;
  }
  .${styles.toolHero} .${styles.primaryButton} {
    position: absolute;
    top: 635px;
    left: 0;
    min-width: 140px;
    margin: 0;
  }

  .${styles.notFound} {
    padding-top: clamp(48px, calc(3.80952vw + 33.1429px), 56px);
    padding-bottom: 40px;
  }
  .${styles.notFoundCode} {
    font-size: 72px;
  }
  .${styles.notFoundActions},
  .${styles.blogRecovery} {
    width: 100%;
  }
  .${styles.notFoundFooterWrap} {
    height: clamp(137px, calc(11.9048vw + 90.5714px), 162px);
    padding-top: 24px;
    padding-bottom: 24px;
  }
}
`;

  return <style data-w43-final-polish="component-only-v2">{css}</style>;
}
