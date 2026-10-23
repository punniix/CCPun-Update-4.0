'use client';

import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import styles from './Website43Navbar.module.css';
import { WEBSITE43_BASE as BASE, WEBSITE43_HOME as HOME } from './constants';

function Website43NavbarBrand() {
  return (
    <span className={styles.brand} aria-label="CCPUN">
      <span className={styles.brandCc}>CC</span><span className={styles.brandPun}>PUN</span>
    </span>
  );
}

export function Website43Navbar({ overlay = false, notFound = false, responsiveOverlay = false }: { overlay?: boolean; notFound?: boolean; responsiveOverlay?: boolean }) {
  const text = usePublicCopy();
const toolLinks = [
  { href: `${BASE}/play/money-story/`, label: text("site.nav.moneyStory") },
  { href: `${BASE}/tools/financial-health-check/`, label: text("site.nav.fhc") },
  { href: `${BASE}/ci-planning/`, label: text("site.nav.ci") },
];


  const pathname = usePathname()?.replace(/\/$/, '');
  const blogCurrent = pathname === `${BASE}/blog` ? 'page' : pathname?.startsWith(`${BASE}/blog/`) ? 'location' : undefined;
  const toolsCurrent = toolLinks.some(({ href }) => pathname === href.replace(/\/$/, ''));
  const [open, setOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const toolsButtonRef = useRef<HTMLButtonElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (toolsOpen) { setToolsOpen(false); toolsButtonRef.current?.focus(); }
      else if (open) { setOpen(false); setMobileToolsOpen(false); mobileButtonRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, toolsOpen]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) setToolsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const nav = (
    <div className={styles.nav} ref={navRef} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setOpen(false); setToolsOpen(false); setMobileToolsOpen(false);
      }
    }}>
      <Link href={HOME} className={styles.brandLink} aria-label={text("site.nav.homeLabel")}><Website43NavbarBrand /></Link>
      <div className={styles.navSpacer} />
      <nav className={styles.navLinks} aria-label={text("site.nav.mainLabel")}>
        <Link href={HOME} aria-current={pathname === BASE ? 'page' : undefined}>{text.node("site.nav.home")}</Link>
        <Link href={`${BASE}/blog/`} aria-current={blogCurrent}>{text.node("site.nav.blog")}</Link>
        <div className={styles.navTools} ref={toolsRef}>
          <button ref={toolsButtonRef} className={styles.navToolsButton} data-active={toolsCurrent} type="button" aria-controls="home-tools-navigation" aria-expanded={toolsOpen} onClick={() => setToolsOpen((v) => !v)}>{text.node("site.nav.tools")}{' '}<span className={`${styles.navChevron} ${toolsOpen ? styles.navChevronOpen : ''}`} aria-hidden="true">⌄</span>
          </button>
          {toolsOpen ? (
            <div id="home-tools-navigation" className={styles.navDropdown}>
              {toolLinks.map(({ href, label }) => (
                <Link key={href} href={href} aria-current={pathname === href.replace(/\/$/, '') ? 'page' : undefined} onClick={() => setToolsOpen(false)}><span aria-hidden="true" />{label}</Link>
              ))}
            </div>
          ) : null}
        </div>
      </nav>
      <a className={styles.navCta} href="https://lin.ee/tqLCs4f" target="_blank" rel="noopener noreferrer" data-analytics-location="navbar">{text.node("site.nav.contact")}</a>
      <button ref={mobileButtonRef} className={styles.hamburger} aria-controls="mobile-navigation" type="button" aria-label={open ? text("site.nav.close") : text("site.nav.open")} aria-expanded={open} onClick={() => { setOpen((v) => !v); setToolsOpen(false); }}>
        <span /><span /><span />
      </button>
      {open ? (
        <nav id="mobile-navigation" className={styles.mobileMenu} aria-label={text("site.nav.mobileLabel")}>
          <Link href={HOME} aria-current={pathname === BASE ? 'page' : undefined} onClick={() => setOpen(false)}>{text.node("site.nav.home")}</Link>
          <Link href={`${BASE}/blog/`} aria-current={blogCurrent} onClick={() => setOpen(false)}>{text.node("site.nav.blog")}</Link>
          <div className={styles.mobileTools}>
            <button type="button" data-active={toolsCurrent} aria-expanded={mobileToolsOpen} onClick={() => setMobileToolsOpen((v) => !v)}>
              <span>{text.node("site.nav.tools")}</span><span className={`${styles.navChevron} ${mobileToolsOpen ? styles.navChevronOpen : ''}`} aria-hidden="true">⌄</span>
            </button>
            {mobileToolsOpen ? (
              <div className={styles.mobileSubmenu}>
                {toolLinks.map(({ href, label }) => (
                  <Link key={href} href={href} aria-current={pathname === href.replace(/\/$/, '') ? 'page' : undefined} onClick={() => { setOpen(false); setMobileToolsOpen(false); }}><span aria-hidden="true" />{label}</Link>
                ))}
              </div>
            ) : null}
          </div>
          <a href="https://lin.ee/tqLCs4f" target="_blank" rel="noopener noreferrer" data-analytics-location="navbar_mobile" onClick={() => { setOpen(false); setMobileToolsOpen(false); }}>{text.node("site.nav.contact")}</a>
        </nav>
      ) : null}
    </div>
  );

  if (overlay) return <div className={styles.navOverlay}>{nav}</div>;
  return <div className={`${styles.navBand} ${responsiveOverlay ? styles.responsiveOverlayBand : ''} ${notFound ? styles.notFoundNavBand : ''}`}><div className={styles.inner}>{nav}</div></div>;
}
