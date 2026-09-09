const CDP_HTTP = process.env.CDP_HTTP ?? 'http://127.0.0.1:9343';
const BASE_URL = process.env.TRACKING_BASE_URL ?? 'http://127.0.0.1:3006';
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? '';
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '';
const SEMANTIC_MODE = process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED === 'true';
// Provider requests are blocked below: semantic mode must leave GA initialization to GTM.
const APP_GA_COUNT = SEMANTIC_MODE ? 0 : 1;

if (!/^G-[A-Z0-9]+$/.test(GA_ID) || !/^\d{5,20}$/.test(META_PIXEL_ID)) {
  throw new Error('Set valid NEXT_PUBLIC_GA_ID and NEXT_PUBLIC_META_PIXEL_ID for this QA run.');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checks = [];

function expect(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

class CDPClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result ?? {});
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
    });
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ${method}`)), timeoutMs);
      const listener = (params) => {
        clearTimeout(timeout);
        this.listeners.set(method, (this.listeners.get(method) ?? []).filter((item) => item !== listener));
        resolve(params);
      };
      this.listeners.set(method, [...(this.listeners.get(method) ?? []), listener]);
    });
  }

  close() { this.ws?.close(); }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
}

async function navigate(client, path) {
  const loaded = client.once('Page.loadEventFired').catch(() => undefined);
  await client.send('Page.navigate', { url: `${BASE_URL}${path}` });
  await loaded;
  await sleep(1000);
}

async function inspect(client) {
  return evaluate(client, `(() => {
    const normalize = (row) => Array.isArray(row) || Object.prototype.toString.call(row) === '[object Arguments]' ? Array.from(row) : row;
    const dataLayer = (window.dataLayer ?? []).map(normalize);
    const googleCommandTypes = (window.dataLayer ?? []).filter((row) => ['consent', 'set', 'js', 'config', 'event'].includes(row?.[0])).map((row) => Object.prototype.toString.call(row));
    const fbq = (window.fbq?.queue ?? []).map(normalize);
    return {
      gaScripts: [...document.querySelectorAll('#ga-script')].map((item) => item.src),
      gtmScripts: [...document.querySelectorAll('#gtm-script')].map((item) => item.src),
      metaScripts: [...document.querySelectorAll('#meta-pixel-script')].map((item) => item.src),
      dataLayer,
      googleCommandTypes,
      fbq,
      consent: localStorage.getItem('ccpun_cookie_consent'),
      trackingResources: performance.getEntriesByType('resource').map((entry) => entry.name)
        .filter((name) => /google-analytics|googletagmanager|facebook|fbevents/.test(name)),
      trackingCookies: document.cookie.split(';').map((item) => item.trim().split('=')[0])
        .filter((name) => name.startsWith('_ga') || name.startsWith('_fb')),
    };
  })()`);
}

const isDataLayerEvent = (row, eventName) => Array.isArray(row)
  ? row[0] === 'event' && row[1] === eventName
  : row?.event === 'ccpun_event' && row?.event_name === eventName;
const dataLayerEventParams = (row) => {
  if (Array.isArray(row)) return row[2] ?? {};
  const params = { ...(row ?? {}) };
  for (const key of ['event', 'event_name', 'event_schema_version', 'analytics_consent', 'social_consent', 'gtm.uniqueEventId']) delete params[key];
  return params;
};

const target = await fetch(`${CDP_HTTP}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' }).then((response) => response.json());
const client = new CDPClient(target.webSocketDebuggerUrl);

