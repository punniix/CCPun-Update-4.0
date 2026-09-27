import type { MetadataRoute } from "next";
import { CONTROL_PLANE_PAGE_PREFIXES } from "@/lib/routing/private-surfaces";
import { shouldBlockWebIndexing } from "../runtime-environment";

const privatePaths = [
  "/api/",
  "/login/",
  ...CONTROL_PLANE_PAGE_PREFIXES.map((path) => `${path}/`),
  "/snt-admin/",
  "/studio/",
];

export default function robots(): MetadataRoute.Robots {
  const blockAll = shouldBlockWebIndexing();

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
