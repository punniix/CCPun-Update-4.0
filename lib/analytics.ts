import { getConsentData } from './cookie-consent';
import { getDeviceType, getGAAttribution } from './acquisition';

export interface MetaPixelFunction {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: MetaPixelFunction;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: MetaPixelFunction;
    _fbq?: MetaPixelFunction;
  }
}

export type EventParams = Record<string, unknown>;
type SafeParams = Record<string, string | number>;
type MetaMode = 'custom' | 'standard' | 'none';
export type ConsentState = { analytics: boolean; social: boolean };
const pendingGA: Array<[string, SafeParams]> = [];
const pendingMeta: Array<[Exclude<MetaMode, 'none'>, string, SafeParams]> = [];
const MAX_PENDING = 50;
const gaEventScopes = new Set<string>();
const CI_PAGE_VERSIONS = new Set(['ci_planning_v6', 'ci_planning_uat_v2']);
export const CCPUN_SITE_VERSION = '4.0';

const ALLOWED_STRINGS: Record<string, Set<string> | RegExp> = {
  site_version: new Set(['4.0']),
  tool_name: new Set(['ci_planning', 'fhc', 'money_story']),
  step_name: new Set(['risk_assessment', 'expenses', 'existing_ci', 'risk_handling']),
  contact_channel: new Set(['facebook_inbox', 'line']),
  // Approved editorial/campaign dimensions only; never include free-form user text.
  method: new Set(['line', 'facebook', 'x', 'copy']),
  content_type: new Set(['article']),
  share_placement: new Set(['header', 'footer']),
  campaign_id: new Set(['aia_health_happy_2026']),
  campaign_placement: new Set(['home', 'blog', 'article']),
  campaign_action: new Set(['line', 'article', 'read_details']),
  cta_location: new Set(['ci_landing', 'ci_calculator', 'ci_result', 'fhc_landing', 'fhc_calculator', 'fhc_result', 'navbar', 'navbar_mobile', 'home_hero', 'home_faq', 'home_contact', 'blog_article', 'countdown', 'chat_panel', 'chat_button', 'tools_hub']),
  surface_group: new Set(['homepage', 'ci_planning', 'fhc', 'blog', 'money_story', 'tools']),
  // LINE chat button (owner-approved 2026-10-25, L5): owner-defined tokens only, never the chat text.
  chat_topic_id: /^[a-z0-9][a-z0-9-]{1,39}$/,
  page_group: new Set(['home', 'blog_index', 'blog_category', 'article', 'tool_ci', 'tool_fhc', 'tool_money_story', 'tool_investment_allocation', 'tools_hub', 'about', 'coming_soon', 'default']),
  // Coming Soon (owner-approved 2026-10-25): the planned path only, as registered in lib/content/coming-soon.ts.
  coming_soon_path: /^\/tools\/[a-z0-9][a-z0-9-]{1,60}\/$/,
  campaign_code: /^[a-z0-9][a-z0-9_-]{1,63}$/,
  // Which control opened the LINE chat panel (owner-approved 2026-10-25): the dock or an article-body LINE CTA.
  panel_trigger: new Set(['dock', 'article_cta']),
  // C12: registered internal IDs only, never CMS text, prefill, answers or customer values.
  topic: new Set(['check-existing-policy', 'health-plan', 'tax-deduction', 'smart-network-hospital', 'which-plan-fits', 'ci-result-chat', 'ci-plan', 'book-a-chat', 'fhc-result-chat', 'life-cover', 'investment-before', 'fund-allocation', 'motor-quote', 'money-plan', 'type-own']),
  page_type: new Set(['home', 'blog_index', 'blog_category', 'article', 'tool_ci', 'tool_fhc', 'tool_money_story', 'tool_investment_allocation', 'tools_hub', 'about', 'coming_soon', 'default']),
  calculator_version: new Set(['ci_planning_v6', 'ci_planning_v7_recovery_sources_2025_2026']),
  page_version: CI_PAGE_VERSIONS,
  utm_source: /^[a-z0-9][a-z0-9_-]{0,63}$/,
  utm_medium: /^[a-z0-9][a-z0-9_-]{0,63}$/,
  utm_campaign: /^[a-z0-9][a-z0-9_-]{0,63}$/,
  utm_content: /^[a-z0-9][a-z0-9_-]{0,63}$/,
  utm_term: /^[a-z0-9][a-z0-9_-]{0,63}$/,
  traffic_source: /^[a-z0-9][a-z0-9_-]{0,63}$/,
  referrer: /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
  device_type: new Set(['mobile', 'tablet', 'desktop', 'unknown']),
};

