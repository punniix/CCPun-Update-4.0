import { getPageSeoPage } from "../../../lib/content/page-seo-registry";
import { PUBLIC_COPY_SCOPES, publicCopyDocumentId, isPublicCopyScopeAvailable, type PublicCopyScope } from "../../../lib/content/public-copy-registry";
import { defineLocations, presentationTool } from "sanity/presentation";

export function createStudioPresentationPlugin(dataset: string) {
  return presentationTool({
    title: "ตัวอย่างเว็บไซต์",
    previewUrl: {
      initial: "/content/website-preview/home/",
      previewMode: {
        enable: "/api/preview/enable",
      },
    },
    resolve: {
      mainDocuments: [{
        route: "/content/website-preview/:scope",
        resolve: ({ params }) => {
          if (params.scope === "author-home") return { filter: '_type == "author" && _id in ["ccpun-author-ccpun-profile", "ccpun-prod-mirror-author-ccpun"]' };
          const seo = params.scope.startsWith("seo-");
          const scope = (seo ? params.scope.slice(4) : params.scope) as PublicCopyScope;
          if (!isPublicCopyScopeAvailable(scope, dataset)) return undefined;
          const page = getPageSeoPage(PUBLIC_COPY_SCOPES[scope].pathname);
          if (seo && !page) return undefined;
          return { filter: "_id == $id && _type == $type", params: { id: seo ? page!.documentId : publicCopyDocumentId(scope), type: seo ? "pageSeo" : "publicPageCopy" } };
        },
      }],
      locations: {
        author: defineLocations({
          select: { id: "_id" },
          resolve: document => ({ locations: ["ccpun-author-ccpun-profile", "ccpun-prod-mirror-author-ccpun"].includes(String(document?.id ?? "").replace(/^drafts\./, ""))
            ? [{ title: "ดูชื่อและคุณวุฒิบนหน้าแรก", href: "/content/website-preview/author-home/" }] : [] }),
        }),
        publicPageCopy: defineLocations({
          select: { id: "_id", scope: "scope" },
          resolve: document => {
            const scope = document?.scope;
            const valid = typeof scope === "string" && isPublicCopyScopeAvailable(scope, dataset)
              && String(document?.id ?? "").replace(/^drafts\./, "") === publicCopyDocumentId(scope as PublicCopyScope);
            return { locations: valid ? [{ title: "ดูฉบับร่างหน้าเว็บไซต์", href: `/content/website-preview/${encodeURIComponent(scope)}/` }] : [] };
          },
        }),
        pageSeo: defineLocations({
          select: { id: "_id", pathname: "pathname" },
          resolve: document => {
            const page = getPageSeoPage(String(document?.pathname ?? ""));
            if (!page || String(document?.id ?? "").replace(/^drafts\./, "") !== page.documentId) return { locations: [] };
            const scope = Object.entries(PUBLIC_COPY_SCOPES).find(([scope, config]) => scope !== "site" && isPublicCopyScopeAvailable(scope, dataset) && config.pathname === document?.pathname)?.[0];
            return { locations: scope ? [{ title: "ดูฉบับร่างหน้าเว็บไซต์และ SEO", href: `/content/website-preview/seo-${encodeURIComponent(scope)}/` }] : [] };
          },
        }),
        article: defineLocations({
          select: { title: "title", slug: "slug.current", categorySlug: "category.slug.current" },
          resolve: (document) => ({
            locations: document?.slug
              ? [
                  { title: document.title || "บทความใหม่", href: `/blog/${document.categorySlug || "personal-finance"}/${document.slug}/` },
                  { title: "รวมบทความ", href: "/blog/" },
                ]
              : [{ title: "รวมบทความ", href: "/blog/" }],
          }),
        }),
      },
    },
  });
}
