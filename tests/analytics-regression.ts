import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getDeviceType, getGAAttribution } from '../lib/acquisition';
import { buildSemanticDataLayerEvent, CCPUN_SITE_VERSION, clearPendingAnalyticsEvents, flushPendingAnalyticsEvents, getCIPlanningPageVersion, resolveEventMapping, sanitizeEventParams, trackEvent } from '../lib/analytics';

assert.equal(CCPUN_SITE_VERSION, '4.0', 'Web 4.0 measurement version must stay explicit');
assert.equal(typeof getDeviceType(), 'string', 'device classification must remain safe outside a browser');
assert.ok(['mobile', 'tablet', 'desktop', 'unknown'].includes(getDeviceType()), 'device type must stay allowlisted');
const safe = sanitizeEventParams({ tool_name: 'ci_planning', step_number: 2, duration_seconds: 90, calculator_version: 'ci_planning_v6', page_version: 'ci_planning_v6', income: 50000, risk_level: 'high', assessment_version: 'ci_planning_v6' });
assert.deepEqual(safe, { tool_name: 'ci_planning', step_number: 2, duration_seconds: 90, calculator_version: 'ci_planning_v6', page_version: 'ci_planning_v6' }, 'only allowlisted non-sensitive CI metadata may be sent');
assert.deepEqual(sanitizeEventParams({ site_version: '4.0', tool_name: 'fhc', cta_location: 'fhc_result', surface_group: 'fhc', contact_channel: 'line', gap: 3200000 }), { site_version: '4.0', tool_name: 'fhc', contact_channel: 'line', cta_location: 'fhc_result', surface_group: 'fhc' }, 'FHC analytics must keep safe Web 4.0 context and discard calculator values');
assert.equal(sanitizeEventParams({ calculator_version: 'ci_planning_v999' }).calculator_version, undefined, 'unknown calculator versions must be discarded');
assert.equal(sanitizeEventParams({ page_version: 'unknown' }).page_version, undefined, 'unknown page versions must be discarded');
assert.ok(['ci_planning_v6', 'ci_planning_uat_v2'].includes(getCIPlanningPageVersion()), 'page version must stay allowlisted');
assert.deepEqual(resolveEventMapping('ci_calculator_start', safe), { ga: ['ci_calculator_start'], meta: 'custom', metaName: 'StartCIPlanning' }, 'CI start must use its canonical GA4 and Meta names');
assert.deepEqual(resolveEventMapping('ci_step_view', safe), { ga: ['ci_step_view'], meta: 'custom', metaName: 'CalculatorStep' }, 'CI step must use its canonical GA4 and Meta names');
assert.deepEqual(resolveEventMapping('ci_calculator_complete', safe), { ga: ['ci_calculator_complete'], meta: 'custom', metaName: 'CompleteCIPlanning' }, 'CI complete must use its canonical GA4 and Meta names');
assert.deepEqual(resolveEventMapping('ci_result_view', safe), { ga: ['ci_result_view'], meta: 'none' }, 'CI result view must stay GA4-only');
assert.deepEqual(resolveEventMapping('ci_contact_click', safe), { ga: ['ci_contact_click'], meta: 'standard', metaName: 'Contact' }, 'CI contact must use Meta Contact');
assert.deepEqual(resolveEventMapping('ci_landing_view', safe), { ga: ['ci_landing_view'], meta: 'none' }, 'CI landing must stay GA4-only');
assert.deepEqual(resolveEventMapping('ci_calculator_cta_click', safe), { ga: ['ci_calculator_cta_click'], meta: 'none' }, 'CI calculator CTA must stay GA4-only');
assert.deepEqual(resolveEventMapping('result_image_download', safe), { ga: ['ci_result_download'], meta: 'none' }, 'CI result downloads must use their canonical GA4 event only');
assert.deepEqual(resolveEventMapping('cta_click', sanitizeEventParams({ contact_channel: 'line' })), { ga: [], meta: 'none' }, 'legacy LINE CTA calls must stay suppressed');
assert.ok(!resolveEventMapping('tool_complete', safe).ga.some((event) => event.startsWith('tool_')), 'legacy CI calls must not emit tool_* events');

