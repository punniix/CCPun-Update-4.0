// Neon lanes for the `ccpun_fund` catalog. Same native Neon endpoints as the Web
// article engagement store (apps/web/lib/article-engagement.ts): Web UAT uses the UAT
// project (young-term-47483330 / br-crimson-mouse-az7ajkv8), Production the Production
// project. Each role has its own credential; neither is a fallback for the other.
//   ccpun_fund_runtime  Public Web reader (CCPUN_FUND_CATALOG_DATABASE_URL)
//   ccpun_fund_sync     private VPS writer (its credential lives only on the VPS)

export const FUND_CATALOG_LANES = {
  production: { endpoint: "ep-broad-butterfly-b3ro7u8w", suffix: "c-4.ap-southeast-1.aws.neon.tech" },
  "web-uat": { endpoint: "ep-mute-frost-aztvz394", suffix: "c-3.ap-southeast-1.aws.neon.tech" },
} as const;

export type FundCatalogLane = keyof typeof FUND_CATALOG_LANES;

/** Returns the connection string only when it names exactly this lane's endpoint, role and database. */
export function validateFundCatalogConnection(raw: string | undefined, lane: FundCatalogLane, role: "ccpun_fund_runtime" | "ccpun_fund_sync"): string | null {
  const connectionString = raw?.trim();
  if (!connectionString) return null;
  const { endpoint, suffix } = FUND_CATALOG_LANES[lane];
  try {
    const url = new URL(connectionString);
    if (url.protocol !== "postgresql:" || url.port || url.hash
      || ![`${endpoint}.${suffix}`, `${endpoint}-pooler.${suffix}`].includes(url.hostname)
      || decodeURIComponent(url.username) !== role || !url.password
      || decodeURIComponent(url.pathname.slice(1)) !== "neondb"
      || url.searchParams.get("sslmode") !== "require"
      || [...url.searchParams.keys()].some((key) => !["sslmode", "channel_binding"].includes(key))
      || url.searchParams.getAll("sslmode").length !== 1
      || url.searchParams.getAll("channel_binding").length > 1
      || (url.searchParams.has("channel_binding") && url.searchParams.get("channel_binding") !== "require")) return null;
    return connectionString;
  } catch {
    return null;
  }
}