export function sanitizeEventParams(params: EventParams): SafeParams {
  const safe: SafeParams = {};
  for (const [key, allowed] of Object.entries(ALLOWED_STRINGS)) {
    const value = params[key];
    if (typeof value === 'string' && (allowed instanceof RegExp ? allowed.test(value) : allowed.has(value))) safe[key] = value;
  }
  for (const key of ['step_number', 'duration_seconds'] as const) {
    const value = params[key];
    const max = key === 'duration_seconds' ? 1800 : 20;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max) safe[key] = value;
  }
  return safe;
}

export function getCIPlanningPageVersion(): string {
  const configured = process.env.NEXT_PUBLIC_CI_PLANNING_PAGE_VERSION;
  return configured && CI_PAGE_VERSIONS.has(configured) ? configured : 'ci_planning_v6';
}

export function resolveEventMapping(eventName: string, params: SafeParams): { ga: string[]; meta: MetaMode; metaName?: string } {
  const ci = params.tool_name === 'ci_planning';
  const fhc = params.tool_name === 'fhc';
  if (eventName === 'cta_click' && params.contact_channel === 'line') return { ga: [], meta: 'none' };
  if (eventName === 'line_oa_click' && params.contact_channel === 'line') return { ga: ['line_oa_click'], meta: 'none' };
  if (eventName === 'line_chat_qr_view') return { ga: ['line_chat_qr_view'], meta: 'none' };
  if (eventName === 'line_chat_panel_open') return { ga: ['line_chat_panel_open'], meta: 'none' };
  if (eventName === 'ci_landing_view' && ci) return { ga: ['ci_landing_view'], meta: 'none' };
  if ((eventName === 'ci_calculator_start' || eventName === 'tool_start') && ci) return { ga: ['ci_calculator_start'], meta: 'custom', metaName: 'StartCIPlanning' };
  if ((eventName === 'ci_step_view' || eventName === 'tool_step') && ci) return { ga: ['ci_step_view'], meta: 'custom', metaName: 'CalculatorStep' };
  if ((eventName === 'ci_calculator_complete' || eventName === 'tool_complete') && ci) return { ga: ['ci_calculator_complete'], meta: 'custom', metaName: 'CompleteCIPlanning' };
  if (eventName === 'ci_result_view' && ci) return { ga: ['ci_result_view'], meta: 'none' };
  if (eventName === 'ci_calculator_cta_click' && ci) return { ga: ['ci_calculator_cta_click'], meta: 'none' };
  if (eventName === 'result_image_download' && ci) return { ga: ['ci_result_download'], meta: 'none' };
  if (eventName === 'ci_contact_click' && ci) return { ga: ['ci_contact_click'], meta: 'standard', metaName: 'Contact' };
  if (eventName === 'fhc_landing_view' && fhc) return { ga: ['fhc_landing_view'], meta: 'none' };
  if ((eventName === 'fhc_calculator_start' || eventName === 'fhc_start' || eventName === 'tool_start') && fhc) return { ga: ['fhc_start'], meta: 'custom', metaName: 'StartFHC' };
  if ((eventName === 'fhc_step_view' || eventName === 'tool_step') && fhc) return { ga: ['fhc_step_view'], meta: 'custom', metaName: 'FHCStep' };
  if ((eventName === 'fhc_calculator_complete' || eventName === 'fhc_complete' || eventName === 'tool_complete') && fhc) return { ga: ['fhc_complete'], meta: 'custom', metaName: 'CompleteFHC' };
  if (eventName === 'fhc_result_view' && fhc) return { ga: ['fhc_result_view'], meta: 'none' };
  if (eventName === 'fhc_contact_click' && fhc) return { ga: ['fhc_contact_click'], meta: 'standard', metaName: 'Contact' };
  return { ga: [eventName], meta: 'none' };
}

function metaParams(params: SafeParams): SafeParams {
  const { site_version, tool_name, step_name, step_number, cta_location, surface_group, contact_channel, calculator_version, page_version } = params;
  return sanitizeEventParams({ site_version, tool_name, step_name, step_number, cta_location, surface_group, contact_channel, calculator_version, page_version });
}

