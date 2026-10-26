import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  tool_name: safe.tool_name,
  surface_group: null,
  cta_location: null,
  contact_channel: null,
  step_name: null,
  step_number: safe.step_number,
  duration_seconds: safe.duration_seconds,
  calculator_version: safe.calculator_version,
  page_version: safe.page_version,
  method: null,
  content_type: null,
  share_placement: null,
  campaign_id: null,
  campaign_placement: null,
  campaign_action: null,
  // Owner-approved 2026-10-25 (L5): the LINE chat dimensions are cleared on every event too.
  chat_topic_id: null,
  page_group: null,
  campaign_code: null,
  // Owner-approved 2026-10-25: which control opened the chat panel is cleared on every event too.
  panel_trigger: null,
  topic: null,
  page_type: null,
  // Owner-approved 2026-10-25 (Coming Soon): the planned-path dimension is cleared on every event too.
  coming_soon_path: null,
}, 'semantic event layer must be consent-labelled and contain only safe metadata');
assert.equal(buildSemanticDataLayerEvent('ci_calculator_start', safe, { analytics: false, social: false }), null, 'semantic event layer must fail closed without consent');
const semanticModel: Record<string, string | number | null> = {};
const applySemanticEvent = (eventName: string, params: Parameters<typeof buildSemanticDataLayerEvent>[1]) => {
  Object.assign(semanticModel, buildSemanticDataLayerEvent(eventName, params, { analytics: true, social: false }));
};
applySemanticEvent('health_happy_countdown_click', sanitizeEventParams({ campaign_id: 'aia_health_happy_2026', campaign_placement: 'article', campaign_action: 'line' }));
assert.equal(semanticModel.campaign_id, 'aia_health_happy_2026', 'campaign event keeps its own approved attribution');
applySemanticEvent('line_oa_click', sanitizeEventParams({ contact_channel: 'line', cta_location: 'navbar' }));
for (const key of ['campaign_id', 'campaign_placement', 'campaign_action']) {
  assert.equal(semanticModel[key], null, `an unrelated LINE event must clear preceding ${key}`);
}
applySemanticEvent('share', sanitizeEventParams({ method: 'copy', content_type: 'article', share_placement: 'footer' }));
assert.equal(semanticModel.method, 'copy', 'share event keeps its own approved method');
applySemanticEvent('health_happy_countdown_view', sanitizeEventParams({ campaign_id: 'aia_health_happy_2026' }));
for (const key of ['method', 'content_type', 'share_placement']) {
  assert.equal(semanticModel[key], null, `a countdown event must clear preceding ${key}`);
}
applySemanticEvent('ci_step_view', sanitizeEventParams({ ...safe, step_name: 'expenses', traffic_source: 'organic', device_type: 'desktop' }));
applySemanticEvent('line_oa_click', sanitizeEventParams({ contact_channel: 'line', cta_location: 'navbar', surface_group: 'homepage' }));
assert.equal(semanticModel.cta_location, 'navbar', 'LINE keeps its own approved CTA context');
applySemanticEvent('share', sanitizeEventParams({ method: 'copy', content_type: 'article', share_placement: 'footer' }));
for (const key of ['tool_name', 'surface_group', 'cta_location', 'contact_channel', 'step_name', 'step_number', 'duration_seconds', 'calculator_version', 'page_version']) {
  assert.equal(semanticModel[key], null, `share must clear preceding event-local ${key}`);
}
assert.equal(semanticModel.traffic_source, 'organic', 'event-local resets must preserve first-touch acquisition context');
assert.equal(semanticModel.device_type, 'desktop', 'event-local resets must preserve device context');
applySemanticEvent('health_happy_countdown_view', sanitizeEventParams({ campaign_id: 'aia_health_happy_2026', campaign_placement: 'blog', surface_group: 'blog' }));
assert.equal(semanticModel.cta_location, null, 'countdown view must not inherit the preceding LINE CTA');
assert.equal(semanticModel.contact_channel, null, 'countdown view must not inherit a contact action');
assert.equal(semanticModel.surface_group, 'blog', 'countdown keeps its own approved surface');

