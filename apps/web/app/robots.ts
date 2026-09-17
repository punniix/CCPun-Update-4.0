import type { MetadataRoute } from "next";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { ADMIN_PAGE_PREFIXES } from "@/lib/admin/routes";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";

const privatePaths = ["/api/", "/login/", ...ADMIN_PAGE_PREFIXES.map((path) => `${path}/`), "/snt-admin/", "/studio/"];

export default function robots(): MetadataRoute.Robots {
  if (IS_REVIEW_ENVIRONMENT || getAdminEnvironment() === "production-admin") {
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
