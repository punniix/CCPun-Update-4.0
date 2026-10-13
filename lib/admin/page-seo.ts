import "server-only";

import { createClient, groq } from "next-sanity";
import { z } from "zod";
import { getPageSeoPage, PAGE_SEO_FIELDS, PAGE_SEO_PAGES, validatePageSeoFields, type PageSeoFields } from "../content/page-seo-registry";
import { isAdminDataPlaneAllowed, isAdminReadDataPlaneAllowed } from "./environment";
import { getAdminSanityReadToken, getAdminSanityWriteToken } from "./sanity-credentials";

export type PageSeoRow = { pathname: string; label: string; defaults: Required<PageSeoFields>; revision: string | null; overrides: PageSeoFields };
export type PageSeoReadback = { verified: boolean; status: number | null; tags: Record<string, string | null> | null; error: string | null };

export function isPageSeoUatAllowed(env: Record<string, string | undefined> = process.env): boolean {
  if (env.CCPUN_APP_ENV !== "admin-uat" || env.NEXT_PUBLIC_CCPUN_APP_ENV !== "admin-uat" || env.CCPUN_DEPLOYMENT_PROVIDER !== "hostinger" || env.CCPUN_DEPLOYMENT_ROLE !== "admin" || env.NEXT_PUBLIC_SANITY_PROJECT_ID !== "ccb9lnw5" || env.NEXT_PUBLIC_SANITY_DATASET !== "uat") return false;
  return isAdminReadDataPlaneAllowed("uat", "admin-uat", env.VERCEL_PROJECT_ID, env.CCPUN_ADMIN_PRODUCTION_PROJECT_ID, "ccb9lnw5", env)
    && isAdminDataPlaneAllowed("uat", "admin-uat", env.VERCEL_PROJECT_ID, env.CCPUN_ADMIN_PRODUCTION_PROJECT_ID, "ccb9lnw5", env);
}

function client(write = false) {
  if (!isPageSeoUatAllowed()) throw new Error("PAGE_SEO_UAT_REQUIRED");
  const token = write ? getAdminSanityWriteToken() : getAdminSanityReadToken();
  if (write && !token) throw new Error("PAGE_SEO_WRITE_UNAVAILABLE");
  return createClient({ projectId: "ccb9lnw5", dataset: "uat", apiVersion: "2026-08-20", token: token || undefined, useCdn: false, perspective: "published", stega: { enabled: false } });
}

const savedSchema = z.object({ _id: z.string(), _type: z.literal("pageSeo"), _rev: z.string().min(1).max(200), pathname: z.string(), seoTitle: z.string().nullable().optional(), seoDescription: z.string().nullable().optional(), ogTitle: z.string().nullable().optional(), ogDescription: z.string().nullable().optional(), ogImageUrl: z.string().nullable().optional() });
const projection = groq`*[_type == "pageSeo" && _id in $ids] { _id, _type, _rev, pathname, seoTitle, seoDescription, ogTitle, ogDescription, ogImageUrl }`;

function fieldsFromDocument(value: unknown): { revision: string; overrides: PageSeoFields; pathname: string; id: string } {
  const doc = savedSchema.parse(value);
  const fields = Object.fromEntries(PAGE_SEO_FIELDS.flatMap(key => doc[key] === undefined ? [] : [[key, doc[key]]]));
  return { revision: doc._rev, overrides: validatePageSeoFields(fields), pathname: doc.pathname, id: doc._id };
}

export async function listPageSeo(): Promise<PageSeoRow[]> {
  const docs: unknown = await client().fetch(projection, { ids: PAGE_SEO_PAGES.map(page => page.documentId) }, { cache: "no-store" });
  if (!Array.isArray(docs)) throw new Error("PAGE_SEO_READ_FAILED");
  const saved = docs.map(fieldsFromDocument);
  return PAGE_SEO_PAGES.map(page => {
    const matches = saved.filter(doc => doc.id === page.documentId && doc.pathname === page.pathname);
    if (matches.length > 1 || saved.some(doc => doc.id === page.documentId && doc.pathname !== page.pathname)) throw new Error("PAGE_SEO_IDENTITY_INVALID");
    return { pathname: page.pathname, label: page.label, defaults: page.defaults, revision: matches[0]?.revision ?? null, overrides: matches[0]?.overrides ?? {} };
  });
}

export function parsePageSeoSave(value: unknown) {
  const parsed = z.object({ pathname: z.string().max(160), revision: z.string().min(1).max(200).nullable(), fields: z.unknown() }).strict().parse(value);
  if (!getPageSeoPage(parsed.pathname)) throw new Error("PAGE_SEO_PATH_INVALID");
  return { ...parsed, fields: validatePageSeoFields(parsed.fields) };
}

