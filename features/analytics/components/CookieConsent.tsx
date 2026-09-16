'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getConsentData, saveConsent } from '@/lib/cookie-consent';

import { CategoryRow } from './CookieConsentPreferences';

// ─── Main Component ───────────────────────────────────────────────
export default function CookieConsent() {
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
      role="dialog"
      aria-labelledby="cookie-title"
      aria-describedby="cookie-desc"
      aria-modal="true"
      className="fixed bottom-0 left-0 right-0 z-[70] px-4 pb-4 sm:px-6 sm:pb-6"
      style={{ animation: 'cookieBannerUp 0.35s ease both' }}
    >
      <div
        className="max-w-3xl mx-auto"
        style={{
          background:
            'linear-gradient(135deg, rgba(20,25,35,0.98) 0%, rgba(15,20,28,0.98) 100%)',
          border: '1px solid rgba(220,190,130,0.25)',
          borderRadius: '1rem',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
          overflow: 'hidden',
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
                >
                  เว็บไซต์นี้ใช้คุกกี้
                </p>
                <p
                  id="cookie-desc"
                  className="text-xs text-muted-foreground leading-relaxed"
                >
                  เว็บไซต์ใช้ Google Analytics เพื่อวิเคราะห์การใช้งาน และใช้ Meta Pixel เฉพาะหน้า CI Planning กับ Financial Health Check หลังคุณเลือกยินยอม{' '}
                  <Link
                    href="/cookie-policy"
                    className="text-primary hover:underline underline-offset-2"
                  >
                    นโยบายคุกกี้
                  </Link>
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
                  aria-label="ตั้งค่าคุกกี้"
                >
                  ตั้งค่าคุกกี้
                </button>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="gold-button min-h-11 text-sm font-semibold px-5 py-2"
                  aria-label="ยอมรับคุกกี้ทั้งหมด"
                >
                  ยอมรับ
                </button>
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
              animation: 'cookiePanelDown 0.25s ease both',
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
              >
                การตั้งค่าคุกกี้
              </h2>
              <button
                type="button"
                onClick={() => setShowPanel(false)}
                aria-label="ปิดหน้าตั้งค่าคุกกี้"
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
              label="การจัดเก็บสถานะความยินยอมที่จำเป็น"
              description="บันทึกตัวเลือกความยินยอมไว้ใน localStorage เพื่อให้เว็บไซต์ใช้ตัวเลือกเดิมควบคุมแท็ก"
              checked={true}
              onChange={() => {}}
              alwaysActive
            />
            <CategoryRow
              toggleId="toggle-performance"
              label="คุกกี้เพื่อเพิ่มประสิทธิภาพ (ยังไม่ใช้งาน)"
              description="ปัจจุบันเว็บไซต์ยังไม่ใช้คุกกี้หรือบริการบุคคลที่สามในหมวดนี้ การเปิดหรือปิดตัวเลือกจะบันทึกเฉพาะสถานะความยินยอมไว้ใน localStorage ของเบราว์เซอร์"
              checked={performance}
              onChange={setPerformance}
            />
            <CategoryRow
              toggleId="toggle-analytics"
              label="คุกกี้เพื่อการวิเคราะห์ข้อมูล"
              description="Google Analytics — วิเคราะห์จำนวนผู้เข้าชมและพฤติกรรมการใช้งาน เพื่อปรับปรุงเว็บไซต์"
              checked={analytics}
              onChange={setAnalytics}
            />
            <CategoryRow
              toggleId="toggle-social"
              label="Meta Pixel เพื่อการวัดผลและการตลาด"
              description="Meta Platforms, Inc. — โหลดเฉพาะหน้า CI Planning และ Financial Health Check หลังคุณเปิดตัวเลือกนี้ เพื่อวัดการเข้าชมและปฏิสัมพันธ์สำหรับประเมินผลโฆษณา อาจใช้ _fbp สูงสุด 90 วันและ _fbc เมื่อเกี่ยวข้อง โดยไม่ส่งค่าที่กรอกในเครื่องมือหรือข้อมูลติดต่อ คุณถอนความยินยอมได้ที่ตั้งค่าคุกกี้"
              checked={social}
              onChange={setSocial}
            />

            {/* ปุ่มตกลง */}
            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleSavePreferences}
                className="gold-button min-h-11 text-sm font-semibold px-5 py-2"
                aria-label="บันทึกการตั้งค่าคุกกี้"
              >
                บันทึกการตั้งค่า
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes cookieBannerUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cookiePanelDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
