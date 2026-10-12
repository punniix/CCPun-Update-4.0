import { robotsPolicy } from "@/lib/routing/robots-policy";
import type { MetadataRoute } from "next";
import { CONTROL_PLANE_PAGE_PREFIXES } from "@/lib/routing/private-surfaces";
import { shouldBlockWebIndexing } from "../runtime-environment";

export const dynamic = "force-dynamic";

const privatePaths = [
  "/api/",
  "/login/",
  ...CONTROL_PLANE_PAGE_PREFIXES.map((path) => `${path}/`),
  "/admin-not-found/",
  "/snt-admin/",
  "/studio/",
];

export default function robots(): MetadataRoute.Robots {
  return robotsPolicy(shouldBlockWebIndexing(), privatePaths);
}
