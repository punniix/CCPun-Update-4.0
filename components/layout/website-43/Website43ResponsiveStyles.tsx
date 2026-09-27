import styles from './Website43.module.css';

/**
 * Canonical runtime owner for Website 4.3 responsive interpolation.
 *
 * Figma remains canonical at 390 / 820 / 1440. The 600 and 1100 layouts are
 * transition references only; they do not add breakpoints. Keep all responsive
 * geometry refinements here instead of adding another hotfix/polish style layer.
 */
export function Website43ResponsiveStyles() {
  // Fluid interpolation shared across the existing desktop/tablet/mobile modes.
  const interpolationCss = String.raw`
.${styles.root} {
  --w43-nav-gutter: clamp(56px, calc(7.05882vw - 21.6471px), 80px);
  --w43-hero-gutter: clamp(61.111px, 5.55556vw, 80px);
  --w43-shell-width: min(calc(100vw - 112px), clamp(988px, calc(85.8824vw + 43.0588px), 1280px));
  --w43-shell-left: max(var(--w43-nav-gutter), calc((100vw - 1280px) / 2));
}

.${styles.navBand} {
  padding-left: var(--w43-nav-gutter);
  padding-right: var(--w43-nav-gutter);
}
.${styles.navOverlay} {
  width: min(1280px, calc(100% - var(--w43-nav-gutter) - var(--w43-nav-gutter)));
}

.${styles.section},
.${styles.sectionDeep},
.${styles.blogContent},
.${styles.articleHeader},
.${styles.articleReadingWrap},
.${styles.toolStorySection},
.${styles.calculatorSection},
.${styles.legalHeader},
.${styles.legalBody},
.${styles.notFound},
.${styles.footerWrap} {
  padding-left: var(--w43-content-gutter);
  padding-right: var(--w43-content-gutter);
}

.${styles.section} > .${styles.inner},
.${styles.sectionDeep} > .${styles.inner},
.${styles.blogContent} > .${styles.inner},
.${styles.articleHeader} > .${styles.inner},
.${styles.legalHeader} > .${styles.inner},
.${styles.legalBody} > .${styles.inner},
.${styles.footerWrap} > .${styles.inner} {
  width: var(--w43-shell-width);
  max-width: none;
  margin-left: auto;
  margin-right: auto;
}
.${styles.section} > .${styles.articleSupportInner},
.${styles.sectionDeep} > .${styles.articleSupportInner} {
  width: min(1028px, 100%);
  max-width: 1028px;
  margin-left: auto;
  margin-right: auto;
}

.${styles.about} {
  padding-left: var(--w43-hero-gutter);
  padding-right: var(--w43-hero-gutter);
}

.${styles.homeHeroCopy} {
  left: var(--w43-shell-left);
}

.${styles.blogHeroImage} {
  width: clamp(710px, calc(61.7647vw + 30.5882px), 920px);
  object-fit: cover;
  object-position: center center;
}
.${styles.blogHeroGradient} {
  inset: 0 auto 0 0;
  width: clamp(900px, calc(82.3529vw - 5.8824px), 1180px);
  height: 100%;
}
.${styles.blogHeroCopy} {
  top: 174px;
  left: var(--w43-shell-left);
}

.${styles.toolHeroImage} {
  width: clamp(630px, calc(55.8824vw + 15.2941px), 820px);
  object-fit: contain;
  object-position: right center;
}
.${styles.toolHeroGradient} {
  z-index: 1;
  left: clamp(280px, calc(23.5294vw + 21.1765px), 360px);
  width: clamp(620px, calc(29.4118vw + 296.4706px), 720px);
}
.${styles.toolHeroCopy} {
  left: var(--w43-shell-left);
  top: 128px;
  width: clamp(700px, calc(17.6471vw + 505.8824px), 760px);
}
.${styles.toolTitle} {
  font-size: 44px;
  line-height: 58px;
}
.${styles.toolDescription} {
  width: 560px;
}
.${styles.toolHero} .${styles.primaryButton} {
  width: 140px;
  min-width: 140px;
}
.${styles.toolHero}::after {
  content: '';
}

.${styles.articleReadingGrid} {
  grid-template-columns: minmax(220px, 260px) minmax(0, 720px);
  gap: clamp(32px, 3.333vw, 48px);
}
.${styles.legalGrid} {
  width: min(988px, calc(100vw - 112px));
  max-width: none;
  margin-left: auto;
  margin-right: auto;
}

@media (max-width: 1023px) {
  .${styles.root} {
    --w43-nav-gutter: 40px;
    --w43-content-gutter: 40px;
    --w43-hero-gutter: 40px;
    --w43-shell-width: 100%;
  }

  .${styles.navBand},
  .${styles.responsiveOverlayBand} {
    padding-left: var(--w43-nav-gutter);
    padding-right: var(--w43-nav-gutter);
  }
  .${styles.navOverlay} {
    width: calc(100% - var(--w43-nav-gutter) - var(--w43-nav-gutter));
  }

  .${styles.section} > .${styles.inner},
  .${styles.sectionDeep} > .${styles.inner},
  .${styles.blogContent} > .${styles.inner},
  .${styles.articleHeader} > .${styles.inner},
  .${styles.legalHeader} > .${styles.inner},
  .${styles.legalBody} > .${styles.inner},
  .${styles.footerWrap} > .${styles.inner} {
    width: 100%;
    max-width: none;
  }

  .${styles.homeHeroCopy} {
    left: var(--w43-hero-gutter);
    width: min(650px, calc(100% - var(--w43-hero-gutter) - var(--w43-hero-gutter)));
  }

  .${styles.blogHero} {
    height: 360px;
  }
  .${styles.blogHeroGradient} {
    inset: 0 auto 0 0;
    width: 690px;
    height: 360px;
  }
  .${styles.blogHeroCopy} {
    top: 150px;
    left: 40px;
  }

  .${styles.toolHero} {
    height: 600px;
  }
  .${styles.toolHeroGradient} {
    inset: 0;
    width: 100%;
    height: 600px;
  }
  .${styles.toolHeroCopy} {
    top: 104px;
    left: 40px;
    width: min(620px, calc(100% - 80px));
  }
  .${styles.toolTitle} {
    font-size: 38px;
    line-height: 48px;
  }
  .${styles.toolDescription} {
    width: 100%;
  }
  .${styles.toolHero} .${styles.primaryButton} {
    width: 140px;
    min-width: 140px;
  }

  .${styles.articleReadingGrid} {
    grid-template-columns: 200px minmax(0, 1fr);
    gap: 32px;
  }
  .${styles.legalGrid} {
    width: 100%;
    max-width: none;
  }
}

@media (max-width: 639px) {
  .${styles.root} {
    --w43-nav-gutter: clamp(24px, calc(3.80952vw + 9.14286px), 32px);
    --w43-hero-gutter: clamp(24px, calc(11.4286vw - 20.5714px), 48px);
    --w43-mobile-reading-width: min(calc(100vw - 48px), clamp(342px, calc(77.1429vw + 41.1429px), 504px));
    --w43-shell-width: var(--w43-mobile-reading-width);
  }

  .${styles.navBand},
  .${styles.responsiveOverlayBand} {
    padding-left: var(--w43-nav-gutter);
    padding-right: var(--w43-nav-gutter);
  }
  .${styles.navOverlay} {
    top: 20px;
    width: calc(100% - var(--w43-nav-gutter) - var(--w43-nav-gutter));
  }

  .${styles.section},
  .${styles.sectionDeep},
  .${styles.blogContent},
  .${styles.articleHeader},
  .${styles.articleReadingWrap},
  .${styles.toolStorySection},
  .${styles.calculatorSection},
  .${styles.legalHeader},
  .${styles.legalBody},
  .${styles.notFound},
  .${styles.footerWrap} {
    padding-left: var(--w43-content-gutter);
    padding-right: var(--w43-content-gutter);
  }

  .${styles.section} > .${styles.inner},
  .${styles.sectionDeep} > .${styles.inner},
  .${styles.blogContent} > .${styles.inner},
  .${styles.articleHeader} > .${styles.inner},
  .${styles.legalHeader} > .${styles.inner},
  .${styles.legalBody} > .${styles.inner},
  .${styles.footerWrap} > .${styles.inner},
  .${styles.aboutInner} {
    width: var(--w43-mobile-reading-width);
    max-width: 100%;
    margin-left: 0;
    margin-right: auto;
  }

  .${styles.about} {
    padding-left: 24px;
    padding-right: 24px;
  }

  .${styles.homeHeroCopy} {
    left: var(--w43-hero-gutter);
    width: calc(100% - var(--w43-hero-gutter) - var(--w43-hero-gutter));
  }
  .${styles.homeHeroTitle} {
    width: 100%;
  }
  .${styles.threeCols} {
    width: var(--w43-mobile-reading-width);
    max-width: 100%;
    justify-items: start;
  }
  .${styles.stats} {
    width: var(--w43-mobile-reading-width);
    max-width: 100%;
    justify-items: start;
  }

  .${styles.blogHero} {
    height: clamp(390px, calc(28.5714vw + 278.571px), 450px);
  }
  .${styles.blogHeroImage} {
    --w43-blog-image-top: clamp(202px, calc(5.71429vw + 179.714px), 214px);
    top: var(--w43-blog-image-top);
    right: auto;
    bottom: 0;
    left: 0;
    width: 100%;
    height: auto;
    object-fit: cover;
    object-position: center center;
  }
  .${styles.blogHeroGradient} {
    inset: 0 auto auto 0;
    width: 100%;
    height: clamp(350px, calc(19.0476vw + 275.714px), 390px);
    background: linear-gradient(
      180deg,
      rgba(14,10,10,.98) 0%,
      rgba(14,10,10,.98) 42%,
      rgba(14,10,10,.90) 56%,
      rgba(14,10,10,.66) 70%,
      rgba(14,10,10,.30) 84%,
      rgba(14,10,10,0) 100%
    );
  }
  .${styles.blogHeroCopy} {
    top: 126px;
    left: var(--w43-hero-gutter);
    width: calc(100% - var(--w43-hero-gutter) - var(--w43-hero-gutter));
  }
  .${styles.blogHeroCopy} p {
    width: 100%;
  }

  .${styles.articleReadingGrid} {
    display: block;
    width: var(--w43-mobile-reading-width);
    max-width: 100%;
    margin-left: 0;
    margin-right: auto;
  }
  .${styles.legalGrid} {
    width: var(--w43-mobile-reading-width);
    max-width: 100%;
    margin-left: 0;
    margin-right: auto;
  }

  .${styles.toolHeroCopy} {
    z-index: 4;
  }
  .${styles.toolHero} .${styles.primaryButton} {
    width: clamp(140px, calc(31.579vw + 16.8421px), 206.316px);
  }
}
`;

  // Canonical refinements from the completed five-viewport UAT pass. These
  // intentionally override interpolation values above, so future changes belong
  // here rather than in another FinalPolish/Hotfix component.
  const refinementCss = String.raw`
@media (min-width: 1024px) {
  .${styles.root} {
    --w43-content-gutter: var(--w43-nav-gutter);
  }

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

  .${styles.blogHeroImage} {
    inset: 80px 0 auto auto;
    height: calc(100% - 18px);
  }
  .${styles.toolHeroImage} {
    inset: 96px 0 auto auto;
    height: 620px;
  }
  .${styles.toolHero}::after {
    /* ponytail: the 70px fade reaches dark where the contained 4:3 image ends. */
    inset: clamp(476px, calc(21vw + 246px), 548px) 0 0;
    height: auto;
    background: linear-gradient(180deg, rgba(6,11,9,0), #060b09 70px);
  }

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

  .${styles.featuredCard} {
    width: calc((100vw - 98px) / 2);
    flex-basis: calc((100vw - 98px) / 2);
  }
  .${styles.featuredScroller} {
    padding-inline: calc(25vw + 24.5px);
  }

  .${styles.root} .${styles.toolHeroImage} {
    inset: 0 0 auto auto;
    width: 560px;
    height: 100%;
  }
  .${styles.toolHero}::after {
    inset: auto 0 0;
    height: 150px;
    background: linear-gradient(180deg, rgba(6,11,9,0), #060b09 40%);
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
  .${styles.root} {
    --w43-content-gutter: var(--w43-hero-gutter);
  }

  .${styles.homeHero} {
    height: clamp(740px, calc(9.52381vw + 702.857px), 760px);
    isolation: isolate;
  }
  .${styles.homeHeroPicture} {
    top: clamp(244px, calc(5.71429vw + 221.714px), 256px);
    right: 0;
    bottom: 0;
    left: 0;
    height: auto;
    contain: layout paint;
  }
  .${styles.homeHeroGradient} {
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    background:
      linear-gradient(180deg,rgba(4,5,4,.10) 0%,rgba(4,5,4,.34) 22%,rgba(4,5,4,.58) 52%,rgba(4,5,4,.70) 78%,rgba(4,5,4,.74) 100%) bottom / 100% clamp(235px, calc(7.14286vw + 207.143px), 250px) no-repeat,
      linear-gradient(180deg,rgb(4,6,5) 0%,rgb(4,6,5) 34%,rgba(4,6,5,.88) 37%,rgba(4,6,5,.55) 40%,rgba(4,6,5,.25) 42%,rgba(4,6,5,0) 44%,rgba(4,6,5,0) 100%);
  }
  .${styles.homeHeroBottomGradient} {
    display: none;
  }
  .${styles.homeHeroCopy} {
    top: clamp(104px, calc(3.80952vw + 89.1429px), 112px);
  }
  .${styles.homeHeroBody} {
    margin-top: clamp(326px, calc(1.90476vw + 318.571px), 330px);
  }

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

  .${styles.toolHero} {
    height: 700px;
  }
  .${styles.toolHeroImage} {
    top: 252px;
    right: auto;
    bottom: auto;
    left: 0;
    width: 100%;
    height: auto;
    object-fit: contain;
    object-position: center center;
    -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 20%, #000 82%, transparent 100%);
    mask-image: linear-gradient(180deg, transparent 0, #000 20%, #000 82%, transparent 100%);
  }
  .${styles.toolHeroGradient} {
    inset: 0;
    width: 100%;
    height: 700px;
    background: linear-gradient(180deg,rgb(4,6,5) 0%,rgb(4,6,5) 34%,rgba(4,6,5,.88) 37%,rgba(4,6,5,.55) 40%,rgba(4,6,5,.25) 42%,rgba(4,6,5,0) 44%,rgba(4,6,5,0) 100%);
  }
  .${styles.toolHero}::after {
    content: '';
    position: absolute;
    z-index: 2;
    top: 465px;
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
    height: 700px;
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
    top: 636px;
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

  return <style data-w43-responsive="canonical">{`${interpolationCss}\n${refinementCss}`}</style>;
}
