import "server-only";
import type { Metadata, ResolvingMetadata } from "next";
import { sanityFetch } from "@/lib/content/sanity-fetch";
import { resolveContentEnvironment } from "@/lib/content/sanity-lane";
import { getPageSeoPage, validatePageSeoFields } from "@/lib/content/page-seo-registry";

function replaceImage(images: unknown, url: string) {
  const entries = Array.isArray(images) ? images : images ? [images] : [];
  const first = entries[0];
  const originalUrl = typeof first === "string" || first instanceof URL ? String(first) : first?.url ? String(first.url) : null;
  return [{ ...(originalUrl === url && first && typeof first === "object" && !(first instanceof URL) ? first : {}), url }, ...entries.slice(1)];
}

export async function resolvePageSeoMetadata(pathname: string, defaults: Metadata, parent?: ResolvingMetadata): Promise<Metadata> {
  const page = getPageSeoPage(pathname);
  if (!page || !["web-uat", "local-uat"].includes(resolveContentEnvironment())) return defaults;
  try {
    const { data } = await sanityFetch({
      query: '*[_id == $id && _type == "pageSeo" && pathname == $pathname][0]{_id, pathname, seoTitle, seoDescription, ogTitle, ogDescription, ogImageUrl}',
      params: { id: page.documentId, pathname },
      perspective: "published",
      stega: false,
    });
    if (!data) return defaults;
    const { _id: id, pathname: path, ...rawFields } = data;
    if (id !== page.documentId || path !== pathname) return defaults;
    const fields = validatePageSeoFields(rawFields);
    if (!Object.values(fields).some(Boolean)) return defaults;
    const result: Metadata = { ...defaults };
    if (fields.seoTitle) result.title = fields.seoTitle;
    if (fields.seoDescription) result.description = fields.seoDescription;
    if (fields.ogTitle || fields.ogDescription || fields.ogImageUrl) {
      const inherited = parent ? await parent : null;
      const openGraph = { ...inherited?.openGraph, ...defaults.openGraph };
      const twitter = { ...inherited?.twitter, ...defaults.twitter };
      result.openGraph = {
        ...openGraph,
        ...(fields.ogTitle ? { title: fields.ogTitle } : {}),
        ...(fields.ogDescription ? { description: fields.ogDescription } : {}),
        ...(fields.ogImageUrl ? { images: replaceImage(openGraph.images, fields.ogImageUrl) } : {}),
      };
      result.twitter = {
        ...twitter,
        ...(fields.ogTitle ? { title: fields.ogTitle } : {}),
        ...(fields.ogDescription ? { description: fields.ogDescription } : {}),
        ...(fields.ogImageUrl ? { images: replaceImage(twitter.images, fields.ogImageUrl) } : {}),
      };
    }
    return result;
  } catch {
    return defaults;
  }
}
