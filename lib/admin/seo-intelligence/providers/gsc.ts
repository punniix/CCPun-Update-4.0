import "server-only";

import {
  gscQueryInputSchema,
  normalizeGscSearchAnalyticsTotals,
  normalizeGscSearchAnalyticsPage,
  type GscMetricTotals,
  type GscNormalizedRow,
} from "../contracts";

const MAX_PAGES = 2;
const TIMEOUT_MS = 15_000;
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

async function requestPage(url: string, token: string, body: string, fetcher: FetchLike): Promise<unknown> {
  let failure = "GSC_PROVIDER_UNAVAILABLE";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetcher(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.ok) return response.json() as Promise<unknown>;
      if (response.status === 401 || response.status === 403) throw new Error("GSC_AUTH_REQUIRED");
      if (response.status === 429) failure = "GSC_RATE_LIMITED";
      else if (response.status < 500) throw new Error("GSC_INVALID_RESPONSE");
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("GSC_")) throw error;
      failure = error instanceof Error && error.name === "TimeoutError" ? "GSC_TIMEOUT" : failure;
      if (attempt === 1) break;
    }
  }
  throw new Error(failure);
}

export async function fetchGscSearchAnalyticsTotals(rawInput: unknown, fetcher: FetchLike = fetch): Promise<{
  fetchedAt: string;
  totals: GscMetricTotals;
}> {
  const input = gscQueryInputSchema.parse({
    ...(typeof rawInput === "object" && rawInput !== null ? rawInput : {}),
    dimensions: ["query"],
    rowLimit: 1,
  });
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(input.siteUrl)}/searchAnalytics/query`;
  const raw = await requestPage(url, input.token, JSON.stringify({
    startDate: input.startDate,
    endDate: input.endDate,
    type: "web",
    dataState: "final",
    rowLimit: 1,
  }), fetcher);
  try {
    return { fetchedAt: new Date().toISOString(), totals: normalizeGscSearchAnalyticsTotals(raw) };
  } catch {
    throw new Error("GSC_INVALID_RESPONSE");
  }
}

export async function fetchGscSearchAnalytics(rawInput: unknown, fetcher: FetchLike = fetch): Promise<{
  fetchedAt: string;
  rows: GscNormalizedRow[];
  truncated: boolean;
  limitation: string;
}> {
  const input = gscQueryInputSchema.parse(rawInput);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(input.siteUrl)}/searchAnalytics/query`;
  const rows: GscNormalizedRow[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const raw = await requestPage(url, input.token, JSON.stringify({
      startDate: input.startDate,
      endDate: input.endDate,
      dimensions: input.dimensions,
      type: "web",
      dataState: "final",
      rowLimit: input.rowLimit,
      startRow: page * input.rowLimit,
    }), fetcher);
    let pageRows: GscNormalizedRow[];
    try {
      pageRows = normalizeGscSearchAnalyticsPage(raw, input.dimensions);
    } catch {
      throw new Error("GSC_INVALID_RESPONSE");
    }
    rows.push(...pageRows);
    if (pageRows.length < input.rowLimit) {
      return { fetchedAt: new Date().toISOString(), rows, truncated: false, limitation: "Search Console may omit anonymized or low-volume queries." };
    }
  }

  return { fetchedAt: new Date().toISOString(), rows, truncated: true, limitation: "Reached the bounded 50,000-row manual-sync limit; Search Console does not guarantee every possible query row." };
}

export async function inspectGscIndexedUrl(input: {
  siteUrl: string;
  inspectionUrl: string;
  token: string;
}, fetcher: FetchLike = fetch): Promise<{
  state: "indexed" | "not-indexed" | "unknown";
  verdict: string | null;
  coverageState: string | null;
  indexingState: string | null;
  pageFetchState: string | null;
  lastCrawlTime: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  inspectionResultLink: string | null;
  limitation: string;
}> {
  const raw = await requestPage(
    "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
    input.token,
    JSON.stringify({
      inspectionUrl: input.inspectionUrl,
      siteUrl: input.siteUrl,
      languageCode: "th-TH",
    }),
    fetcher,
  );
  if (!raw || typeof raw !== "object") throw new Error("GSC_INVALID_RESPONSE");
  const result = (raw as { inspectionResult?: unknown }).inspectionResult;
  if (!result || typeof result !== "object") throw new Error("GSC_INVALID_RESPONSE");
  const record = result as Record<string, unknown>;
  const indexStatus = record.indexStatusResult;
  if (!indexStatus || typeof indexStatus !== "object") throw new Error("GSC_INVALID_RESPONSE");
  const index = indexStatus as Record<string, unknown>;
  const stringOrNull = (value: unknown) => typeof value === "string" && value.length > 0 ? value : null;
  const verdict = stringOrNull(index.verdict);
  return {
    state: verdict === "PASS" ? "indexed" : verdict === "FAIL" ? "not-indexed" : "unknown",
    verdict,
    coverageState: stringOrNull(index.coverageState),
    indexingState: stringOrNull(index.indexingState),
    pageFetchState: stringOrNull(index.pageFetchState),
    lastCrawlTime: stringOrNull(index.lastCrawlTime),
    googleCanonical: stringOrNull(index.googleCanonical),
    userCanonical: stringOrNull(index.userCanonical),
    inspectionResultLink: stringOrNull(record.inspectionResultLink),
    limitation: "URL Inspection reports only the version known to Google's index; it is not a live indexability test and does not request indexing.",
  };
}

