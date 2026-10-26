// Private VPS process only. One bounded run of the บลจ. เอไอเอ fund catalog sync
// (SEC Open API v2 -> Neon ccpun_fund). Use an external systemd timer, never a public
// route and never a Cloud Web/Admin cron (docs/architecture/private-execution-ownership-20261007.md):
//   node --import tsx scripts/investment-fund-catalog-sync.ts [timer|manual]
// Required environment (all on the VPS, none on Public Web):
//   CCPUN_BACKGROUND_EXECUTION_PLANE=vps
//   CCPUN_FUND_CATALOG_SYNC_ENABLED=1
//   CCPUN_FUND_CATALOG_LANE=web-uat|production
//   CCPUN_FUND_CATALOG_SYNC_DATABASE_URL  (role ccpun_fund_sync on that lane's endpoint)
//   SEC_API_PRIMARY_KEY or SEC_API_SECONDARY_KEY
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runFundCatalogSync, type FundSyncStore, type FundSyncSummary } from "../features/investment-allocation/server/catalog-sync";
import { validateFundCatalogConnection, type FundCatalogLane } from "../features/investment-allocation/server/fund-catalog-lanes";
import { createSecReader, type SecFetch, type SecPage } from "../features/investment-allocation/server/sec-projection";

type Variables = Record<string, string | undefined>;

export function validateFundCatalogSync(variables: Variables) {
  if (variables.CCPUN_BACKGROUND_EXECUTION_PLANE !== "vps" || variables.CCPUN_FUND_CATALOG_SYNC_ENABLED !== "1"
    || variables.NEXT_RUNTIME !== undefined || variables.NEXT_PHASE !== undefined
    || Object.entries(variables).some(([key, value]) => key.startsWith("VERCEL_") && value)) {
    throw new Error("FUND_CATALOG_SYNC_ACTIVATION_DENIED");
  }
  const lane = variables.CCPUN_FUND_CATALOG_LANE;
  if (lane !== "web-uat" && lane !== "production") throw new Error("FUND_CATALOG_SYNC_LANE_DENIED");
  const connectionString = validateFundCatalogConnection(variables.CCPUN_FUND_CATALOG_SYNC_DATABASE_URL, lane as FundCatalogLane, "ccpun_fund_sync");
  if (!connectionString) throw new Error("FUND_CATALOG_SYNC_DATABASE_DENIED");
  const secKey = variables.SEC_API_PRIMARY_KEY?.trim() || variables.SEC_API_SECONDARY_KEY?.trim();
  if (!secKey) throw new Error("FUND_CATALOG_SYNC_SEC_KEY_MISSING");
  return { lane: lane as FundCatalogLane, connectionString, secKey };
}

export async function runFundCatalogSyncCli(trigger: "timer" | "manual", variables: Variables = process.env, dependencies: {
  store?: (connectionString: string) => Promise<FundSyncStore>;
  readSec?: (key: string) => (path: string) => Promise<SecPage>;
} = {}): Promise<FundSyncSummary & { lane: FundCatalogLane }> {
  const { lane, connectionString, secKey } = validateFundCatalogSync(variables);
  const store = dependencies.store
    ? await dependencies.store(connectionString)
    : await (async () => {
      const { createFundSyncStore, neonQuery } = await import("../features/investment-allocation/server/catalog-sync-store");
      return createFundSyncStore(neonQuery(connectionString));
    })();
  const readSec = dependencies.readSec ? dependencies.readSec(secKey) : createSecReader(secKey, fetch as unknown as SecFetch);
  const summary = await runFundCatalogSync({ readSec, store, trigger });
  return { lane, ...summary };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void (async () => {
    const trigger = process.argv[2] ?? "timer";
    if (process.argv.length > 3 || (trigger !== "timer" && trigger !== "manual")) throw new Error("FUND_CATALOG_SYNC_ARGUMENT_DENIED");
    const result = await runFundCatalogSyncCli(trigger);
    // Counts and fixed codes only: no fund names, URLs, keys or provider messages.
    console.log(JSON.stringify({ workload: "fund-catalog", ...result }));
    if (result.status === "failed") process.exitCode = 1;
  })().catch((error: unknown) => {
    const code = error instanceof Error && /^FUND_CATALOG_SYNC_[A-Z_]+$/.test(error.message) ? error.message : "FUND_CATALOG_SYNC_RUN_DENIED";
    console.error(code);
    process.exitCode = 1;
  });
}
