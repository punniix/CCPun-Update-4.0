import "server-only";

import { resolveContentEnvironment } from "./sanity-lane";

export function getSanityReadToken(): string | undefined {
  const value = resolveContentEnvironment() === "local-production"
    ? process.env.SANITY_PRODUCTION_API_READ_TOKEN
    : process.env.SANITY_API_READ_TOKEN;
  return value?.trim() || undefined;
}
