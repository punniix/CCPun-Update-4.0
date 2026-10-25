import { headers } from "next/headers";
import { getAdminIdentity } from "@/lib/admin/identity";
import { hasAdminPermission } from "@/lib/admin/rbac";
import { getSeoIntelligenceRuntimeStatus } from "@/lib/admin/seo-intelligence/foundation";
import { getGoogleSessionContext, getGoogleSessionReadiness } from "@/lib/admin/seo-intelligence/google-session-connection";
import RefreshNowPanel from "./RefreshNowPanel";

function bangkokDate(daysAgo: number) {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

const CONNECT_ERRORS = ["unauthorized", "forbidden", "forbidden-origin", "configuration-required", "connect-required"];

// Server half of "ดึงใหม่ตอนนี้": the same permission, runtime and Google
// session checks the former /seo/opportunities/ page used. Shown only to people
// allowed to run the read-only provider query; renders nothing otherwise.
export default async function RefreshNowSection({ googleConnect = "" }: { googleConnect?: string }) {
  const identity = await getAdminIdentity().catch(() => null);
  if (!identity || identity.actorType !== "human" || !hasAdminPermission(identity.role, "research:provider-query")) return null;
  const runtime = getSeoIntelligenceRuntimeStatus();
  if (!runtime.enabled) return null;
  const laneLabel = runtime.environment === "production-admin" ? "ระบบจริง" : "พื้นที่ทดสอบ";
  const context = getGoogleSessionContext(process.env, identity);
  const connectAllowed = Boolean(context);
  const connection = connectAllowed ? await getGoogleSessionReadiness(
    new Request(`${context!.origin}/analytics/`, { headers: await headers() }), identity, process.env).catch(() => undefined) : undefined;
  return <RefreshNowPanel
    defaultStartDate={bangkokDate(27)}
    defaultEndDate={bangkokDate(0)}
    laneLabel={laneLabel}
    sessionConnectAllowed={connectAllowed}
    sessionConnectionState={connection?.reason}
    sessionConnectError={connectAllowed && CONNECT_ERRORS.includes(googleConnect)}
    sessionAccountRefreshed={connectAllowed && googleConnect === "account-refreshed"}
    initiallyOpen={connectAllowed && googleConnect !== ""}
  />;
}
