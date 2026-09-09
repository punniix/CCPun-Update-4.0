import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const GoogleAnalytics = require('../features/analytics/components/GoogleAnalytics.tsx').default;
const GoogleTagManager = require('../features/analytics/components/GoogleTagManager.tsx').default;
// No external resources execute: this checks the app's loader and consent lifecycle, not provider hits.
const dom = new JSDOM('<div id="root"></div><nav><a href="https://lin.ee/test">LINE</a></nav>', { url: 'https://ccpun.com/' });
for (const name of ['window', 'self', 'document', 'localStorage', 'Element', 'CustomEvent', 'Event']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const gaId = 'G-TEST123';
let root;
const consent = async (analytics) => {
  localStorage.setItem('ccpun_cookie_consent', JSON.stringify({ analytics, social: false, expires: Date.now() + 60000 }));
  await act(() => window.dispatchEvent(new CustomEvent('ccpun:consent')));
};
const mount = async () => {
  root = createRoot(document.getElementById('root'));
  await act(() => root.render(createElement(GoogleAnalytics, { gaId })));
};
const commands = (name) => (window.dataLayer ?? []).filter((entry) => entry[0] === name).map((entry) => {
  assert.equal(Object.prototype.toString.call(entry), '[object Arguments]', 'Google commands must retain the provider Arguments protocol');
  return Array.from(entry);
});

try {
  process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED = 'true';
  await consent(true);
  await mount();
  assert.equal(document.querySelectorAll('#ga-script').length, 0, 'wait for GTM readiness');
  const gtmRoot = createRoot(document.createElement('div'));
  await act(() => gtmRoot.render(createElement(GoogleTagManager, { gtmId: 'GTM-TEST' })));
  assert.equal(document.querySelectorAll('#gtm-script').length, 1);
  assert.deepEqual(commands('consent')[0], ['consent', 'default', {
    ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', wait_for_update: 500,
  }], 'consent defaults must deny all storage before GTM starts');
  assert.ok(window.dataLayer.findIndex((entry) => entry[0] === 'consent' && entry[1] === 'default') < window.dataLayer.findIndex((entry) => entry.event === 'gtm.js'), 'consent default must precede gtm.js');
  assert.ok(commands('set').some((entry) => entry[1]?.site_version === '4.0'), 'site version survives GTM ownership');
  const gtag = window.gtag;
  await act(() => root.unmount());
  await mount();
  assert.equal(window.gtag, gtag, 'semantic mode must not replace the GTM queue');
  assert.equal(commands('config').length, 0, 'semantic mode must not configure GA a second time');
  assert.equal(commands('js').length, 0, 'semantic mode must not initialize GA a second time');
  assert.equal(document.querySelectorAll('#ga-script').length, 0, 'semantic mode must not inject another GA loader');
  const link = document.querySelector('a');
  link.addEventListener('click', (event) => event.preventDefault());
  link.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const lineEvents = () => window.dataLayer.filter((entry) => entry.event_name === 'line_oa_click');
  assert.equal(lineEvents().length, 1, 'remount must retain exactly one semantic click listener');
  assert.equal(lineEvents()[0].analytics_consent, 'granted');
  document.cookie = '_ga_test=synthetic; Path=/';
  await consent(false);
  assert.equal(document.cookie.includes('_ga_test='), false, 'revocation clears GA cookies');
  link.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(lineEvents().length, 1, 'denied consent suppresses LINE events');
  assert.equal(commands('consent').at(-1)[2].analytics_storage, 'denied');
  await consent(true);
  assert.equal(commands('config').length, 0, 'regrant must not configure GA again');
  assert.equal(document.querySelectorAll('#ga-script').length, 0);

  // Explicit labels only select approved CTA locations; pathname still owns surface.
  const clickFixture = (path, markup, expected) => {
    window.history.replaceState({}, '', path);
    const fixture = document.createElement('div');
    fixture.innerHTML = markup;
    document.body.appendChild(fixture);
    const anchor = fixture.querySelector('a');
    anchor.addEventListener('click', (event) => event.preventDefault());
    const before = lineEvents().length;
    anchor.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(lineEvents().length, before + (expected ? 1 : 0), `${path}: event count`);
    if (expected) {
      assert.equal(lineEvents().at(-1).cta_location, expected[0]);
      assert.equal(lineEvents().at(-1).surface_group, expected[1]);
    }
    fixture.remove();
  };
  clickFixture('/', '<section id="home"><a href="https://lin.ee/test" data-analytics-location="navbar">LINE</a></section>', ['navbar', 'homepage']);
  clickFixture('/', '<section><a href="https://lin.ee/test" data-analytics-location="home_faq" data-analytics-surface="blog">LINE</a></section>', ['home_faq', 'homepage']);
  clickFixture('/', '<nav id="mobile-navigation"><a href="https://lin.ee/test" data-analytics-location="navbar_mobile">LINE</a></nav>', ['navbar_mobile', 'homepage']);
  clickFixture('/', '<section id="home"><a href="https://lin.ee/test" data-analytics-location="untrusted">LINE</a></section>', ['home_hero', 'homepage']);
  clickFixture('/blog/life-insurance/example/', '<a href="https://lin.ee/test">LINE</a>', ['blog_article', 'blog']);
  clickFixture('/ci-planning/', '<section id="ci-calculator"><a href="https://lin.ee/test" data-analytics-location="navbar">LINE</a></section>', null);
  clickFixture('/tools/financial-health-check/', '<section id="fhc-calculator"><a href="https://lin.ee/test" data-analytics-location="home_faq">LINE</a></section>', null);
  clickFixture('/privacy/', '<a href="https://lin.ee/test" data-analytics-location="navbar">LINE</a>', null);
  clickFixture('/cookie-policy/', '<a href="https://lin.ee/test" data-analytics-location="navbar">LINE</a>', null);
  clickFixture('/missing/', '<a href="https://lin.ee/test" data-analytics-location="navbar">LINE</a>', null);

  process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED = 'false';
  await consent(true);
  assert.equal(document.querySelectorAll('#ga-script').length, 1, 'native fallback still loads GA');
  assert.deepEqual(commands('config'), [['config', gaId]]);
  await act(() => root.unmount());
  await mount();
  await consent(true);
  assert.equal(commands('config').length, 1, 'native remount and repeated consent must not reconfigure GA');
  await consent(false);
  assert.equal(document.querySelectorAll('#ga-script').length, 0);
  await act(() => root.unmount());
  await act(() => gtmRoot.unmount());
  // A returning visitor can reopen the unchanged consent UI from the Home footer.
  const CookieSettingsButton = require('../components/layout/CookieSettingsButton.tsx').default;
  const CookieConsent = require('../features/analytics/components/CookieConsent.tsx').default;
  const settingsRoot = createRoot(document.getElementById('root'));
  await act(() => settingsRoot.render(createElement('div', {}, createElement(CookieSettingsButton), createElement(CookieConsent))));
  assert.equal(document.querySelector('[aria-label="บันทึกการตั้งค่าคุกกี้"]'), null);
  await act(() => document.querySelector('#root button').click());
  const configure = document.querySelector('[aria-label="ตั้งค่าคุกกี้"]');
  assert.ok(configure, 'persisted consent must still allow reopening the banner');
  await act(() => configure.click());
  assert.ok(document.querySelector('[aria-label="บันทึกการตั้งค่าคุกกี้"]'), 'visitor can reopen editable consent controls');
  await act(() => settingsRoot.unmount());
  console.log('analytics component regression checks passed (semantic, consent, remount, native fallback)');
} finally {
  dom.window.close();
  delete process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED;
}
