// Fund catalog sync for the บลจ. เอไอเอ tool (owner decision 2026-10-26): resolve the
// AMC from SEC, list its current funds, fetch the SEC facts the tool shows, and store
// them in Neon `ccpun_fund` so visitors read the store instead of calling SEC.
//
// Runs only in the private VPS CLI (scripts/investment-fund-catalog-sync.ts). It never
// runs inside Next.js, so it imports no Next, "server-only" or Web runtime module.
// The SEC reader and the store are injected; tests drive both with fixtures.
//
// Fund list changes: new funds are added on the next run; a stored fund missing
// from the current listing is checked once by its project id and then hidden
// (cancelled / merged / inactive / not_listed), never deleted.

import { isAiaAmcName } from "../domain/fund-scope";
import { SEC_PAGE_SIZE, type SecPage, type SecPublicRow } from "./sec-projection";

export const FUND_CATALOG_SCOPE = "aia" as const;
const ACTIVE_STATUSES = ["Registered", "IPO"] as const;
const MAX_LIST_PAGES = 20;
const DEFAULT_MAX_SEC_REQUESTS = 600;
const DEFAULT_REQUEST_GAP_MS = 250;

export type HiddenReason = "cancelled" | "merged" | "inactive" | "not_listed";

/** SEC v2 rows per detail endpoint, exactly as the live adapter would receive them. */
export type StoredFundDetail = {
  specification: SecPublicRow[];
  risk: SecPublicRow[];
  allocation: SecPublicRow[];
  dealing: SecPublicRow[];
  endpointStates: Record<"profile" | "specification" | "risk" | "allocation" | "dealing", "ok" | "empty">;
};

export type FundSyncStore = {
  begin(scope: typeof FUND_CATALOG_SCOPE, trigger: "timer" | "manual"): Promise<string | null>;
  visibleProjects(runId: string): Promise<string[]>;
  upsertFund(input: {
    runId: string;
    projectId: string;
    amcId: string;
    listPosition: number;
    secStatus: (typeof ACTIVE_STATUSES)[number];
    profileRows: SecPublicRow[];
    detail: StoredFundDetail | null;
  }): Promise<"added" | "updated" | "restored">;
  hideFund(runId: string, projectId: string, reason: HiddenReason, secStatus: string | null): Promise<boolean>;
  finish(input: {
    runId: string;
    status: "succeeded" | "partial" | "failed";
    amc: { id: string; nameTh: string; nameEn: string | null } | null;
    fundsListed: number;
    detailFailures: number;
    secRequests: number;
    errorCode: string | null;
  }): Promise<void>;
};

export type FundSyncSummary = {
  status: "succeeded" | "partial" | "failed" | "skipped";
  errorCode: string | null;
  fundsListed: number;
  added: number;
  restored: number;
  hidden: number;
  detailFailures: number;
  secRequests: number;
};

class SyncStop extends Error {
  constructor(readonly code: string) { super(code); }
}

const PROJECT_ID = /^M\d{4}_\d{4}$/;
const AMC_ID = /^[A-Za-z0-9_-]{1,64}$/;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Maps a non-active SEC fund_status to the reason a stored fund is hidden. */
export function hiddenReasonForStatus(status: string | null): HiddenReason {
  if (!status) return "not_listed";
  if (/merg/i.test(status)) return "merged";
  if (/cancel|revok|terminat|liquidat|dissol|expire|close/i.test(status)) return "cancelled";
  return "inactive";
}

