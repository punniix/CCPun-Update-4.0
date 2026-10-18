import "server-only";
import { ZodError } from "zod";

import {
  ga4QueryInputSchema,
  normalizeGa4LandingPageReport,
  normalizeGa4OrganicTotalsReport,
  type Ga4LandingPageRow,
  type Ga4MetricTotals,
} from "../contracts";

const TIMEOUT_MS = 15_000;
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type Ga4HeaderFailurePhase = `schema-headers-${"landing" | "totals"}-${"dimension" | "metric"}-${"missing" | "null" | "nonarray" | "name-invalid" | "other"}`;
type Ga4FailurePhase = Ga4HeaderFailurePhase | "fetch" | "http" | "decode" | "schema-headers" | "schema-dimension-value" | "schema-metric-value" | "schema-row-count" | "schema-metadata" | "schema-other" | "normalize-headers" | "normalize-values" | "normalize-other";
class Ga4ProviderFailure extends Error {
  constructor(code: "GA4_AUTH_REQUIRED" | "GA4_RATE_LIMITED" | "GA4_TIMEOUT" | "GA4_INVALID_RESPONSE" | "GA4_PROVIDER_UNAVAILABLE", phase: Ga4FailurePhase) {
    super(code);
    Object.defineProperty(this, "ccpunGa4FailurePhase", { value: phase, enumerable: false, writable: false, configurable: false });
  }
}
function headerFailurePhase(raw: unknown, query: "landing" | "totals", group: "dimension" | "metric", nameInvalid: boolean): Ga4HeaderFailurePhase {
  let shape: "missing" | "null" | "nonarray" | "name-invalid" | "other" = "other";
  try {
    const field = Object.getOwnPropertyDescriptor(raw, group === "dimension" ? "dimensionHeaders" : "metricHeaders");
    if (!field) shape = "missing";
    else if (Object.hasOwn(field, "value")) {
      if (field.value === null) shape = "null";
      else if (!Array.isArray(field.value)) shape = "nonarray";
      else if (nameInvalid) shape = "name-invalid";
    }
  } catch { /* Only fixed structural metadata; no getters or raw values escape. */ }
  return `schema-headers-${query}-${group}-${shape}`;
}
function normalizationFailurePhase(error: unknown, raw: unknown, query: "landing" | "totals"): Ga4FailurePhase {
  try {
    if (error instanceof ZodError) {
      const paths = error.issues.map(issue => issue.path);
      if (paths.some(path => path.includes("dimensionValues"))) return "schema-dimension-value";
      if (paths.some(path => path.includes("metricValues"))) return "schema-metric-value";
      for (const group of ["dimension", "metric"] as const) {
        const header = group === "dimension" ? "dimensionHeaders" : "metricHeaders";
        if (paths.some(path => path[0] === header)) return headerFailurePhase(raw, query, group, paths.some(path => path[0] === header && path[2] === "name"));
      }
      if (paths.some(path => path[0] === "rowCount")) return "schema-row-count";
      if (paths.some(path => path[0] === "metadata")) return "schema-metadata";
      return "schema-other";
    }
    if (error instanceof Error && error.message === "GA4_HEADER_MISMATCH") return "normalize-headers";
    if (error instanceof Error && error.message === "GA4_VALUE_MISMATCH") return "normalize-values";
    return "normalize-other";
  } catch { return "normalize-other"; }
}

const GA4_FAILURE_PHASES = new Set<Ga4FailurePhase>(["fetch", "http", "decode", "schema-headers", "schema-dimension-value", "schema-metric-value", "schema-row-count", "schema-metadata", "schema-other", "normalize-headers", "normalize-values", "normalize-other", "schema-headers-landing-dimension-missing", "schema-headers-landing-dimension-null", "schema-headers-landing-dimension-nonarray", "schema-headers-landing-dimension-name-invalid", "schema-headers-landing-dimension-other", "schema-headers-landing-metric-missing", "schema-headers-landing-metric-null", "schema-headers-landing-metric-nonarray", "schema-headers-landing-metric-name-invalid", "schema-headers-landing-metric-other", "schema-headers-totals-dimension-missing", "schema-headers-totals-dimension-null", "schema-headers-totals-dimension-nonarray", "schema-headers-totals-dimension-name-invalid", "schema-headers-totals-dimension-other", "schema-headers-totals-metric-missing", "schema-headers-totals-metric-null", "schema-headers-totals-metric-nonarray", "schema-headers-totals-metric-name-invalid", "schema-headers-totals-metric-other"]);
export function getGa4FailurePhase(error: unknown): Ga4FailurePhase | null {
  try {
    if (!(error instanceof Ga4ProviderFailure)) return null;
    const phase: unknown = Object.getOwnPropertyDescriptor(error, "ccpunGa4FailurePhase")?.value;
    return typeof phase === "string" && GA4_FAILURE_PHASES.has(phase as Ga4FailurePhase) ? phase as Ga4FailurePhase : null;
  } catch { return null; }
}

