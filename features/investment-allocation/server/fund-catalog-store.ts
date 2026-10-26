import "server-only";

import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { resolveDeploymentIdentity } from "@/lib/runtime/deployment-identity";
import type { StoredFundDetail } from "./catalog-sync";
import { validateFundCatalogConnection, type FundCatalogLane } from "./fund-catalog-lanes";

// Public Web reader for the Neon `ccpun_fund` catalog written by the private VPS sync
// job. Its role (ccpun_fund_runtime) can only call read_catalog, read_fund and
// claim_live_fallback; it has no table privileges and never writes fund data.
// Returns null when the store is not configured for this exact Web lane, so the
// tools keep their existing live SEC behaviour until the lane is activated.

export type StoredCatalogFund = { projectId: string; listPosition: number; profileRows: unknown[]; profileFetchedAt: string };
export type StoredCatalog = {
  amc: { id: string; nameTh: string; nameEn: string | null };
  fetchedAt: string;
  funds: StoredCatalogFund[];
};
export type StoredFund = {
  visible: boolean;
  hiddenReason: string | null;
  secStatus: string;
  profileRows: unknown[];
  detail: StoredFundDetail | null;
  profileFetchedAt: string;
  detailFetchedAt: string | null;
  amcId: string;
  catalogFetchedAt: string;
};
export type FundCatalogStoreReader = {
  /** null when the store has no catalog yet (never synced). Throws when Neon is unreachable. */
  readCatalog(scope: "aia"): Promise<StoredCatalog | null>;
  /** null when the fund is not in the store. */
  readFund(scope: "aia", projectId: string): Promise<StoredFund | null>;
  /** One live SEC fallback per lease window across every Web instance. */
  claimLiveFallback(leaseKey: "aia:catalog" | "aia:detail", seconds: number): Promise<boolean>;
};

const READ_CACHE_MS = 2 * 60 * 1000;
const FUND_CACHE_MAX = 128;

export function resolveFundCatalogRuntime(variables: Record<string, string | undefined> = process.env): { connectionString: string; lane: FundCatalogLane } | null {
  const deployment = resolveDeploymentIdentity(variables, "web");
  const environment = deployment.environment;
  if (!deployment.valid || deployment.provider !== "hostinger" || deployment.role !== "web"
    || (environment !== "production" && environment !== "web-uat")) return null;
  if (variables.NEXT_PUBLIC_CCPUN_APP_ENV?.trim() !== environment
    || variables.CCPUN_UAT_MODE?.trim() !== (environment === "production" ? "0" : "1")) return null;
  const connectionString = validateFundCatalogConnection(variables.CCPUN_FUND_CATALOG_DATABASE_URL, environment, "ccpun_fund_runtime");
  return connectionString ? { connectionString, lane: environment } : null;
}

