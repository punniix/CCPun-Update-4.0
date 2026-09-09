'use client';

import { MotionConfig } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { installAccordionMotion } from './accordionMotion';
import design from './Website43.module.css';
import styles from './Website43Motion.module.css';

const classes = (...names: string[]) => names.map((name) => `.${design[name]}`).join(',');
const controlSelector = `${classes('primaryButton', 'outlineButton', 'navCta', 'navToolsButton', 'hamburger', 'categoryMenuButton', 'categoryMenuOption', 'carouselDotButton')}, #calculator button`;
const cardSelector = classes('articleCard', 'featuredCard');
const menuSelector = classes('navDropdown', 'mobileMenu', 'mobileSubmenu', 'categoryMenuPanel');
const revealSelector = classes('threeCols', 'learnGrid', 'journey', 'stats');
const accordionSelector = `${classes('faqItem')}, .${design.faqDetails} details`;

/** Mounted only by /preview/website-4-3/layout.tsx; public routes do not opt in. */
export default function Website43MotionBoundary({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animations = new Set<Animation>();
    const menus = new WeakSet<Element>();
    const reveals = new WeakSet<Element>();
    let frame = 0;

    const enter = (element: HTMLElement, distance: number, duration: number, delay = 0, opacity = 0) => {
      if (preference.matches || typeof element.animate !== 'function') return;
      // Individual translate preserves existing transforms, including centered dropdowns.
      const animation = element.animate(
        [{ opacity, translate: `0 ${distance}px` }, { opacity: 1, translate: '0 0' }],
        { duration, delay, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
      );
      animations.add(animation);
      animation.onfinish = animation.oncancel = () => animations.delete(animation);
    };

    const revealObserver = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          revealObserver?.unobserve(entry.target);
          // Content is never hidden before JS, by CSS, or while waiting for the observer.
          enter(entry.target as HTMLElement, 8, 340, 0, 0.88);
        }
      }, { threshold: 0.08 })
      : null;

    const decorate = () => {
      root.querySelectorAll<HTMLElement>(controlSelector).forEach((node) => node.setAttribute('data-w43-motion-control', ''));
      root.querySelectorAll<HTMLElement>(cardSelector).forEach((node) => node.setAttribute('data-w43-motion-card', ''));
      root.querySelectorAll<HTMLElement>(menuSelector).forEach((node) => {
        if (menus.has(node)) return;
        menus.add(node);
        enter(node, -6, 180);
        node.querySelectorAll<HTMLElement>(':scope > a, :scope > button').forEach((item, index) => {
          enter(item, 4, 150, Math.min(index * 18, 54), 0.65);
        });
      });
      root.querySelectorAll<HTMLElement>(revealSelector).forEach((node) => {
        if (reveals.has(node)) return;
        reveals.add(node);
        if (node.getBoundingClientRect().top >= window.innerHeight && !preference.matches) revealObserver?.observe(node);
      });
    };
    const removeAccordion = installAccordionMotion(root, accordionSelector, preference);
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; decorate(); });
    });
    // Child changes only: writing enhancement attributes cannot create an observer loop.
    observer.observe(root, { childList: true, subtree: true });
    const onPreference = () => {
      if (!preference.matches) return;
      for (const animation of animations) animation.cancel();
      animations.clear();
      revealObserver?.disconnect();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const mobileButton = root.querySelector<HTMLButtonElement>('button[aria-label="ปิดเมนู"]');
      const toolsButton = root.querySelector<HTMLButtonElement>(`.${design.navToolsButton}[aria-expanded="true"]`);
      const categoryButton = root.querySelector<HTMLButtonElement>(`.${design.categoryMenuButton}[aria-expanded="true"]`);
      const button = mobileButton ?? toolsButton ?? categoryButton;
      if (button) { button.click(); button.focus({ preventScroll: true }); }
    };
    preference.addEventListener('change', onPreference);
    root.addEventListener('keydown', onEscape);
    decorate();
    root.setAttribute('data-w43-motion-ready', 'true');
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      revealObserver?.disconnect();
      removeAccordion();
      preference.removeEventListener('change', onPreference);
      root.removeEventListener('keydown', onEscape);
      for (const animation of animations) animation.cancel();
      root.removeAttribute('data-w43-motion-ready');
    };
  }, [pathname]);

  return (
    <MotionConfig reducedMotion="user">
      <div ref={rootRef} className={styles.scope} data-w43-motion-root="uat-only">
        {children}
      </div>
    </MotionConfig>
  );
}
