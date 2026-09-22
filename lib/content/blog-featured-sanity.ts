import "server-only";

import { groq } from "next-sanity";
import { sanityFetch } from "@/lib/sanity-live";

const blogFeaturedQuery = groq`*[_type == "blogSettings" && _id == "blog-settings"][0]{
  "featuredArticleIds": featuredArticles[]._ref
}`;

export async function listBlogFeaturedArticleIds(): Promise<string[]> {
  try {
    const { data } = await sanityFetch({
      query: blogFeaturedQuery,
      perspective: "published",
      stega: false,
    });
    const ids = (data as { featuredArticleIds?: unknown } | null)?.featuredArticleIds;
    if (!Array.isArray(ids)) return [];
    return ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  } catch (error) {
    console.error("[blog-featured] global featured settings unavailable", {
      type: error instanceof Error ? error.name : "unknown",
    });
    return [];
  }
}
