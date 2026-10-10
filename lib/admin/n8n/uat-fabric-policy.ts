/** Restrict P1 canary traffic to a dedicated UAT n8n endpoint. */
export type UatFabricConfig = {ready: true; endpoint: URL; token: string} | {ready: false; reason: "disabled" | "environment" | "endpoint" | "credentials"};
export function resolveUatFabricConfig(env: Record<string,string|undefined>): UatFabricConfig {
  if (env.CCPUN_APP_ENV !== "admin-uat") return {ready:false,reason:"environment"};
  if (env.CCPUN_N8N_P1_UAT_ENABLED !== "true") return {ready:false,reason:"disabled"};
  const raw=env.CCPUN_N8N_P1_UAT_WEBHOOK_URL;
  let endpoint: URL;
  try { endpoint=new URL(raw??""); } catch { return {ready:false,reason:"endpoint"}; }
  if (endpoint.protocol!=="https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !/^\/webhook\/ccpun-p1-uat-(?:seo-clustering|owner-export)\/?$/.test(endpoint.pathname)) return {ready:false,reason:"endpoint"};
  if (endpoint.hostname!=="n8n.srv908107.hstgr.cloud") return {ready:false,reason:"endpoint"};
  const token=env.CCPUN_N8N_P1_UAT_TOKEN?.trim();
  if (!token || token.length<43) return {ready:false,reason:"credentials"};
  return {ready:true,endpoint,token};
}