export async function submitGscSitemap(input: {
  siteUrl: string;
  sitemapUrl: string;
  token: string;
}, fetcher: FetchLike = fetch): Promise<{ submittedAt: string }> {
  if (input.siteUrl !== "sc-domain:ccpun.com" || input.sitemapUrl !== "https://ccpun.com/sitemap.xml") throw new Error("GSC_SITEMAP_TARGET_DENIED");
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(input.siteUrl)}/sitemaps/${encodeURIComponent(input.sitemapUrl)}`;
  let response: Response;
  try {
    response = await fetcher(endpoint, {
      method: "PUT", redirect: "error",
      headers: { Authorization: `Bearer ${input.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new Error("GSC_TIMEOUT");
    throw new Error("GSC_PROVIDER_UNAVAILABLE");
  }
  if (response.status === 401 || response.status === 403) throw new Error("GSC_AUTH_REQUIRED");
  if (response.status === 429) throw new Error("GSC_RATE_LIMITED");
  if (response.status >= 500) throw new Error("GSC_RETRYABLE_RESPONSE");
  if (!response.ok) throw new Error("GSC_INVALID_RESPONSE");
  return { submittedAt: new Date().toISOString() };
}

export type GscSitemapStatus={path:string;lastSubmitted:string|null;isPending:boolean|null;errors:string|null;warnings:string|null};
/** Read-only reconciliation; exact property/feed, one bounded GET, no write credential. */
export async function getGscSitemapStatus(token:string,fetcher:FetchLike=fetch):Promise<GscSitemapStatus>{
  const endpoint=`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent('sc-domain:ccpun.com')}/sitemaps/${encodeURIComponent('https://ccpun.com/sitemap.xml')}`;
  const response=await fetcher(endpoint,{method:'GET',headers:{Authorization:`Bearer ${token}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10_000)});
  if(response.status===404)return {path:'https://ccpun.com/sitemap.xml',lastSubmitted:null,isPending:null,errors:null,warnings:null};
  if(!response.ok)throw new Error(response.status===401||response.status===403?'GSC_READ_AUTH_REQUIRED':'GSC_SITEMAP_READ_UNAVAILABLE');
  if(Number(response.headers.get('content-length'))>16384)throw new Error('GSC_READ_RESPONSE_TOO_LARGE');
  const reader=response.body?.getReader();let size=0;const chunks:Uint8Array[]=[];let timer!:ReturnType<typeof setTimeout>;const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('GSC_READ_TIMEOUT')),10_000);});
  if(!reader)throw new Error('GSC_INVALID_RESPONSE');
  try{while(true){const part=await Promise.race([reader.read(),timeout]);if(part.done)break;size+=part.value.byteLength;if(size>16384)throw new Error('GSC_READ_RESPONSE_TOO_LARGE');chunks.push(part.value);}}finally{clearTimeout(timer);void reader.cancel().catch(()=>undefined);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!value||typeof value!=='object')throw new Error('GSC_INVALID_RESPONSE');const row=value as Record<string,unknown>;
  if(row.path!=='https://ccpun.com/sitemap.xml'||(row.isPending!==undefined&&typeof row.isPending!=='boolean')||(row.lastSubmitted!==undefined&&(typeof row.lastSubmitted!=='string'||!Number.isFinite(Date.parse(row.lastSubmitted)))))throw new Error('GSC_INVALID_RESPONSE');
  const counter=(x:unknown)=>typeof x==='string'&&/^\d{1,12}$/.test(x)?x:typeof x==='number'&&Number.isSafeInteger(x)&&x>=0?String(x):null;
  return {path:row.path,lastSubmitted:typeof row.lastSubmitted==='string'?row.lastSubmitted:null,isPending:typeof row.isPending==='boolean'?row.isPending:null,errors:counter(row.errors),warnings:counter(row.warnings)};
}
