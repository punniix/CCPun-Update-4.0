import styles from './Website43.module.css';

/**
 * Visual interpolation bridge for Website 4.3.
 *
 * Figma remains canonical at 390 / 820 / 1440. The 600 and 1100 layouts are
 * transition references only; they do not introduce new responsive modes.
 * This stylesheet interpolates inside the existing <=639, 640-1023, and
 * >=1024 mode boundaries. There are deliberately no 600px / 1100px media
 * queries.
 */
export function Website43TransitionStyles() {
  const css = String.raw`
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
  object-fit: cover;
  object-position: center center;
}
.${styles.toolHeroGradient} {
  z-index: 1;
  left: clamp(280px, calc(23.5294vw + 21.1765px), 360px);
  width: clamp(620px, calc(29.4118vw + 296.4706px), 720px);
}
.${styles.toolHeroCopy} {
  left: var(--w43-nav-gutter);
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

  return <style data-w43-transition-reference="600-1100">{css}</style>;
}
