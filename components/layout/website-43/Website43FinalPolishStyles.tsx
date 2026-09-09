import styles from './Website43.module.css';

/**
 * Final visual polish after the five-viewport UAT pass.
 *
 * 600 and 1100 remain transition references only. These rules refine geometry
 * inside the existing responsive modes; they intentionally add no new
 * breakpoint at either reference width.
 */
export function Website43FinalPolishStyles() {
  const css = String.raw`
/*
 * Thai copy must use native dictionary line breaking. Do not fall back to
 * arbitrary grapheme breaking (for example leaving the last character of a
 * Thai word on a new line). URLs keep their own emergency wrapping rule below.
 */
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

/* Blog: keep the wrapped article rows anchored to the left like Figma. */
.${styles.articleGrid} {
  justify-content: flex-start;
}

/* Blog category trigger is a compact one-line control in every reference. */
.${styles.categoryMenu} {
  width: 157px;
}
.${styles.categoryMenuButton},
.${styles.categoryMenuButton} > span:first-child {
  white-space: nowrap;
}

/* Figma uses a centered IMAGE/FILL crop for the Home portrait at every mode. */
.${styles.homeHeroPicture} img {
  object-position: center center;
}

@media (min-width: 1024px) {
  /* 1100 reference uses the same 56px shell gutter as Navbar; 1440 resolves to 80px. */
  .${styles.root} {
    --w43-content-gutter: var(--w43-nav-gutter);
  }

  /* Keep desktop copy in the left half, clear of the centered portrait's face.
   * The narrower width wraps complete Thai words without changing font size.
   * Tablet copy already starts below the face; mobile remains unchanged.
   */
  .${styles.homeHeroGradient} {
    width: clamp(840px, calc(82.35294vw - 65.88235px), 1120px);
  }
  .${styles.homeHeroCopy} {
    width: min(640px, calc(50vw - var(--w43-hero-gutter) - 8px));
  }
  .${styles.homeHeroTitle},
  .${styles.homeHeroBody} {
    width: 100%;
  }
  .${styles.heroActions} {
    margin-left: calc(var(--w43-nav-gutter) - var(--w43-hero-gutter));
  }

  .${styles.footerWrap} {
    padding-left: var(--w43-nav-gutter);
    padding-right: var(--w43-nav-gutter);
  }

  /* Keep portrait subjects below the navigation safe area on image-led heroes. */
  .${styles.blogHeroImage} {
    inset: 80px 0 auto auto;
    height: calc(100% - 18px);
  }
  .${styles.toolHeroImage} {
    inset: 96px 0 auto auto;
    height: 620px;
  }

  /* The 1100 transition reference uses the same fluid shell as navigation. */
  .${styles.toolStorySection} {
    padding-left: var(--w43-nav-gutter);
    padding-right: var(--w43-nav-gutter);
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
    padding-right: var(--w43-nav-gutter);
    padding-bottom: clamp(0px, calc(11.7647vw - 129.4118px), 40px);
    padding-left: var(--w43-nav-gutter);
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

  /* Featured stories use the same two-column card width as the article grid. */
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
    padding: 40px;
  }
}

@media (max-width: 639px) {
  /* 390 canonical = 24px content gutter; 600 transition reference = 48px. */
  .${styles.root} {
    --w43-content-gutter: var(--w43-hero-gutter);
  }

  /* Blog search fills the reading shell: 342px at 390 and 504px at 600. */
  .${styles.searchFilters},
  .${styles.searchField} {
    width: 100%;
    max-width: 100%;
  }

  /* Featured stories share the same reading width as the single-column cards below. */
  .${styles.featuredCard} {
    width: var(--w43-mobile-reading-width);
    flex-basis: var(--w43-mobile-reading-width);
  }
  .${styles.featuredScroller} {
    padding-inline: var(--w43-hero-gutter);
  }

  /* Cards fill the Figma reading shell: 342px at 390 and 504px at 600. */
  .${styles.threeCols} > *,
  .${styles.stats} > * {
    width: 100%;
  }

  /*
   * Tool heroes use the same mobile composition language as Home:
   * navigation + top title, portrait starts below the title, and the supporting
   * copy/CTA sits on the lower image with a dedicated readability gradient.
   */
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
    /* Fade the portrait in from the dark hero surface rather than exposing a hard top edge. */
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
    left: var(--w43-hero-gutter);
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
    padding-right: var(--w43-hero-gutter);
    padding-bottom: 40px;
    padding-left: var(--w43-hero-gutter);
  }
  .${styles.notFound} > .${styles.inner} {
    width: var(--w43-mobile-reading-width);
    max-width: 100%;
    margin-right: auto;
    margin-left: 0;
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
    padding-right: var(--w43-hero-gutter);
    padding-bottom: 24px;
    padding-left: var(--w43-hero-gutter);
  }
}
`;

  return <style data-w43-final-polish="five-viewport-uat">{css}</style>;
}