function isNewGAEventScope(eventName: string, params: SafeParams): boolean {
  if (eventName !== 'ci_calculator_cta_click' && eventName !== 'result_image_download') return true;
  const scope = `${eventName}:${params.tool_name ?? ''}:${params.cta_location ?? ''}`;
  if (gaEventScopes.has(scope)) return false;
  // ponytail: page-lifetime dedupe; add an explicit calculator-run scope only if repeat exports need measuring.
  gaEventScopes.add(scope);
  return true;
}

function enqueue<T>(queue: T[], event: T): void {
  if (queue.length >= MAX_PENDING) queue.shift();
  queue.push(event);
}

export function clearPendingAnalyticsEvents(category?: 'analytics' | 'social'): void {
  if (!category || category === 'analytics') {
    pendingGA.length = 0;
    gaEventScopes.clear();
  }
  if (!category || category === 'social') pendingMeta.length = 0;
}

export function buildSemanticDataLayerEvent(eventName: string, params: SafeParams, consent: ConsentState): Record<string, string | number | null> | null {
  if (process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED !== 'true') return null;
  if (!consent.analytics && !consent.social) return null;
  return {
    event: 'ccpun_event',
    event_name: eventName,
    event_schema_version: 1,
    analytics_consent: consent.analytics ? 'granted' : 'denied',
    social_consent: consent.social ? 'granted' : 'denied',
    // ponytail: clear optional event dimensions because GTM's data model retains omitted keys.
    tool_name: null,
    surface_group: null,
    cta_location: null,
    contact_channel: null,
    step_name: null,
    step_number: null,
    duration_seconds: null,
    calculator_version: null,
    page_version: null,
    method: null,
    content_type: null,
    share_placement: null,
    campaign_id: null,
    campaign_placement: null,
    campaign_action: null,
    chat_topic_id: null,
    page_group: null,
    campaign_code: null,
    panel_trigger: null,
    topic: null,
    page_type: null,
    coming_soon_path: null,
    ...params,
  };
}

export function flushPendingAnalyticsEvents(category: 'analytics' | 'social'): void {
  if (typeof window === 'undefined') return;
  const consent = getConsentData();
  if (category === 'analytics') {
    if (!consent?.analytics) return clearPendingAnalyticsEvents('analytics');
    if (typeof window.gtag !== 'function') return;
    pendingGA.splice(0).forEach(([event, params]) => window.gtag?.('event', event, params));
    return;
  }
  if (!consent?.social) return clearPendingAnalyticsEvents('social');
  if (typeof window.fbq !== 'function') return;
  pendingMeta.splice(0).forEach(([mode, event, params]) => window.fbq?.(mode === 'standard' ? 'track' : 'trackCustom', event, params));
}

/** Consent-gated, allowlisted event dispatcher. Calculator answers and values are discarded. */
export function trackEvent(eventName: string, params: EventParams = {}): void {
  if (typeof window === 'undefined') return;
  const consent = getConsentData();
  if (!consent) return;
  // C12 is GA4-only: social permission alone must never enqueue or emit this event.
  if (eventName === 'line_chat_qr_view' && consent.analytics !== true) return;
  const sanitized = sanitizeEventParams({ ...params, site_version: CCPUN_SITE_VERSION });
  const safe = sanitized.tool_name === 'ci_planning'
    ? sanitizeEventParams({ ...sanitized, page_version: getCIPlanningPageVersion() })
    : sanitized;
  const event = resolveEventMapping(eventName, safe);
  if (!event.ga.length && event.meta === 'none') return;
  const semanticEvent = buildSemanticDataLayerEvent(eventName, safe, consent);
  if (semanticEvent) {
    // ponytail: one cutover flag keeps destination ownership singular.
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push(semanticEvent);
    return;
  }
  if (consent.analytics && isNewGAEventScope(eventName, safe)) {
    const gaParams = safe.tool_name === 'ci_planning'
      ? sanitizeEventParams({ ...safe, ...getGAAttribution(), device_type: getDeviceType() })
      : safe;
    for (const name of event.ga) {
      if (typeof window.gtag === 'function') window.gtag('event', name, gaParams);
      else enqueue(pendingGA, [name, gaParams]);
    }
  } else if (!consent.analytics) clearPendingAnalyticsEvents('analytics');
  if (consent.social && event.meta !== 'none' && event.metaName) {
    const safeMeta = metaParams(safe);
    if (typeof window.fbq === 'function') window.fbq(event.meta === 'standard' ? 'track' : 'trackCustom', event.metaName, safeMeta);
    else enqueue(pendingMeta, [event.meta, event.metaName, safeMeta]);
  } else if (!consent.social) clearPendingAnalyticsEvents('social');
}