const fhcSafe = sanitizeEventParams({ site_version: '4.0', tool_name: 'fhc', cta_location: 'fhc_calculator', surface_group: 'fhc' });
assert.deepEqual(resolveEventMapping('fhc_calculator_start', fhcSafe), { ga: ['fhc_start'], meta: 'custom', metaName: 'StartFHC' }, 'FHC start must map to canonical GA4 and Meta names');
assert.deepEqual(resolveEventMapping('fhc_step_view', fhcSafe), { ga: ['fhc_step_view'], meta: 'custom', metaName: 'FHCStep' }, 'FHC step must map to canonical GA4 and Meta names');
assert.deepEqual(resolveEventMapping('fhc_calculator_complete', fhcSafe), { ga: ['fhc_complete'], meta: 'custom', metaName: 'CompleteFHC' }, 'FHC complete must map to canonical GA4 and Meta names');
assert.deepEqual(resolveEventMapping('fhc_result_view', fhcSafe), { ga: ['fhc_result_view'], meta: 'none' }, 'FHC result view must stay GA4-only');
assert.deepEqual(resolveEventMapping('fhc_contact_click', fhcSafe), { ga: ['fhc_contact_click'], meta: 'standard', metaName: 'Contact' }, 'FHC contact must use Meta Contact');
assert.ok(!resolveEventMapping('tool_complete', fhcSafe).ga.some((event) => event.startsWith('tool_')), 'legacy FHC calls must not emit tool_* events');

assert.deepEqual(getGAAttribution(), { traffic_source: 'direct' }, 'provider attribution must remain safe outside a browser');
assert.equal(buildSemanticDataLayerEvent('ci_calculator_start', safe, { analytics: true, social: true }), null, 'semantic event layer must remain off by default');
process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED = 'true';
assert.deepEqual(buildSemanticDataLayerEvent('ci_calculator_start', safe, { analytics: true, social: false }), {
  event: 'ccpun_event',
  event_name: 'ci_calculator_start',
  event_schema_version: 1,
  analytics_consent: 'granted',
  social_consent: 'denied',
  ...safe,
}, 'semantic event layer must be consent-labelled and contain only safe metadata');
assert.equal(buildSemanticDataLayerEvent('ci_calculator_start', safe, { analytics: false, social: false }), null, 'semantic event layer must fail closed without consent');
const acquisitionSource = readFileSync(new URL('../lib/acquisition.ts', import.meta.url), 'utf8');
assert.equal(acquisitionSource.includes('fbclid'), false, 'click identifiers must not be parsed, stored, or sent');
process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED = 'false';
let analyticsConsent = true;
const sent: unknown[][] = [];
const browser = { gtag: (...args: unknown[]) => { sent.push(args); } } as Window;
Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: () => JSON.stringify({ analytics: analyticsConsent, social: false, expires: Date.now() + 60000 }),
} });
try {
  const cta = { tool_name: 'ci_planning', cta_location: 'ci_landing' };
  for (const eventName of ['ci_calculator_cta_click', 'result_image_download']) {
    clearPendingAnalyticsEvents();
    sent.length = 0;
    for (let i = 0; i < 3; i++) trackEvent(eventName, cta);
    assert.equal(sent.length, 1, 'repeated duplicates must not reset page-lifetime dedupe');
  }
  clearPendingAnalyticsEvents();
  sent.length = 0;
  delete browser.gtag;
  trackEvent('ci_landing_view', cta);
  trackEvent('ci_calculator_cta_click', cta);
  trackEvent('ci_calculator_cta_click', cta);
  browser.gtag = (...args: unknown[]) => { sent.push(args); };
  flushPendingAnalyticsEvents('analytics');
  assert.deepEqual(sent.map((args) => args[1]), ['ci_landing_view', 'ci_calculator_cta_click'], 'a duplicate must preserve earlier queued events');
  delete browser.gtag;
  trackEvent('ci_result_view', cta);
  analyticsConsent = false;
  trackEvent('ci_landing_view', cta);
  analyticsConsent = true;
  browser.gtag = (...args: unknown[]) => { sent.push(args); };
  flushPendingAnalyticsEvents('analytics');
  assert.equal(sent.length, 2, 'revoking consent must discard queued events');
} finally {
  clearPendingAnalyticsEvents();
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'localStorage');
  delete process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED;
}
console.log('analytics regression checks passed');
