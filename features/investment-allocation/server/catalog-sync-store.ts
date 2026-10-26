// Neon writer for the fund catalog sync job. Private VPS CLI only: the Web runtime
// never imports this file or reads its credential (CCPUN_FUND_CATALOG_SYNC_DATABASE_URL).
// The ccpun_fund_sync role has no table privileges; it may only call the sync_*
// SECURITY DEFINER functions from db/migrations/20261026_investment_fund_catalog_v1.sql.

import { neon } from "@neondatabase/serverless";
import type { FundSyncStore } from "./catalog-sync";

type Query = (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

export function neonQuery(connectionString: string, timeoutMs = 15_000): Query {
  return async (text, params) => {
    const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(timeoutMs) } });
    return (await sql.query(text, params)) as Record<string, unknown>[];
  };
}

export function createFundSyncStore(query: Query): FundSyncStore {
  return {
    async begin(scope, trigger) {
      const rows = await query("SELECT ccpun_fund.sync_begin($1::text,$2::text) AS run_id", [scope, trigger]);
      const runId = rows[0]?.run_id;
      return typeof runId === "string" ? runId : null;
    },
    async visibleProjects(runId) {
      const rows = await query("SELECT project_id FROM ccpun_fund.sync_visible_projects($1::uuid)", [runId]);
      return rows.map((row) => row.project_id).filter((value): value is string => typeof value === "string");
    },
    async upsertFund(input) {
      const rows = await query(
        "SELECT ccpun_fund.sync_upsert_fund($1::uuid,$2::text,$3::text,$4::integer,$5::text,$6::jsonb,$7::jsonb) AS outcome",
        [input.runId, input.projectId, input.amcId, input.listPosition, input.secStatus, JSON.stringify(input.profileRows), input.detail ? JSON.stringify(input.detail) : null],
      );
      const outcome = rows[0]?.outcome;
      if (outcome !== "added" && outcome !== "updated" && outcome !== "restored") throw new Error("fund_sync_invalid_result");
      return outcome;
    },
    async hideFund(runId, projectId, reason, secStatus) {
      const rows = await query("SELECT ccpun_fund.sync_hide_fund($1::uuid,$2::text,$3::text,$4::text) AS hidden", [runId, projectId, reason, secStatus?.slice(0, 64) ?? null]);
      return rows[0]?.hidden === true;
    },
    async finish(input) {
      await query(
        "SELECT ccpun_fund.sync_finish($1::uuid,$2::text,$3::text,$4::text,$5::text,$6::integer,$7::integer,$8::integer,$9::text)",
        [input.runId, input.status, input.amc?.id ?? null, input.amc?.nameTh ?? null, input.amc?.nameEn ?? null,
          input.fundsListed, input.detailFailures, input.secRequests, input.errorCode],
      );
    },
  };
}
