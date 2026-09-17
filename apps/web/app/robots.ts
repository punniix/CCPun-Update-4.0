import type { MetadataRoute } from "next";
import { resolveContentEnvironment } from "@/lib/content/sanity-lane";
import { CONTROL_PLANE_PAGE_PREFIXES } from "@/lib/routing/private-surfaces";

const privatePaths = [
  "/api/",
  "/login/",
  ...CONTROL_PLANE_PAGE_PREFIXES.map((path) => `${path}/`),
  "/snt-admin/",
  "/studio/",
];

export default function robots(): MetadataRoute.Robots {
  const environment = resolveContentEnvironment();
  const blockAll =
    process.env.VERCEL_ENV === "preview" ||
    process.env.CCPUN_UAT_MODE === "1" ||
    environment !== "production";

  if (blockAll) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: privatePaths,
      },
    ],
    sitemap: "https://ccpun.com/sitemap.xml",
  };
}
