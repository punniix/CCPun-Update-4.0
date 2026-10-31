import "server-only";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "./require-permission";
import { getAdminEnvironment, isAdminReadDataPlaneAllowed } from "./environment";
import { sanityFetch } from "../content/sanity-fetch";
import { PUBLIC_COPY_SCOPES, isPublicCopyScopeAvailable, parsePublicCopy, publicCopyDocumentId, type PublicCopyScope } from "../content/public-copy-registry";
import { getPageSeoPage, getPageSeoPreviewPage, validatePageSeoFields } from "../content/page-seo-registry";
import { categorySeoPreviewId, CATEGORY_SLUG_PATTERN } from "../content/category-registry";
import { getBlogTopicHub } from "../content/taxonomy";
import { publicCopyText } from "../content/public-copy-registry";
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
    return [key, encodeCopyValue(stegaCombine(text, { origin: "sanity.io", href, baseUrl: "/studio", id, type: "publicPageCopy", path }), style)];
  }));
}

export async function getPublicCopyPreview(scope: PublicCopyScope = "home") {
  await requireAdminPermission("draft:apply");
  const environment = getAdminEnvironment();
  const dataset = ["production-admin", "local-production"].includes(environment) ? "production"
    : ["admin-uat", "local-uat"].includes(environment) ? "uat" : null;
  if (!dataset || !isAdminReadDataPlaneAllowed(dataset, environment)) notFound();
  if (!isPublicCopyScopeAvailable(scope, dataset)) notFound();
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
  const [copy, site, home, { data: seo }] = await Promise.all([
    read(contentScope), read("site"),
    contentScope === "about" || contentScope === "toolsHub" ? read("home") : Promise.resolve(undefined), seoPage ? sanityFetch({
      query: '*[_id == $id && _type == "pageSeo" && pathname == $pathname][0]{seoTitle, seoDescription, ogTitle, ogDescription, ogImageUrl}',
      params: { id: seoPage.documentId, pathname: seoPage.pathname }, perspective: "drafts",
    }) : Promise.resolve({ data: null }),
  ]);
  return { copy, site, home, dataset, seo: seoPage ? { ...seoPage.defaults, ...Object.fromEntries(Object.entries(validatePageSeoFields(seo ?? {}, dataset)).filter(([, value]) => value)) } : null };
}

/** Fixed SEO-only editor identities also cover inactive tools without loading a renderer. */
export async function getPageSeoPreview(previewScope: string) {
  await requireAdminPermission("draft:apply");
  const environment = getAdminEnvironment();
  const dataset = ["production-admin", "local-production"].includes(environment) ? "production"
    : ["admin-uat", "local-uat"].includes(environment) ? "uat" : null;
  if (!dataset || !isAdminReadDataPlaneAllowed(dataset, environment)) notFound();
  const page = getPageSeoPreviewPage(previewScope);
  if (!page) notFound();
  const { data } = await sanityFetch({
    query: '*[_id == $id && _type == "pageSeo" && pathname == $pathname][0]{_id, pathname, seoTitle, seoDescription, ogTitle, ogDescription, ogImageUrl}',
    params: { id: page.documentId, pathname: page.pathname }, perspective: "drafts",
  });
  if (data && (data._id !== page.documentId || data.pathname !== page.pathname)) throw new Error("PAGE_SEO_PREVIEW_IDENTITY_INVALID");
  const { _id: _id, pathname: _pathname, ...raw } = data ?? {};
  void _id; void _pathname;
  const seo = { ...page.defaults, ...Object.fromEntries(Object.entries(validatePageSeoFields(raw, dataset)).filter(([, value]) => value)) };
  const displaySeo = Object.fromEntries(Object.entries(seo).map(([field, value]) => [field, typeof value === "string" && value ? stegaCombine(value, {
    origin: "sanity.io", baseUrl: "/studio", id: page.documentId, type: "pageSeo", path: field,
    href: `/studio/intent/edit/id=${page.documentId};type=pageSeo;path=${field}`,
  }) : value]));
  return { page, dataset, seo, displaySeo, schemaType: "pageSeo" as const };
}

/** Existing Category is the independent SEO owner; no duplicate pageSeo document. */
export async function getCategorySeoPreview(previewScope: string) {
  await requireAdminPermission("draft:apply");
  const environment = getAdminEnvironment();
  const dataset = ["production-admin", "local-production"].includes(environment) ? "production"
    : ["admin-uat", "local-uat"].includes(environment) ? "uat" : null;
  if (!dataset || !isAdminReadDataPlaneAllowed(dataset, environment)) notFound();
  const id = categorySeoPreviewId(previewScope);
  if (!id) notFound();
  const { data } = await sanityFetch({
    query: '*[_id == $id && _type == "category"][0]{_id, title, "slug": slug.current, description, seoTitle, seoDescription}',
    params: { id }, perspective: "drafts",
  });
  if (!data || data._id !== id || typeof data.title !== "string" || typeof data.slug !== "string" || !CATEGORY_SLUG_PATTERN.test(data.slug)) notFound();
  const { data: blog } = await sanityFetch({
    query: '*[_id == $id && _type == "publicPageCopy"][0]{_id, _type, scope, locale, entries[]{_key, key, text}}',
    params: { id: publicCopyDocumentId("blog") }, perspective: "drafts",
  });
  const text = publicCopyText(parsePublicCopy("blog", blog));
  const hub = getBlogTopicHub(data.slug);
  const raw = Object.fromEntries(["seoTitle", "seoDescription"].filter(field => data[field] !== undefined).map(field => [field, data[field]]));
  const edits = validatePageSeoFields(raw, dataset);
  const title = edits.seoTitle || hub?.seoTitle || text("blog.category.seoTitle").replaceAll("{title}", data.title);
  const description = edits.seoDescription || data.description || hub?.description || text("blog.category.description").replaceAll("{title}", data.title);
  const encode = (value: string, field: string) => stegaCombine(value, { origin: "sanity.io", baseUrl: "/studio", id, type: "category", path: field,
    href: `/studio/intent/edit/id=${id};type=category;path=${field}` });
  return { page: { label: `หมวด · ${data.title}`, documentId: id }, dataset, schemaType: "category" as const,
    displaySeo: { seoTitle: encode(title, "seoTitle"), seoDescription: encode(description, "seoDescription"), ogTitle: encode(title, "seoTitle"), ogDescription: encode(description, "seoDescription") } };
}
