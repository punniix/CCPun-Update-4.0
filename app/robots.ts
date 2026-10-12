import { robotsPolicy } from "@/lib/routing/robots-policy";
import type { MetadataRoute } from "next";
import { getAdminEnvironment } from "@/lib/admin/environment";
import { ADMIN_PAGE_PREFIXES } from "@/lib/admin/routes";
import { IS_REVIEW_ENVIRONMENT } from "@/lib/deployment-environment";

const privatePaths = ["/api/", "/login/", ...ADMIN_PAGE_PREFIXES.map((path) => `${path}/`), "/admin-not-found/", "/snt-admin/", "/studio/"];

export default function robots(): MetadataRoute.Robots {
  return robotsPolicy(IS_REVIEW_ENVIRONMENT || getAdminEnvironment() === "production-admin", privatePaths);
}
