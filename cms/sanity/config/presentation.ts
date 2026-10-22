import { getPageSeoPage } from "../../../lib/content/page-seo-registry";
import { PUBLIC_COPY_SCOPES, publicCopyDocumentId, type PublicCopyScope } from "../../../lib/content/public-copy-registry";
import { defineLocations, presentationTool } from "sanity/presentation";

export function createStudioPresentationPlugin() {
  return presentationTool({
    title: "ตัวอย่างเว็บไซต์",
    previewUrl: {
      initial: "/blog/",
      previewMode: {
        enable: "/api/preview/enable",
      },
    },
    resolve: {
      locations: {
        publicPageCopy: defineLocations({
          select: { id: "_id", scope: "scope" },
          resolve: document => {
            const scope = document?.scope;
            const valid = typeof scope === "string" && Object.hasOwn(PUBLIC_COPY_SCOPES, scope)
              && String(document?.id ?? "").replace(/^drafts\./, "") === publicCopyDocumentId(scope as PublicCopyScope);
            return { locations: valid ? [{ title: "ดูฉบับร่างหน้าเว็บไซต์", href: `/content/website-preview/?scope=${encodeURIComponent(scope)}` }] : [] };
          },
        }),
        pageSeo: defineLocations({
          select: { id: "_id", pathname: "pathname" },
          resolve: document => {
            const page = getPageSeoPage(String(document?.pathname ?? ""));
            if (!page || String(document?.id ?? "").replace(/^drafts\./, "") !== page.documentId) return { locations: [] };
            const scope = Object.entries(PUBLIC_COPY_SCOPES).find(([scope, config]) => scope !== "site" && config.pathname === document?.pathname)?.[0];
            return { locations: scope ? [{ title: "ดูฉบับร่างหน้าเว็บไซต์และ SEO", href: `/content/website-preview/?scope=${encodeURIComponent(scope)}` }] : [] };
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
