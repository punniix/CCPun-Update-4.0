import "server-only";
import { notFound } from "next/navigation";
import { requireAdminPermission } from "./require-permission";
import { getAdminEnvironment, isAdminReadDataPlaneAllowed } from "./environment";
import { sanityFetch } from "../content/sanity-fetch";
import { PUBLIC_COPY_SCOPES, parsePublicCopy, publicCopyDocumentId, type PublicCopyScope } from "../content/public-copy-registry";
import { getPageSeoPage, validatePageSeoFields } from "../content/page-seo-registry";

export async function getPublicCopyPreview(scope: PublicCopyScope = "home") {
  await requireAdminPermission("draft:apply");
  const environment = getAdminEnvironment();
  if (!["production-admin", "local-production"].includes(environment) || !isAdminReadDataPlaneAllowed("production", environment)) notFound();
  if (!Object.hasOwn(PUBLIC_COPY_SCOPES, scope)) notFound();
  const contentScope = scope === "site" ? "home" : scope;
  const read = async (scope: PublicCopyScope) => {
    const { data } = await sanityFetch({
      query: '*[_id == $id && _type == "publicPageCopy"][0]{_id, _type, scope, locale, entries[]{_key, key, text}}',
      params: { id: publicCopyDocumentId(scope) }, perspective: "drafts",
    });
    return parsePublicCopy(scope, data);
  };
  const seoPage = getPageSeoPage(PUBLIC_COPY_SCOPES[contentScope].pathname)!;
  const [copy, site, { data: seo }] = await Promise.all([
    read(contentScope), read("site"), sanityFetch({
      query: '*[_id == $id && _type == "pageSeo" && pathname == $pathname][0]{seoTitle, seoDescription, ogTitle, ogDescription, ogImageUrl}',
      params: { id: seoPage.documentId, pathname: seoPage.pathname }, perspective: "drafts",
    }),
  ]);
  return { copy, site, seo: { ...seoPage.defaults, ...Object.fromEntries(Object.entries(validatePageSeoFields(seo ?? {})).filter(([, value]) => value)) } };
}