async function requestPage(url: string, token: string, body: string, fetcher: FetchLike): Promise<unknown> {
  try {
    const response = await fetcher(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.ok) {
      try {
        return await response.json() as unknown;
      } catch {
        throw new Ga4ProviderFailure("GA4_INVALID_RESPONSE", "decode");
      }
    }
    if (response.status === 401 || response.status === 403) throw new Ga4ProviderFailure("GA4_AUTH_REQUIRED", "http");
    if (response.status === 429) throw new Ga4ProviderFailure("GA4_RATE_LIMITED", "http");
    if (response.status < 500) throw new Ga4ProviderFailure("GA4_INVALID_RESPONSE", "http");
    throw new Ga4ProviderFailure("GA4_PROVIDER_UNAVAILABLE", "http");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("GA4_")) throw error;
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new Ga4ProviderFailure("GA4_TIMEOUT", "fetch");
    throw new Ga4ProviderFailure("GA4_PROVIDER_UNAVAILABLE", "fetch");
  }
}

export async function fetchGa4LandingPages(rawInput: unknown, fetcher: FetchLike = fetch): Promise<{
  fetchedAt: string;
  rows: Ga4LandingPageRow[];
  truncated: boolean;
  timeZone: string | null;
  limitations: string[];
}> {
  const input = ga4QueryInputSchema.parse(rawInput);
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${input.propertyId}:runReport`;
  const raw = await requestPage(url, input.token, JSON.stringify({
    dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
    dimensions: [{ name: "landingPage" }],
    metrics: [{ name: "sessions" }, { name: "engagedSessions" }],
    dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search", caseSensitive: true } } },
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: String(input.rowLimit),
    returnPropertyQuota: true,
  }), fetcher);
  let report: ReturnType<typeof normalizeGa4LandingPageReport>;
  try {
    report = normalizeGa4LandingPageReport(raw);
  } catch (error) {
    throw new Ga4ProviderFailure("GA4_INVALID_RESPONSE", normalizationFailurePhase(error, raw, "landing"));
  }
  const truncated = report.rowCount > input.rowLimit;
  return {
    fetchedAt: new Date().toISOString(),
    rows: report.rows,
    truncated,
    timeZone: report.timeZone,
    limitations: [
      ...report.limitations,
      "GA4 reports may differ from the UI because of reporting identity and processing time",
      ...(truncated ? ["Reached the bounded 10,000-row manual-sync limit"] : []),
    ],
  };
}

export async function fetchGa4OrganicTotals(rawInput: unknown, fetcher: FetchLike = fetch): Promise<{
  fetchedAt: string;
  totals: Ga4MetricTotals;
  timeZone: string | null;
  limitations: string[];
}> {
  const input = ga4QueryInputSchema.parse({
    ...(typeof rawInput === "object" && rawInput !== null ? rawInput : {}),
    rowLimit: 1,
  });
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${input.propertyId}:runReport`;
  const raw = await requestPage(url, input.token, JSON.stringify({
    dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
    metrics: [{ name: "sessions" }, { name: "engagedSessions" }],
    dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search", caseSensitive: true } } },
    returnPropertyQuota: true,
  }), fetcher);
  try {
    const report = normalizeGa4OrganicTotalsReport(raw);
    return { fetchedAt: new Date().toISOString(), ...report };
  } catch (error) {
    throw new Ga4ProviderFailure("GA4_INVALID_RESPONSE", normalizationFailurePhase(error, raw, "totals"));
  }
}
