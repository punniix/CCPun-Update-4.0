import "server-only";
import { INVESTMENT_ALLOCATION_ENABLED } from "../runtime/investment-availability";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "./require-permission";
import { getAdminEnvironment, isAdminReadDataPlaneAllowed } from "./environment";
import { sanityFetch } from "../content/sanity-fetch";
import { PUBLIC_COPY_SCOPES, parsePublicCopy, publicCopyDocumentId, type PublicCopyScope } from "../content/public-copy-registry";
import { getPageSeoPage, validatePageSeoFields } from "../content/page-seo-registry";
import { encodeCopyValue, splitCopyValue } from "../content/public-copy-style";

// Same zero-width encoding Sanity Visual Editing reads (@vercel/stega v1 format):
// a 4-character prefix, then each UTF-8 byte of the JSON as four base-4 digits.
const STEGA_DIGITS = ["\u200B", "\u200C", "\u200D", "\uFEFF"];
function stegaCombine(text: string, info: Record<string, string>) {
  let encoded = STEGA_DIGITS[0].repeat(4);
  for (const byte of new TextEncoder().encode(JSON.stringify(info))) {
    encoded += STEGA_DIGITS[(byte >> 6) & 3] + STEGA_DIGITS[(byte >> 4) & 3] + STEGA_DIGITS[(byte >> 2) & 3] + STEGA_DIGITS[byte & 3];
  }
  return text + encoded;
}

// Each displayed preview text carries a zero-width pointer to its Sanity field, so
// a click on the page in Presentation opens exactly that entry for editing.
function withEditTargets(scope: PublicCopyScope, values: Record<string, string>, entries: Array<{ key: string; _key: string }> = []) {
  const id = publicCopyDocumentId(scope);
  return Object.fromEntries(Object.entries(values).map(([key, value]) => {
    const { text, style } = splitCopyValue(value);
    const persistedKey = entries.find(entry => entry.key === key)?._key;
    const entryKey = typeof persistedKey === "string" && persistedKey ? persistedKey : key.replaceAll(".", "-");
    const path = `entries[_key==${JSON.stringify(entryKey)}].text`;
    const href = `/studio/intent/edit/id=${id};type=publicPageCopy;path=${encodeURIComponent(path)}`;
    return [key, encodeCopyValue(stegaCombine(text, { origin: "sanity.io", href }), style)];
  }));
}

export async function getPublicCopyPreview(scope: PublicCopyScope = "home") {
  await requireAdminPermission("draft:apply");
  const environment = getAdminEnvironment();
  const dataset = ["production-admin", "local-production"].includes(environment) ? "production"
    : ["admin-uat", "local-uat"].includes(environment) ? "uat" : null;
  if (!dataset || !isAdminReadDataPlaneAllowed(dataset, environment)) notFound();
  if (!Object.hasOwn(PUBLIC_COPY_SCOPES, scope)) notFound();
  if (scope === "investment" && !INVESTMENT_ALLOCATION_ENABLED) notFound();
  const contentScope = scope === "site" ? "home" : scope;
  const read = async (scope: PublicCopyScope) => {
    const { data } = await sanityFetch({
      query: '*[_id == $id && _type == "publicPageCopy"][0]{_id, _type, scope, locale, entries[]{_key, key, text, size, sizeMobile, sizeDesktop}}',
      params: { id: publicCopyDocumentId(scope) }, perspective: "drafts",
    });
    const values = parsePublicCopy(scope, data) as Record<string, string>;
    return withEditTargets(scope, values, data?.entries);
  };
  const seoPage = getPageSeoPage(PUBLIC_COPY_SCOPES[contentScope].pathname);
  const [copy, site, { data: seo }] = await Promise.all([
    read(contentScope), read("site"), seoPage ? sanityFetch({
      query: '*[_id == $id && _type == "pageSeo" && pathname == $pathname][0]{seoTitle, seoDescription, ogTitle, ogDescription, ogImageUrl}',
      params: { id: seoPage.documentId, pathname: seoPage.pathname }, perspective: "drafts",
    }) : Promise.resolve({ data: null }),
  ]);
  return { copy, site, seo: seoPage ? { ...seoPage.defaults, ...Object.fromEntries(Object.entries(validatePageSeoFields(seo ?? {}, dataset)).filter(([, value]) => value)) } : null };
}