function iso(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function json(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function rowsOf(value: unknown): unknown[] {
  const parsed = json(value);
  return Array.isArray(parsed) ? parsed : [];
}

function detailOf(value: unknown): StoredFundDetail | null {
  const parsed = json(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const list = (key: string) => (Array.isArray(record[key]) ? record[key] as StoredFundDetail["risk"] : []);
  const states = typeof record.endpointStates === "object" && record.endpointStates !== null ? record.endpointStates as StoredFundDetail["endpointStates"] : null;
  return {
    specification: list("specification"), risk: list("risk"), allocation: list("allocation"), dealing: list("dealing"),
    endpointStates: states ?? { profile: "ok", specification: "empty", risk: "empty", allocation: "empty", dealing: "empty" },
  };
}

/** Maps read_catalog rows; exported for tests. */
export function mapCatalogRows(rows: Record<string, unknown>[]): StoredCatalog | null {
  const first = rows[0];
  const fetchedAt = iso(first?.catalog_fetched_at);
  if (!first || !fetchedAt || typeof first.amc_id !== "string" || typeof first.amc_name_th !== "string") return null;
  const funds: StoredCatalogFund[] = rows.flatMap((row) => {
    if (typeof row.project_id !== "string" || !/^M\d{4}_\d{4}$/.test(row.project_id)) return [];
    return [{ projectId: row.project_id, listPosition: Number(row.list_position) || 0, profileRows: rowsOf(row.profile_rows), profileFetchedAt: iso(row.profile_fetched_at) ?? fetchedAt }];
  });
  return { amc: { id: first.amc_id, nameTh: first.amc_name_th, nameEn: typeof first.amc_name_en === "string" ? first.amc_name_en : null }, fetchedAt, funds };
}

/** Maps a read_fund row; exported for tests. */
export function mapFundRow(row: Record<string, unknown> | undefined): StoredFund | null {
  if (!row || typeof row.visible !== "boolean") return null;
  const profileFetchedAt = iso(row.profile_fetched_at);
  const catalogFetchedAt = iso(row.catalog_fetched_at);
  if (!profileFetchedAt || !catalogFetchedAt || typeof row.amc_id !== "string") return null;
  return {
    visible: row.visible,
    hiddenReason: typeof row.hidden_reason === "string" ? row.hidden_reason : null,
    secStatus: typeof row.sec_status === "string" ? row.sec_status : "",
    profileRows: rowsOf(row.profile_rows),
    detail: detailOf(row.detail),
    profileFetchedAt,
    detailFetchedAt: iso(row.detail_fetched_at),
    amcId: row.amc_id,
    catalogFetchedAt,
  };
}

type Query = (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

/** Store reader over any query function, with a short process-local read cache. */
export function createFundCatalogStoreReader(query: Query, now: () => number = Date.now): FundCatalogStoreReader {
  let catalogCache: { at: number; value: StoredCatalog | null } | null = null;
  const fundCache = new Map<string, { at: number; value: StoredFund | null }>();
  const holder = randomUUID();
  return {
    async readCatalog(scope) {
      if (catalogCache && now() - catalogCache.at < READ_CACHE_MS) return catalogCache.value;
      const value = mapCatalogRows(await query("SELECT * FROM ccpun_fund.read_catalog($1::text)", [scope]));
      catalogCache = { at: now(), value };
      return value;
    },
    async readFund(scope, projectId) {
      const cached = fundCache.get(projectId);
      if (cached && now() - cached.at < READ_CACHE_MS) return cached.value;
      const value = mapFundRow((await query("SELECT * FROM ccpun_fund.read_fund($1::text,$2::text)", [scope, projectId]))[0]);
      fundCache.delete(projectId);
      if (fundCache.size >= FUND_CACHE_MAX) fundCache.delete(fundCache.keys().next().value as string);
      fundCache.set(projectId, { at: now(), value });
      return value;
    },
    async claimLiveFallback(leaseKey, seconds) {
      const rows = await query("SELECT ccpun_fund.claim_live_fallback($1::text,$2::uuid,$3::integer) AS claimed", [leaseKey, holder, seconds]);
      return rows[0]?.claimed === true;
    },
  };
}

const STORE_KEY = Symbol.for("ccpun.investmentAllocation.fundCatalogStore.v1");

/** The lane's store reader, or null when this Web lane has no fund catalog credential. */
export function getFundCatalogStore(): FundCatalogStoreReader | null {
  const holder = globalThis as typeof globalThis & { [STORE_KEY]?: FundCatalogStoreReader | null };
  if (holder[STORE_KEY] !== undefined) return holder[STORE_KEY];
  const runtime = resolveFundCatalogRuntime();
  holder[STORE_KEY] = runtime ? createFundCatalogStoreReader(async (text, params) => {
    const sql = neon(runtime.connectionString, { fetchOptions: { signal: AbortSignal.timeout(5000) } });
    return (await sql.query(text, params)) as Record<string, unknown>[];
  }) : null;
  return holder[STORE_KEY];
}