export async function savePageSeo(input: ReturnType<typeof parsePageSeoSave>): Promise<{ revision: string; fields: PageSeoFields }> {
  const page = getPageSeoPage(input.pathname);
  if (!page) throw new Error("PAGE_SEO_PATH_INVALID");
  const fields = Object.fromEntries(PAGE_SEO_FIELDS.map(key => [key, input.fields[key] ?? null])) as PageSeoFields;
  const sanity = client(true);
  if (input.revision !== null) {
    const current: unknown = await sanity.fetch(groq`*[_id == $id][0]{ _id, _type, _rev, pathname }`, { id: page.documentId }, { cache: "no-store" });
    const identity = z.object({ _id: z.literal(page.documentId), _type: z.literal("pageSeo"), _rev: z.literal(input.revision), pathname: z.literal(page.pathname) }).safeParse(current);
    if (!identity.success) throw Object.assign(new Error("PAGE_SEO_REVISION_CONFLICT"), { statusCode: 409 });
  }
  // Native create is atomic: an existing singleton must conflict, never replace it.
  const saved = input.revision === null
    ? await sanity.create({ _id: page.documentId, _type: "pageSeo", pathname: page.pathname, ...fields })
    : await sanity.patch(page.documentId).ifRevisionId(input.revision).set(fields).commit();
  const result = fieldsFromDocument(saved);
  if (result.id !== page.documentId || result.pathname !== page.pathname) throw new Error("PAGE_SEO_IDENTITY_INVALID");
  return { revision: result.revision, fields: result.overrides };
}

function decodeHtml(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (whole, entity: string) => {
    if (entity[0] !== "#") return ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " } as Record<string, string>)[entity.toLowerCase()] ?? whole;
    const point = Number.parseInt(entity.slice(entity[1]?.toLowerCase() === "x" ? 2 : 1), entity[1]?.toLowerCase() === "x" ? 16 : 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : whole;
  });
}

export function extractPageSeoTags(html: string): Record<string, string | null> {
  // Script strings are serialized application state, not metadata DOM elements.
  const head = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const tags: Record<string, string | null> = { title: null, description: null, ogTitle: null, ogDescription: null, ogImageUrl: null, twitterTitle: null, twitterDescription: null, twitterImageUrl: null, canonical: null, robots: null };
  for (const title of head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)) tags.title = decodeHtml(title[1]);
  const names: Record<string, string> = { description: "description", "og:title": "ogTitle", "og:description": "ogDescription", "og:image": "ogImageUrl", "twitter:title": "twitterTitle", "twitter:description": "twitterDescription", "twitter:image": "twitterImageUrl", robots: "robots" };
  for (const match of head.matchAll(/<(?:meta|link)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const attr of match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[attr[1].toLowerCase()] = decodeHtml(attr[2] ?? attr[3] ?? attr[4]);
    const key = names[(attrs.name ?? attrs.property ?? "").toLowerCase()];
    if (key && attrs.content !== undefined) tags[key] = attrs.content;
    if (attrs.rel?.toLowerCase() === "canonical") tags.canonical = attrs.href ?? null;
  }
  return tags;
}

export async function readPageSeoTags(pathname: string): Promise<PageSeoReadback> {
  if (!isPageSeoUatAllowed()) throw new Error("PAGE_SEO_UAT_REQUIRED");
  if (!getPageSeoPage(pathname)) throw new Error("PAGE_SEO_PATH_INVALID");
  try {
    const response = await fetch("https://test.ccpun.com" + pathname, { redirect: "manual", cache: "no-store", headers: { Accept: "text/html", "User-Agent": "Googlebot" }, signal: AbortSignal.timeout(8_000) });
    if (response.status !== 200 || !response.headers.get("content-type")?.includes("text/html") || !response.body) return { verified: false, status: response.status, tags: null, error: "not-served" };
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let html = "", bytes = 0;
    // Native Next metadata can arrive after </head>. Only a complete bounded
    // response is evidence; a prefix must never be labelled as served metadata.
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 256_000) {
        await reader.cancel();
        return { verified: false, status: 200, tags: null, error: "metadata-not-verified" };
      }
      html += decoder.decode(chunk.value, { stream: true });
    }
    html += decoder.decode();
    if (!/<\/head\s*>/i.test(html) || !/<\/html\s*>/i.test(html)) return { verified: false, status: 200, tags: null, error: "metadata-not-verified" };
    const tags = extractPageSeoTags(html);
    return { verified: tags.title !== null, status: 200, tags, error: tags.title === null ? "metadata-missing" : null };
  } catch { return { verified: false, status: null, tags: null, error: "request-failed" }; }
}
