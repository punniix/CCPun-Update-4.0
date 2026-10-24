import type { SiteCopyKey } from "@/lib/content/public-copy-registry";

export const V5_LINE_URL = "https://lin.ee/tqLCs4f";
export const V5_THEME_STORAGE_KEY = "ccpun-theme";

/** Existing public tool owners; labels come from the site copy registry. */
export const V5_TOOL_LINKS = [
  { id: "moneyStory", href: "/play/money-story/", navKey: "site.nav.moneyStory", nameKey: "site.tools.moneyStory" },
  { id: "fhc", href: "/tools/financial-health-check/", navKey: "site.nav.fhc", nameKey: "site.tools.fhc" },
  { id: "ci", href: "/ci-planning/", navKey: "site.nav.ci", nameKey: "site.tools.ci" },
] as const satisfies readonly { id: string; href: string; navKey: SiteCopyKey; nameKey: SiteCopyKey }[];

export type V5ToolId = (typeof V5_TOOL_LINKS)[number]["id"];
