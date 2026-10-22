'use client';
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getConsentData, saveConsent } from '@/lib/cookie-consent';

import { CategoryRow } from './CookieConsentPreferences';

// ─── Main Component ───────────────────────────────────────────────
export default function CookieConsent() {
  const text = usePublicCopy();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [performance, setPerformance] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [social, setSocial] = useState(false);

  useEffect(() => {
    if (getConsentData() === null) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // เปิด banner ใหม่จาก footer "ตั้งค่าคุกกี้"
  useEffect(() => {
    function handleReopen() {
      const consent = getConsentData();
      setPerformance(consent?.performance ?? false);
      setAnalytics(consent?.analytics ?? false);
      setSocial(consent?.social ?? false);
      setShowPanel(false);
      setVisible(true);
    }
    window.addEventListener('ccpun:openCookieSettings', handleReopen);
    return () => window.removeEventListener('ccpun:openCookieSettings', handleReopen);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const inerted: Array<{ node: HTMLElement; value: boolean }> = [];
    let branch: HTMLElement = dialog;
    while (branch.parentElement && branch.parentElement !== document.documentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling !== branch && sibling instanceof window.HTMLElement && !['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) {
          inerted.push({ node: sibling, value: sibling.inert });
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.focus();
    const containFocus = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node)) dialog.focus();
    };
    document.addEventListener('focusin', containFocus);
    return () => {
      document.removeEventListener('focusin', containFocus);
      for (const { node, value } of inerted) node.inert = value;
      document.body.style.overflow = oldOverflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [visible]);

  useEffect(() => {
    if (visible) dialogRef.current?.focus({ preventScroll: true });
  }, [visible, showPanel]);

  function handleAcceptAll() {
    saveConsent({
      status: 'accepted_all',
      essential: true,
      performance: true,
      analytics: true,
      social: true,
      timestamp: new Date().toISOString(),
    });
    setVisible(false);
    setShowPanel(false);
    window.dispatchEvent(new CustomEvent('ccpun:consent', { detail: 'accepted' }));
  }

  function handleSavePreferences() {
    saveConsent({
      status: 'custom',
      essential: true,
      performance,
      analytics,
      social,
      timestamp: new Date().toISOString(),
    });
    setVisible(false);
    setShowPanel(false);
    window.dispatchEvent(
      new CustomEvent('ccpun:consent', { detail: analytics ? 'accepted' : 'rejected' })
    );
  }

  if (!visible) return null;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (showPanel) setShowPanel(false); else setVisible(false);
        }
        if (event.key === 'Tab') {
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')).filter(node => node.getClientRects().length > 0);
          const first = controls[0], last = controls.at(-1);
          if (!first) { event.preventDefault(); return; }
          if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) { event.preventDefault(); first.focus(); }
        }
      }}
      role="dialog"
      aria-labelledby={showPanel ? "cookie-settings-title" : "cookie-title"}
      aria-describedby={showPanel ? undefined : "cookie-desc"}
      aria-modal="true"
      className="fixed bottom-0 left-0 right-0 z-[70] px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div
        className="max-w-3xl mx-auto"
        style={{
          background:
            'linear-gradient(135deg, rgba(74,58,58,0.98) 0%, rgba(37,24,24,0.98) 100%)',
          border: '1px solid rgba(220,190,130,0.25)',
          borderRadius: '1rem',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
          overflow: 'hidden',
          maxHeight: 'calc(100dvh - 2rem)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ─── Banner หลัก (ซ่อนเมื่อเปิด Panel) ─── */}
        {!showPanel && (
          <div className="px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* ข้อความ */}
              <div className="flex-1 min-w-0">
                <p
                  id="cookie-title"
                  className="text-sm font-semibold text-foreground mb-1"
                >{text("site.cookie.title")}</p>
                <p
                  id="cookie-desc"
                  className="text-xs text-muted-foreground leading-relaxed"
                >{text("site.cookie.description")}{' '}
                  <Link
                    href="/cookie-policy"
                    className="text-primary hover:underline underline-offset-2"
                  >{text("site.cookie.policy")}</Link>
                </p>
              </div>

              {/* ปุ่ม */}
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPanel(true)}
                  className="min-h-11 text-sm font-medium px-4 py-2 rounded-full border transition-colors"
                  style={{
                    borderColor: 'rgba(220,190,130,0.4)',
                    color: 'hsl(45,70%,65%)',
                    background: 'transparent',
                  }}
                  aria-label={text("site.cookie.settings")}
                >{text("site.cookie.settings")}</button>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="gold-button min-h-11 text-sm font-semibold px-5 py-2"
                  aria-label={text("site.cookieConsentarialabel")}
                >{text("site.cookie.accept")}</button>
              </div>
            </div>
          </div>
        )}

        {/* ─── หน้าตั้งค่าคุกกี้ (Replace Banner) ─── */}
        {showPanel && (
          <div
            id="cookie-preference-panel"
            style={{
              padding: '1.25rem 1.5rem 1.5rem',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}
            >
              <h2
                id="cookie-settings-title"
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'hsl(0 10% 98%)',
                  margin: 0,
                }}
              >{text("site.cookie.preferencesTitle")}</h2>
              <button
                type="button"
                onClick={() => setShowPanel(false)}
                aria-label={text("site.cookieConsentarialabel2")}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '50%',
                  width: '2.75rem',
                  height: '2.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'hsl(0 10% 70%)',
                  fontSize: '1rem',
                  lineHeight: 1,
                  flexShrink: 0,
                  transition: 'border-color 0.2s, color 0.2s',
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>

            {/* 4 หมวดคุกกี้ */}
            <CategoryRow
              toggleId="toggle-essential"
              label={text("site.cookieConsentlabel")}
              description={text("site.cookieConsentdescription")}
              checked={true}
              onChange={() => {}}
              alwaysActive
            />
            <CategoryRow
              toggleId="toggle-performance"
              label={text("site.cookieConsentlabel2")}
              description={text("site.cookieConsentdescription2")}
              checked={performance}
              onChange={setPerformance}
            />
            <CategoryRow
              toggleId="toggle-analytics"
              label={text("site.cookieConsentlabel3")}
              description={text("site.cookieConsentdescription3")}
              checked={analytics}
              onChange={setAnalytics}
            />
            <CategoryRow
              toggleId="toggle-social"
              label={text("site.cookieConsentlabel4")}
              description={text("site.cookieConsentdescription4")}
              checked={social}
              onChange={setSocial}
            />

            {/* ปุ่มตกลง */}
            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleSavePreferences}
                className="gold-button min-h-11 text-sm font-semibold px-5 py-2"
                aria-label={text("site.cookieConsentarialabel3")}
              >{text("site.cookie.save")}</button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