try {
  await client.connect();
  await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Network.enable')]);
  await client.send('Storage.clearDataForOrigin', { origin: new URL(BASE_URL).origin, storageTypes: 'all' });
  await client.send('Network.clearBrowserCookies');
  // ponytail: block provider endpoints; this validates browser behavior without polluting real analytics.
  await client.send('Network.setBlockedURLs', { urls: [
    '*://*.google-analytics.com/*', '*://*.googletagmanager.com/*',
    '*://*.facebook.com/tr*', '*://connect.facebook.net/*',
  ] });

  await navigate(client, '/ci-planning/');
  let state = await inspect(client);
  expect('pre-consent stores no preference', state.consent === null);
  expect('pre-consent loads no GA script', state.gaScripts.length === 0);
  expect('pre-consent loads GTM-5DKMGSK3 once', state.gtmScripts.length === 1 && state.gtmScripts[0]?.includes('GTM-5DKMGSK3'));
  expect('pre-consent loads no Meta script', state.metaScripts.length === 0);
  expect('pre-consent creates no tracking cookie', state.trackingCookies.length === 0);
  const defaultConsent = state.dataLayer.find((row) => row[0] === 'consent' && row[1] === 'default')?.[2];
  expect('Google commands use the provider Arguments protocol', state.googleCommandTypes.length > 0 && state.googleCommandTypes.every((type) => type === '[object Arguments]'));
  const defaultConsentIndex = state.dataLayer.findIndex((row) => row[0] === 'consent' && row[1] === 'default');
  const gtmStartIndex = state.dataLayer.findIndex((row) => row.event === 'gtm.js');
  expect('consent default precedes GTM startup', defaultConsentIndex >= 0 && gtmStartIndex > defaultConsentIndex);
  expect('pre-consent defaults analytics storage to denied', defaultConsent?.analytics_storage === 'denied');
  expect('pre-consent defaults all advertising consent signals to denied',
    defaultConsent?.ad_storage === 'denied' && defaultConsent?.ad_user_data === 'denied' && defaultConsent?.ad_personalization === 'denied');

  const preConsentLineSetup = await evaluate(client, `(() => {
    document.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('a[href^="https://lin.ee/"]')) event.preventDefault();
    }, true);
    const link = document.querySelector('nav a[href^="https://lin.ee/"]');
    link?.click();
    return Boolean(link);
  })()`);
  state = await inspect(client);
  expect('pre-consent LINE test finds navbar CTA', preConsentLineSetup);
  expect('pre-consent LINE click emits no analytics event', !state.dataLayer.some((row) => isDataLayerEvent(row, 'line_oa_click')));

  await evaluate(client, `(() => {
    localStorage.setItem('ccpun_cookie_consent', JSON.stringify({status:'accepted_all',essential:true,performance:true,analytics:true,social:true,timestamp:new Date().toISOString(),expires:Date.now()+86400000}));
    window.dispatchEvent(new CustomEvent('ccpun:consent', {detail:'accepted'}));
    return true;
  })()`);
  await sleep(500);
  state = await inspect(client);
  expect('accepted consent respects GA initialization owner', state.gaScripts.length === APP_GA_COUNT);
  expect('accepted consent loads GTM-5DKMGSK3 once', state.gtmScripts.length === 1 && state.gtmScripts[0]?.includes('GTM-5DKMGSK3'));
  if (!SEMANTIC_MODE) expect('accepted consent uses expected GA property', state.gaScripts[0]?.includes(GA_ID), state.gaScripts[0] ?? '');
  expect('accepted consent loads one Meta script', state.metaScripts.length === 1);
  expect('Meta initializes expected dataset', state.fbq.some((row) => row[0] === 'init' && row[1] === META_PIXEL_ID));
  expect('CI PageView fires once', state.fbq.filter((row) => row[0] === 'track' && row[1] === 'PageView').length === 1);
  expect('CI ViewContent fires once', state.fbq.filter((row) => row[0] === 'track' && row[1] === 'ViewContent').length === 1);
  expect('GA config respects initialization owner', state.dataLayer.filter((row) => row[0] === 'config' && row[1] === GA_ID).length === APP_GA_COUNT);
  expect('first accepted consent emits ci_landing_view once', state.dataLayer.filter((row) => isDataLayerEvent(row, 'ci_landing_view')).length === 1);
  expect('accepted consent grants analytics storage', state.dataLayer.some((row) => row[0] === 'consent' && row[1] === 'update' && row[2]?.analytics_storage === 'granted'));
  expect('accepted consent keeps advertising consent denied', state.dataLayer.some((row) => row[0] === 'consent' && row[1] === 'update' && row[2]?.ad_storage === 'denied' && row[2]?.ad_user_data === 'denied' && row[2]?.ad_personalization === 'denied'));

  await evaluate(client, `window.dispatchEvent(new CustomEvent('ccpun:consent', {detail:'accepted'})); true`);
  await sleep(250);
  state = await inspect(client);
  expect('repeat consent does not duplicate GA script', state.gaScripts.length === APP_GA_COUNT);
  expect('repeat consent does not duplicate GTM script', state.gtmScripts.length === 1);
  expect('repeat consent does not duplicate Meta script', state.metaScripts.length === 1);
  expect('repeat consent does not duplicate CI PageView', state.fbq.filter((row) => row[0] === 'track' && row[1] === 'PageView').length === 1);
  expect('repeat accepted consent keeps ci_landing_view at one', state.dataLayer.filter((row) => isDataLayerEvent(row, 'ci_landing_view')).length === 1);

  const lineSurfaceSetup = await evaluate(client, `(() => {
    const originalPath = location.pathname;
    const nav = document.querySelector('nav');
    if (!nav) return false;
    const click = (path, parent) => {
      history.replaceState(history.state, '', path);
      const link = document.createElement('a');
      link.href = 'https://lin.ee/uat-line-test';
      parent.appendChild(link);
      link.click();
      link.remove();
    };

    history.replaceState(history.state, '', '/ci-planning/');
    document.querySelector('nav a[href^="https://lin.ee/"]')?.click();

    const mobileNav = document.createElement('div');
    mobileNav.id = 'mobile-navigation';
    nav.appendChild(mobileNav);
    click('/', mobileNav);
    mobileNav.remove();

    const hero = document.createElement('section');
    hero.id = 'home';
    document.body.appendChild(hero);
    click('/', hero);
    hero.remove();

    const contact = document.createElement('section');
    contact.dataset.uatSection = 'contact';
    document.body.appendChild(contact);
    click('/', contact);
    contact.remove();

    const fhcLanding = document.createElement('section');
    document.body.appendChild(fhcLanding);
    click('/tools/financial-health-check/', fhcLanding);
    fhcLanding.remove();

    const blogArticle = document.createElement('article');
    document.body.appendChild(blogArticle);
    click('/blog/uat-line-test/', blogArticle);
    blogArticle.remove();

    const excluded = document.createElement('section');
    document.body.appendChild(excluded);
    click('/privacy/', excluded);
    click('/cookie-policy/', excluded);
    excluded.remove();

    const toolResult = document.createElement('section');
    toolResult.id = 'fhc-calculator';
    document.body.appendChild(toolResult);
    click('/tools/financial-health-check/', toolResult);
    toolResult.remove();

    history.replaceState(history.state, '', originalPath);
    return true;
  })()`);
  await sleep(250);
  state = await inspect(client);
  const lineEvents = state.dataLayer.filter((row) => isDataLayerEvent(row, 'line_oa_click'));
  const lineLocations = lineEvents.map((row) => dataLayerEventParams(row).cta_location);
  expect('LINE surface test initialized', lineSurfaceSetup);
  expect('six active LINE surfaces emit once each', lineEvents.length === 6, JSON.stringify(lineLocations));
  for (const location of ['navbar', 'navbar_mobile', 'home_hero', 'home_contact', 'fhc_landing', 'blog_article']) {
    expect(`LINE location ${location} emits once`, lineLocations.filter((item) => item === location).length === 1);
  }
  expect('legacy navbar cta_click is suppressed', !state.dataLayer.some((row) => isDataLayerEvent(row, 'cta_click')));
  expect('tool result and policy links are not double counted', lineEvents.length === 6);
  expect('LINE events contain only safe context', lineEvents.every((row) => Object.keys(dataLayerEventParams(row)).every((key) => ['site_version', 'contact_channel', 'cta_location', 'surface_group'].includes(key))));
  expect('delegated LINE analytics does not add Meta Contact', !state.fbq.some((row) => (row[0] === 'track' || row[0] === 'trackCustom') && row[1] === 'Contact'));

  await evaluate(client, `(() => {
    localStorage.setItem('ccpun_cookie_consent', JSON.stringify({status:'custom',essential:true,performance:false,analytics:false,social:false,timestamp:new Date().toISOString(),expires:Date.now()+86400000}));
    window.dispatchEvent(new CustomEvent('ccpun:consent', {detail:'rejected'}));
    return true;
  })()`);
  await sleep(250);
  state = await inspect(client);
  expect('reject removes GA script', state.gaScripts.length === 0);
  expect('reject keeps one consent-aware GTM script', state.gtmScripts.length === 1);
  expect('reject removes Meta script', state.metaScripts.length === 0);
  expect('reject updates analytics storage to denied', state.dataLayer.some((row) => row[0] === 'consent' && row[1] === 'update' && row[2]?.analytics_storage === 'denied'));
  expect(
    'blocked QA sends no analytics hit',
    !state.trackingResources.some((url) => /google-analytics|facebook\.com\/tr/.test(url)),
    JSON.stringify(state.trackingResources),
  );
  expect('reject leaves no tracking cookie', state.trackingCookies.length === 0);

  await evaluate(client, `(() => {
    localStorage.setItem('ccpun_cookie_consent', JSON.stringify({status:'accepted_all',essential:true,performance:true,analytics:true,social:true,timestamp:new Date().toISOString(),expires:Date.now()+86400000}));
    return true;
  })()`);
  await navigate(client, '/tools/financial-health-check/');
  state = await inspect(client);
  expect('accepted consent emits fhc_landing_view once', state.dataLayer.filter((row) => isDataLayerEvent(row, 'fhc_landing_view')).length === 1);

  await evaluate(client, `window.dispatchEvent(new CustomEvent('ccpun:consent', {detail:'accepted'})); true`);
  await sleep(250);
  state = await inspect(client);
  expect('repeat accepted consent keeps fhc_landing_view at one', state.dataLayer.filter((row) => isDataLayerEvent(row, 'fhc_landing_view')).length === 1);

  for (const privatePath of ['/snt-admin/', '/studio/']) {
    await navigate(client, privatePath);
    state = await inspect(client);
    expect(`${privatePath} loads no public tracking tags`, state.gtmScripts.length === 0 && state.gaScripts.length === 0 && state.metaScripts.length === 0);
  }
} finally {
  client.close();
  await fetch(`${CDP_HTTP}/json/close/${target.id}`, { method: 'PUT' }).catch(() => undefined);
}

const failed = checks.filter((check) => !check.pass);
console.log(`\nTracking consent QA: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exitCode = 1;
