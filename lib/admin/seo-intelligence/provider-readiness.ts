import { z } from "zod";
import type { GoogleSessionReadiness } from "./google-session-connection";

if (typeof window !== "undefined") throw new Error("SEO_PROVIDER_READINESS_SERVER_ONLY");

export const seoGoogleProviderSchema = z.enum(["gsc", "ga4"]);
export type SeoGoogleProvider = z.infer<typeof seoGoogleProviderSchema>;

const providerConfig = {
  gsc: {
    resource: "CCPUN_GSC_SITE_URL",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
  },
  ga4: {
    resource: "CCPUN_GA4_PROPERTY_ID",
    scope: "https://www.googleapis.com/auth/analytics.readonly",
  },
} as const;

const oauthVariables = [
  "CCPUN_GOOGLE_DATA_CLIENT_ID",
  "CCPUN_GOOGLE_DATA_CLIENT_SECRET",
  "CCPUN_GOOGLE_DATA_REFRESH_TOKEN",
] as const;

function validResource(provider: SeoGoogleProvider, value: string | undefined) {
  if (!value?.trim()) return false;
  if (provider === "ga4") return /^\d{1,20}$/.test(value.trim());
  const site = value.trim();
  if (site.startsWith("sc-domain:")) return /^sc-domain:[A-Za-z0-9.-]+$/.test(site);
  try {
    const url = new URL(site);
    return url.protocol === "https:" && url.toString() === site;
  } catch {
    return false;
  }
}

export function getSeoGoogleProviderReadiness(
  providerValue: unknown,
  env: Record<string, string | undefined> = process.env,
  sessionConnection?: GoogleSessionReadiness,
) {
  const provider = seoGoogleProviderSchema.parse(providerValue);
  const config = providerConfig[provider];
  if (provider === "ga4" && ["admin-uat", "production-admin"].includes(env.CCPUN_APP_ENV ?? "") && sessionConnection) {
    const ready = sessionConnection.allowed && sessionConnection.connected;
    return {
      provider, mode: "owner-session-oauth" as const,
      status: ready ? "manual-sync-ready" as const : "configuration-required" as const,
      required: [
        { name: "OWNER_GOOGLE_ANALYTICS_CONSENT", present: ready, valid: ready },
        { name: config.resource, present: Boolean(env[config.resource]?.trim()), valid: env[config.resource] === (env.CCPUN_APP_ENV === "admin-uat" ? "551040812" : "219719845") },
      ],
      scope: config.scope, refreshableConnectionReady: ready, callbackPath: "/api/auth/callback/google",
      limitation: "การเชื่อมต่อผูกกับการเข้าสู่ระบบของ Owner สูงสุด 8 ชั่วโมง หากออกจากระบบหรือหมดอายุให้เชื่อมใหม่ ระบบอ่านเมื่อกดเท่านั้น ไม่บันทึก token ในข้อมูล session ที่ส่งให้หน้าเว็บ",
      connectionState: sessionConnection.reason,
    };
  }
  const oauthReady = oauthVariables.every((name) => Boolean(env[name]?.trim()));
  const resourcePresent = Boolean(env[config.resource]?.trim());
  const resourceValid = validResource(provider, env[config.resource]);
  return {
    provider,
    mode: "refreshable-oauth" as const,
    status: oauthReady && resourceValid ? "manual-sync-ready" as const : "configuration-required" as const,
    required: [
      ...oauthVariables.map((name) => ({ name, present: Boolean(env[name]?.trim()), valid: Boolean(env[name]?.trim()) })),
      { name: config.resource, present: resourcePresent, valid: resourceValid },
    ],
    scope: config.scope,
    refreshableConnectionReady: oauthReady,
    callbackPath: null,
    limitation: provider === "gsc"
      ? "Search Analytics and URL Inspection use read-only OAuth. Optional Sitemap Submission uses an independent owner-authorized write credential on the private VPS; this connection never gains write privileges."
      : "Owner-authorized offline access is refreshed server-side. GA4 sync remains manual, read-only and non-persistent.",
  };
}
