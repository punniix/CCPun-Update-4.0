import { getHomeCopyFaqs } from "@/lib/content/public-copy-registry";

// Compatibility entrypoint; canonical editorial copy lives in the scoped registry.
export { getHomeCopyFaqs };
export const homeFaqs = getHomeCopyFaqs({});
