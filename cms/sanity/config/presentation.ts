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
          select: { scope: "scope" },
          resolve: document => ({ locations: [{ title: "ดูฉบับร่างหน้าเว็บไซต์", href: `/content/website-preview/?scope=${encodeURIComponent(document?.scope ?? "home")}` }] }),
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
