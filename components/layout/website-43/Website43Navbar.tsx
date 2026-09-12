'use client';

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
  const pathname = usePathname()?.replace(/\/$/, '');
  const blogCurrent = pathname === `${BASE}/blog` ? 'page' : pathname?.startsWith(`${BASE}/blog/`) ? 'location' : undefined;
  const toolsCurrent = pathname === `${BASE}/tools/financial-health-check` || pathname === `${BASE}/ci-planning`;
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
      <Link href={HOME} aria-label="CCPUN หน้าแรก"><Website43NavbarBrand /></Link>
      <div className={styles.navSpacer} />
      <nav className={styles.navLinks} aria-label="เมนูหลัก">
        <Link href={HOME} aria-current={pathname === BASE ? 'page' : undefined}>หน้าแรก</Link>
        <Link href={`${BASE}/blog`} aria-current={blogCurrent}>บทความ</Link>
        <div className={styles.navTools} ref={toolsRef}>
          <button ref={toolsButtonRef} className={styles.navToolsButton} data-active={toolsCurrent} type="button" aria-controls="home-tools-navigation" aria-expanded={toolsOpen} onClick={() => setToolsOpen((v) => !v)}>
            เครื่องมือ <span className={`${styles.navChevron} ${toolsOpen ? styles.navChevronOpen : ''}`} aria-hidden="true">⌄</span>
          </button>
          {toolsOpen ? (
            <div id="home-tools-navigation" className={styles.navDropdown}>
              <Link href={`${BASE}/tools/financial-health-check`} aria-current={pathname === `${BASE}/tools/financial-health-check` ? 'page' : undefined} onClick={() => setToolsOpen(false)}><span aria-hidden="true" />ตรวจสุขภาพการเงิน (Beta)</Link>
              <Link href={`${BASE}/ci-planning`} aria-current={pathname === `${BASE}/ci-planning` ? 'page' : undefined} onClick={() => setToolsOpen(false)}><span aria-hidden="true" />วางแผนเงินก้อนโรคร้ายแรง</Link>
            </div>
          ) : null}
        </div>
      </nav>
      <a className={styles.navCta} href="https://lin.ee/tqLCs4f" target="_blank" rel="noopener noreferrer" data-analytics-location="navbar">ติดต่อเรา</a>
      <button ref={mobileButtonRef} className={styles.hamburger} aria-controls="mobile-navigation" type="button" aria-label={open ? 'ปิดเมนู' : 'เปิดเมนู'} aria-expanded={open} onClick={() => { setOpen((v) => !v); setToolsOpen(false); }}>
        <span /><span /><span />
      </button>
      {open ? (
        <nav id="mobile-navigation" className={styles.mobileMenu} aria-label="เมนูมือถือ">
          <Link href={HOME} aria-current={pathname === BASE ? 'page' : undefined} onClick={() => setOpen(false)}>หน้าแรก</Link>
          <Link href={`${BASE}/blog`} aria-current={blogCurrent} onClick={() => setOpen(false)}>บทความ</Link>
          <div className={styles.mobileTools}>
            <button type="button" data-active={toolsCurrent} aria-expanded={mobileToolsOpen} onClick={() => setMobileToolsOpen((v) => !v)}>
              <span>เครื่องมือ</span><span className={`${styles.navChevron} ${mobileToolsOpen ? styles.navChevronOpen : ''}`} aria-hidden="true">⌄</span>
            </button>
            {mobileToolsOpen ? (
              <div className={styles.mobileSubmenu}>
                <Link href={`${BASE}/tools/financial-health-check`} aria-current={pathname === `${BASE}/tools/financial-health-check` ? 'page' : undefined} onClick={() => { setOpen(false); setMobileToolsOpen(false); }}>ตรวจสุขภาพการเงิน (Beta)</Link>
                <Link href={`${BASE}/ci-planning`} aria-current={pathname === `${BASE}/ci-planning` ? 'page' : undefined} onClick={() => { setOpen(false); setMobileToolsOpen(false); }}>วางแผนเงินก้อนโรคร้ายแรง</Link>
              </div>
            ) : null}
          </div>
          <a href="https://lin.ee/tqLCs4f" target="_blank" rel="noopener noreferrer" data-analytics-location="navbar_mobile" onClick={() => { setOpen(false); setMobileToolsOpen(false); }}>ติดต่อเรา</a>
        </nav>
      ) : null}
    </div>
  );

  if (overlay) return <div className={styles.navOverlay}>{nav}</div>;
  return <div className={`${styles.navBand} ${responsiveOverlay ? styles.responsiveOverlayBand : ''} ${notFound ? styles.notFoundNavBand : ''}`}><div className={styles.inner}>{nav}</div></div>;
}
