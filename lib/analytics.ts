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
  tool_name: new Set(['ci_planning', 'fhc']),
  step_name: new Set(['risk_assessment', 'expenses', 'existing_ci', 'risk_handling']),
  contact_channel: new Set(['facebook_inbox', 'line']),
  cta_location: new Set(['ci_landing', 'ci_calculator', 'ci_result', 'fhc_landing', 'fhc_calculator', 'fhc_result', 'navbar', 'navbar_mobile', 'home_hero', 'home_faq', 'home_contact', 'blog_article']),
  surface_group: new Set(['homepage', 'ci_planning', 'fhc', 'blog']),
  calculator_version: new Set(['ci_planning_v6']),
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

export function buildSemanticDataLayerEvent(eventName: string, params: SafeParams, consent: ConsentState): Record<string, string | number> | null {
  if (process.env.NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED !== 'true') return null;
  if (!consent.analytics && !consent.social) return null;
  return {
    event: 'ccpun_event',
    event_name: eventName,
    event_schema_version: 1,
    analytics_consent: consent.analytics ? 'granted' : 'denied',
    social_consent: consent.social ? 'granted' : 'denied',
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
  if (consent.analytics) {
    if (isNewGAEventScope(eventName, safe)) {
      const gaParams = safe.tool_name === 'ci_planning'
        ? sanitizeEventParams({ ...safe, ...getGAAttribution(), device_type: getDeviceType() })
        : safe;
      for (const name of event.ga) {
        if (typeof window.gtag === 'function') window.gtag('event', name, gaParams);
        else enqueue(pendingGA, [name, gaParams]);
      }
    }
  } else if (!consent.analytics) clearPendingAnalyticsEvents('analytics');
  if (consent.social && event.meta !== 'none' && event.metaName) {
    const safeMeta = metaParams(safe);
    if (typeof window.fbq === 'function') window.fbq(event.meta === 'standard' ? 'track' : 'trackCustom', event.metaName, safeMeta);
    else enqueue(pendingMeta, [event.meta, event.metaName, safeMeta]);
  } else if (!consent.social) clearPendingAnalyticsEvents('social');
}
