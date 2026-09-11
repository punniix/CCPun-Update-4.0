import styles from './Website43.module.css';

/**
 * Website 4.3 horizontal layout contract.
 *
 * This layer owns page-shell alignment. Transition/final-polish styles may tune
 * component geometry, but they must not left-pin shared shells. Keeping the
 * invariant here prevents wide-screen dead space and keeps Figma/code aligned.
 *
 * Contract:
 * - full-bleed sections may span the viewport;
 * - shared inner shells are centered at every viewport;
 * - desktop shell content is capped at 1280px;
 * - wide-screen hero copy aligns to the same centered shell edge;
 * - mobile reading shells remain centered when their canonical width is
 *   narrower than the available content area.
 */
export function Website43LayoutContractStyles() {
  const css = String.raw`
.${styles.root} {
  --w43-shell-max: 1280px;
  --w43-shell-edge: max(var(--w43-nav-gutter), calc(50vw - 640px));
}

/* Shared shell invariant: never pin a constrained shell to one viewport edge. */
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
  margin-left: auto;
  margin-right: auto;
}

@media (min-width: 1024px) {
  /* Full-bleed imagery stays full width; copy aligns to the centered 1280px shell. */
  .${styles.root} {
    --w43-hero-gutter: var(--w43-shell-edge);
  }

  .${styles.navOverlay} {
    width: var(--w43-shell-width);
  }

  .${styles.homeHeroCopy},
  .${styles.blogHeroCopy},
  .${styles.toolHeroCopy} {
    left: var(--w43-shell-edge);
  }
}

@media (max-width: 639px) {
  /* 600px transition frames use a 504px reading shell: center the spare space. */
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
    margin-left: auto;
    margin-right: auto;
  }
}
`;

  return <style data-w43-layout-contract="centered-shell-v1">{css}</style>;
}
