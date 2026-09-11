import styles from './Website43.module.css';

/**
 * Website 4.3 horizontal layout contract.
 *
 * This is the single horizontal alignment authority. Transition/final-polish
 * styles may tune component internals and full-bleed imagery, but they must not
 * introduce compensating horizontal offsets for ordinary readable content.
 *
 * Structure: viewport/full bleed -> responsive gutter -> centered shell ->
 * component content.
 */
export function Website43LayoutContractStyles() {
  const css = String.raw`
.${styles.root} {
  --w43-shell-max: 1280px;
  --w43-shell-edge: max(var(--w43-nav-gutter), calc((100% - var(--w43-shell-max)) / 2));
}

/* Resolve widths inside their actual padded containing block. Viewport units
   include classic scrollbars and used to overflow these gutters by 8–17px. */
.${styles.section} > .${styles.inner},
.${styles.sectionDeep} > .${styles.inner},
.${styles.blogContent} > .${styles.inner},
.${styles.articleHeader} > .${styles.inner},
.${styles.legalHeader} > .${styles.inner},
.${styles.legalBody} > .${styles.inner},
.${styles.footerWrap} > .${styles.inner},
.${styles.aboutInner} {
  width: 100%;
  max-width: var(--w43-shell-max);
}
.${styles.legalGrid} {
  width: min(988px, 100%);
}

/* Every constrained standard shell shares symmetric spare space. */
.${styles.section} > .${styles.inner},
.${styles.sectionDeep} > .${styles.inner},
.${styles.blogContent} > .${styles.inner},
.${styles.articleHeader} > .${styles.inner},
.${styles.legalHeader} > .${styles.inner},
.${styles.legalBody} > .${styles.inner},
.${styles.footerWrap} > .${styles.inner},
.${styles.aboutInner},
.${styles.narrow},
.${styles.articleReadingGrid},
.${styles.legalGrid},
.${styles.calculatorHeader},
.${styles.calculatorStage},
.${styles.notFound} > .${styles.inner} {
  margin-left: auto;
  margin-right: auto;
}

/* Children of hero copy inherit the hero anchor; never compensate separately. */
.${styles.heroActions},
.${styles.heroProof} {
  margin-left: 0;
  margin-right: 0;
}

@media (min-width: 1024px) {
  .${styles.root} {
    --w43-hero-gutter: var(--w43-shell-edge);
  }

  /* Overlay navigation uses the same constrained shell as standard sections. */
  .${styles.navOverlay} {
    width: min(var(--w43-shell-max), calc(100% - var(--w43-nav-gutter) - var(--w43-nav-gutter)));
  }

  /* Full-bleed images stay full bleed; readable copy shares one shell edge. */
  .${styles.homeHeroCopy},
  .${styles.blogHeroCopy},
  .${styles.toolHeroCopy} {
    left: var(--w43-shell-edge);
  }
}

@media (min-width: 640px) and (max-width: 1023px) {
  .${styles.homeHeroCopy},
  .${styles.blogHeroCopy},
  .${styles.toolHeroCopy} {
    left: var(--w43-hero-gutter);
  }
}

@media (max-width: 639px) {
  .${styles.section} > .${styles.inner},
  .${styles.sectionDeep} > .${styles.inner},
  .${styles.blogContent} > .${styles.inner},
  .${styles.articleHeader} > .${styles.inner},
  .${styles.legalHeader} > .${styles.inner},
  .${styles.legalBody} > .${styles.inner},
  .${styles.footerWrap} > .${styles.inner},
  .${styles.aboutInner},
  .${styles.articleReadingGrid},
  .${styles.legalGrid},
  .${styles.notFound} > .${styles.inner} {
    width: var(--w43-mobile-reading-width);
    max-width: 100%;
    margin-left: auto;
    margin-right: auto;
  }

  .${styles.homeHeroCopy},
  .${styles.blogHeroCopy},
  .${styles.toolHeroCopy} {
    left: var(--w43-hero-gutter);
  }
}
`;

  return <style data-w43-layout-contract="centered-shell-v2">{css}</style>;
}