// LINE chat button (owner-approved 2026-10-25, L5): one new event and three safe line_oa_click tokens.
// Existing event names and mappings above stay byte-identical.
assert.deepEqual(resolveEventMapping('line_chat_panel_open', sanitizeEventParams({ page_group: 'home' })), { ga: ['line_chat_panel_open'], meta: 'none' }, 'chat panel open is GA4-only');
assert.deepEqual(resolveEventMapping('line_oa_click', sanitizeEventParams({ contact_channel: 'line', cta_location: 'chat_panel' })), { ga: ['line_oa_click'], meta: 'none' }, 'chat topic clicks keep the existing line_oa_click event');
assert.deepEqual(
  sanitizeEventParams({ contact_channel: 'line', cta_location: 'chat_panel', surface_group: 'blog', chat_topic_id: 'smart-network-hospital', page_group: 'article', campaign_code: 'smartnetwork-2611', prefill: 'อยากเช็กโรงพยาบาล 0812345678', text: 'free text' }),
  { contact_channel: 'line', cta_location: 'chat_panel', surface_group: 'blog', chat_topic_id: 'smart-network-hospital', page_group: 'article', campaign_code: 'smartnetwork-2611' },
  'chat clicks send owner-defined tokens only: never the prefill text or anything a person typed',
);
for (const [key, value] of [['chat_topic_id', 'Has Spaces'], ['chat_topic_id', 'โรงพยาบาล'], ['page_group', 'article:secret-slug'], ['page_group', 'category:health-insurance'], ['campaign_code', 'https://evil.example'], ['campaign_code', 'a'], ['cta_location', 'chat_anything']] as const) {
  assert.equal(sanitizeEventParams({ [key]: value })[key], undefined, `${key}=${value} must be discarded`);
}
// panel_trigger (owner-approved 2026-10-25): only the two named controls, nothing free-form.
for (const trigger of ['dock', 'article_cta']) {
  assert.equal(sanitizeEventParams({ panel_trigger: trigger }).panel_trigger, trigger, `approved panel trigger ${trigger}`);
}
for (const value of ['Dock', 'article', 'header', 'https://evil.example', 'อยากคุย', '']) {
  assert.equal(sanitizeEventParams({ panel_trigger: value }).panel_trigger, undefined, `panel_trigger=${value} must be discarded`);
}
assert.deepEqual(resolveEventMapping('line_chat_panel_open', sanitizeEventParams({ page_group: 'article', panel_trigger: 'article_cta' })), { ga: ['line_chat_panel_open'], meta: 'none' }, 'the trigger never changes the GA4-only mapping');
for (const location of ['chat_panel', 'chat_button', 'tools_hub']) {
  assert.equal(sanitizeEventParams({ cta_location: location }).cta_location, location, `approved CTA location ${location}`);
}
assert.equal(sanitizeEventParams({ surface_group: 'tools' }).surface_group, 'tools', 'the /tools/ hub has its own approved surface');
// AIA fund tool (2026-10-26): its LINE clicks reuse the existing line_oa_click with the main tool's "tools" surface.
// Exact before -> after admission: removing only the AIA clause restores the previous reviewed successor byte for byte.
{
  const gaSource = readFileSync('features/analytics/components/GoogleAnalytics.tsx', 'utf8');
  const aiaClause = " || path.startsWith('/tools/aia-fund-allocation')";
  assert.equal(gaSource.split(aiaClause).length, 2, 'the AIA path clause occurs exactly once');
  assert.match(gaSource, /: path === '\/tools' \|\| path === '\/tools\/' \|\| path\.startsWith\('\/tools\/investment-allocation'\) \|\| path\.startsWith\('\/tools\/aia-fund-allocation'\) \? 'tools'\n/, 'the AIA fund tool joins the existing tools surface, nothing else');
  assert.equal(createHash('sha256').update(gaSource.replace(aiaClause, '')).digest('hex'), '8d615a8b3fb1dc2505c1c310e1a162b66895d0c8fc5a94a7c7ae314dedb66206', 'no other GoogleAnalytics.tsx byte changed');
  assert.match(gaSource, /trackEvent\('line_oa_click', \{/, 'the event name is unchanged');
}
{
  const model: Record<string, string | number | null> = {};
  Object.assign(model, buildSemanticDataLayerEvent('line_oa_click', sanitizeEventParams({ contact_channel: 'line', cta_location: 'chat_panel', chat_topic_id: 'tax-deduction', page_group: 'home', campaign_code: 'bio-facebook' }), { analytics: true, social: false }));
  assert.equal(model.chat_topic_id, 'tax-deduction');
  Object.assign(model, buildSemanticDataLayerEvent('line_oa_click', sanitizeEventParams({ contact_channel: 'line', cta_location: 'navbar' }), { analytics: true, social: false }));
  for (const key of ['chat_topic_id', 'page_group', 'campaign_code']) assert.equal(model[key], null, `a later LINE click must clear the preceding ${key}`);
  Object.assign(model, buildSemanticDataLayerEvent('line_chat_panel_open', sanitizeEventParams({ page_group: 'article', panel_trigger: 'article_cta' }), { analytics: true, social: false }));
  assert.equal(model.panel_trigger, 'article_cta');
  Object.assign(model, buildSemanticDataLayerEvent('line_oa_click', sanitizeEventParams({ contact_channel: 'line', cta_location: 'chat_panel' }), { analytics: true, social: false }));
  assert.equal(model.panel_trigger, null, 'a later event must clear the preceding panel_trigger');
}

// Coming Soon (owner-approved 2026-10-25): one new GA4-only event carrying only the registered planned path.
assert.deepEqual(resolveEventMapping('coming_soon_interest', sanitizeEventParams({ coming_soon_path: '/tools/tax-deduction/' })), { ga: ['coming_soon_interest'], meta: 'none' });
assert.deepEqual(sanitizeEventParams({ coming_soon_path: '/tools/tax-deduction/', email: 'a@b.co', phone: '0800000000' }), { coming_soon_path: '/tools/tax-deduction/' }, 'the interest event never carries personal data');
for (const value of ['/tools/x/?email=a@b.co', 'https://ccpun.com/tools/x/', '/blog/a/b/']) assert.equal(sanitizeEventParams({ coming_soon_path: value }).coming_soon_path, undefined, value);
assert.equal(sanitizeEventParams({ page_group: 'coming_soon' }).page_group, 'coming_soon', 'Coming Soon chat panels have their own page group');

// C12: only registered topic/page tokens survive; QR views preserve outbound LINE semantics.
const qrSafe = sanitizeEventParams({ panel_trigger: 'dock', topic: 'health-plan', cta_location: 'chat_panel', page_type: 'home', prefill: 'private', income: 90000, answers: { health: 'private' }, email: 'private@example.com', phone: '0812345678' });
assert.deepEqual(qrSafe, { cta_location: 'chat_panel', panel_trigger: 'dock', topic: 'health-plan', page_type: 'home' });
assert.deepEqual(resolveEventMapping('line_chat_qr_view', qrSafe), { ga: ['line_chat_qr_view'], meta: 'none' });
assert.deepEqual(resolveEventMapping('line_chat_panel_open', qrSafe), { ga: ['line_chat_panel_open'], meta: 'none' });
for (const key of ['topic', 'page_type']) for (const value of ['private@example.com', '0812345678', '90000', 'name-alice', 'health-plan?email=x', 'custom-customer-value', '', 123]) {
  assert.equal(sanitizeEventParams({ [key]: value })[key], undefined, `${key} must reject personal/unregistered values`);
}
const qrModel: Record<string, string | number | null> = {};
Object.assign(qrModel, buildSemanticDataLayerEvent('line_chat_qr_view', qrSafe, { analytics: true, social: false }));
assert.equal(qrModel.topic, 'health-plan');
assert.equal(qrModel.page_type, 'home');
Object.assign(qrModel, buildSemanticDataLayerEvent('line_chat_panel_open', {}, { analytics: true, social: false }));
assert.equal(qrModel.topic, null, 'later events clear QR topic');
assert.equal(qrModel.page_type, null, 'later events clear QR page type');

const acquisitionSource = readFileSync(new URL('../lib/acquisition.ts', import.meta.url), 'utf8');
assert.equal(acquisitionSource.includes('fbclid'), false, 'click identifiers must not be parsed, stored, or sent');
process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED = 'false';
let analyticsConsent = true;
let socialConsent = false;
const sent: unknown[][] = [];
const browser = { gtag: (...args: unknown[]) => { sent.push(args); } } as Window;
Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: () => JSON.stringify({ analytics: analyticsConsent, social: socialConsent, expires: Date.now() + 60000 }),
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

  // An unapproved calculator_version (the current CI v11 constant) drops only that
  // parameter; the allowlisted event itself must still be dispatched.
  clearPendingAnalyticsEvents();
  sent.length = 0;
  trackEvent('ci_calculator_start', { tool_name: 'ci_planning', cta_location: 'ci_calculator', calculator_version: 'ci_planning_v11_asset_protection_2026' });
  assert.deepEqual(sent.map((args) => args[1]), ['ci_calculator_start'], 'unknown calculator_version must not drop the event');
  assert.equal((sent[0][2] as Record<string, unknown>).calculator_version, undefined, 'unknown calculator_version value must not be sent');

  // Production GTM routes GA4 custom events only from the semantic ccpun_event contract
  // (2026-10-03 Hostinger outage: the flag was missing, so nothing reached that tag).
  process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED = 'true';
  clearPendingAnalyticsEvents();
  sent.length = 0;
  browser.dataLayer = [];
  trackEvent('ci_landing_view', { tool_name: 'ci_planning', cta_location: 'ci_landing', calculator_version: 'ci_planning_v11_asset_protection_2026' });
  trackEvent('line_oa_click', { contact_channel: 'line', cta_location: 'navbar', surface_group: 'ci_planning', phone: '0800000000' });
  const semanticRows = browser.dataLayer as Array<Record<string, unknown>>;
  assert.deepEqual(semanticRows.map((row) => [row.event, row.event_name, row.event_schema_version, row.analytics_consent]), [
    ['ccpun_event', 'ci_landing_view', 1, 'granted'],
    ['ccpun_event', 'line_oa_click', 1, 'granted'],
  ], 'semantic mode must hand CI landing and LINE events to the GTM ccpun_event tag');
  assert.equal(sent.length, 0, 'semantic mode keeps a single destination owner');
  assert.equal(semanticRows[1].cta_location, 'navbar');
  assert.ok(!JSON.stringify(semanticRows).includes('0800000000'), 'personal data must never reach the dataLayer');
  analyticsConsent = false;
  trackEvent('line_oa_click', { contact_channel: 'line', cta_location: 'navbar', surface_group: 'ci_planning' });
  assert.equal(semanticRows.length, 2, 'semantic mode must stay consent-gated');
  trackEvent('line_chat_panel_open', { page_group: 'home' });
  assert.equal(semanticRows.length, 2, 'the new chat panel event is consent-gated like every other event');
  trackEvent('line_chat_panel_open', { page_group: 'article', panel_trigger: 'article_cta' });
  assert.equal(semanticRows.length, 2, 'panel_trigger does not bypass consent');
  analyticsConsent = true;
  trackEvent('line_chat_panel_open', { page_group: 'home', campaign_code: 'bio-facebook' });
  assert.deepEqual([semanticRows[2].event_name, semanticRows[2].page_group, semanticRows[2].campaign_code], ['line_chat_panel_open', 'home', 'bio-facebook']);
  trackEvent('line_chat_panel_open', { page_group: 'article', panel_trigger: 'article_cta' });
  assert.deepEqual([semanticRows[3].event_name, semanticRows[3].page_group, semanticRows[3].panel_trigger, semanticRows[3].campaign_code], ['line_chat_panel_open', 'article', 'article_cta', null]);
  for (const semantic of ['true', 'false']) {
    process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED = semantic;
    clearPendingAnalyticsEvents();
    sent.length = 0;
    browser.dataLayer = [];
    analyticsConsent = false;
    delete browser.gtag;
    trackEvent('line_chat_qr_view', qrSafe);
    socialConsent = true;
    trackEvent('line_chat_qr_view', qrSafe);
    socialConsent = false;
    analyticsConsent = true;
    browser.gtag = (...args: unknown[]) => { sent.push(args); };
    flushPendingAnalyticsEvents('analytics');
    assert.equal(sent.length, 0, 'denied QR views never queue/replay');
    assert.equal(browser.dataLayer.length, 0, 'denied QR views never emit semantic rows');
    trackEvent('line_chat_qr_view', qrSafe);
    assert.equal(semantic === 'true' ? browser.dataLayer.length : sent.length, 1, 'permitted QR views use the existing destination mode');
  }
} finally {
  clearPendingAnalyticsEvents();
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'localStorage');
  delete process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED;
}
console.log('analytics regression checks passed');