export async function runFundCatalogSync(options: {
  readSec: (path: string) => Promise<SecPage>;
  store: FundSyncStore;
  trigger?: "timer" | "manual";
  maxSecRequests?: number;
  requestGapMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<FundSyncSummary> {
  const { readSec, store } = options;
  const maxSecRequests = options.maxSecRequests ?? DEFAULT_MAX_SEC_REQUESTS;
  const gap = options.requestGapMs ?? DEFAULT_REQUEST_GAP_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const summary: FundSyncSummary = { status: "failed", errorCode: null, fundsListed: 0, added: 0, restored: 0, hidden: 0, detailFailures: 0, secRequests: 0 };

  const runId = await store.begin(FUND_CATALOG_SCOPE, options.trigger ?? "timer");
  if (!runId) return { ...summary, status: "skipped", errorCode: "already_running" };

  // Every SEC call goes through here: request budget plus a polite gap between calls.
  const sec = async (path: string): Promise<SecPage> => {
    if (summary.secRequests >= maxSecRequests) throw new SyncStop("sec_request_budget");
    if (summary.secRequests > 0 && gap > 0) await sleep(gap);
    summary.secRequests += 1;
    return readSec(path);
  };
  const pages = async (base: URLSearchParams, path: string): Promise<SecPublicRow[]> => {
    const rows: SecPublicRow[] = [];
    let cursor = "";
    for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
      const params = new URLSearchParams(base);
      params.set("page_size", String(SEC_PAGE_SIZE));
      if (cursor) params.set("next_cursor", cursor);
      const result = await sec(`${path}?${params.toString()}`);
      rows.push(...result.items);
      cursor = result.nextCursor ?? "";
      if (!cursor) return rows;
    }
    throw new SyncStop("sec_listing_too_long");
  };

  let amc: { id: string; nameTh: string; nameEn: string | null } | null = null;
  try {
    // 1. Resolve บลจ. เอไอเอ by name (never a hard-coded id); exactly one match.
    const amcs = new Map<string, { id: string; nameTh: string; nameEn: string | null }>();
    for (const row of await pages(new URLSearchParams(), "/v2/fund/general-info/amcs")) {
      const id = text(row.unique_id);
      const nameTh = text(row.comp_name_th);
      if (!id || !AMC_ID.test(id) || !nameTh || amcs.has(id)) continue;
      const nameEn = text(row.comp_name_en);
      if (isAiaAmcName(nameTh, nameEn)) amcs.set(id, { id, nameTh, nameEn });
    }
    if (amcs.size !== 1) throw new SyncStop(amcs.size ? "aia_amc_ambiguous" : "aia_amc_unresolved");
    amc = [...amcs.values()][0];

    // 2. Current funds: Registered then IPO for this AMC, in SEC order.
    const listed = new Map<string, { status: (typeof ACTIVE_STATUSES)[number]; rows: SecPublicRow[] }>();
    for (const status of ACTIVE_STATUSES) {
      const rows = await pages(new URLSearchParams({ fund_status: status, company_info: amc.id }), "/v2/fund/general-info/profiles");
      for (const row of rows) {
        const projectId = text(row.proj_id);
        // Defense in depth: keep only rows SEC attributes to this AMC and status.
        if (!projectId || !PROJECT_ID.test(projectId) || text(row.unique_id) !== amc.id || row.fund_status !== status
          || !isAiaAmcName(text(row.comp_name_th), text(row.comp_name_en))) continue;
        const entry = listed.get(projectId);
        if (entry) { if (entry.status === status) entry.rows.push(row); }
        else listed.set(projectId, { status, rows: [row] });
      }
    }
    summary.fundsListed = listed.size;

    const previouslyVisible = await store.visibleProjects(runId);
    // A sudden empty listing is treated as an upstream fault, never as "every fund closed".
    if (listed.size === 0 && previouslyVisible.length > 0) throw new SyncStop("empty_active_listing");

    // 3. Facts the tool shows, per fund. A failed fund keeps its previous stored detail.
    let position = 0;
    for (const [projectId, entry] of listed) {
      const listPosition = position++;
      let profileRows = entry.rows;
      let detail: StoredFundDetail | null = null;
      try {
        const id = encodeURIComponent(projectId);
        const profile = await sec(`/v2/fund/general-info/profiles?project_info=${id}&page_size=100`);
        const exact = profile.items.filter((row) => text(row.proj_id) === projectId && ACTIVE_STATUSES.includes(row.fund_status as never));
        if (exact.length) profileRows = exact;
        const specification = await sec(`/v2/fund/general-info/specifications?proj_id=${id}&page_size=100`);
        const risk = await sec(`/v2/fund/factsheet/risk-spectrum?proj_id=${id}&latest=true&page_size=100`);
        const allocation = await sec(`/v2/fund/factsheet/asset-allocation?proj_id=${id}&latest=true&page_size=100`);
        const dealing = await sec(`/v2/fund/factsheet/subscription-redemption-periods?proj_id=${id}&latest=true&page_size=100`);
        const state = (rows: SecPublicRow[]) => (rows.length ? "ok" as const : "empty" as const);
        detail = {
          specification: specification.items, risk: risk.items, allocation: allocation.items, dealing: dealing.items,
          endpointStates: { profile: state(exact), specification: state(specification.items), risk: state(risk.items), allocation: state(allocation.items), dealing: state(dealing.items) },
        };
      } catch (error) {
        if (error instanceof SyncStop) throw error;
        summary.detailFailures += 1;
      }
      const outcome = await store.upsertFund({ runId, projectId, amcId: amc.id, listPosition, secStatus: entry.status, profileRows, detail });
      if (outcome === "added") summary.added += 1;
      if (outcome === "restored") summary.restored += 1;
    }

    // 4. Stored funds that SEC no longer lists: check the exact project, then hide.
    for (const projectId of previouslyVisible) {
      if (listed.has(projectId) || !PROJECT_ID.test(projectId)) continue;
      let rows: SecPublicRow[];
      try {
        rows = (await sec(`/v2/fund/general-info/profiles?project_info=${encodeURIComponent(projectId)}&page_size=100`)).items
          .filter((row) => text(row.proj_id) === projectId);
      } catch (error) {
        if (error instanceof SyncStop) throw error;
        // Unknown is not "closed": keep the fund visible until a later run can confirm.
        summary.detailFailures += 1;
        continue;
      }
      const status = text(rows[0]?.fund_status);
      const stillActive = status === "Registered" || status === "IPO";
      const reason: HiddenReason = stillActive ? "not_listed" : hiddenReasonForStatus(status);
      if (await store.hideFund(runId, projectId, reason, status)) summary.hidden += 1;
    }

    summary.status = summary.detailFailures ? "partial" : "succeeded";
  } catch (error) {
    summary.status = "failed";
    summary.errorCode = error instanceof SyncStop ? error.code : error instanceof Error && /^sec_(?:http_[1-5]\d\d|invalid_json|invalid_envelope)$/.test(error.message)
      ? error.message : error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? "sec_timeout" : "sync_error";
  }
  await store.finish({ runId, status: summary.status as "succeeded" | "partial" | "failed", amc: summary.status === "failed" ? null : amc,
    fundsListed: summary.fundsListed, detailFailures: summary.detailFailures, secRequests: summary.secRequests, errorCode: summary.errorCode });
  return summary;
}
