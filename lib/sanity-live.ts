import "server-only";

/**
 * Backward-compatible public content fetch entry point.
 * Preview-only Sanity Live tooling lives under lib/admin so normal website
 * requests cannot pull preview client modules into their initial JS.
 */
export { sanityFetch } from "@/lib/content/sanity-fetch";
