import "server-only";

import { groq } from "next-sanity";
import { sanityFetch } from "@/lib/sanity-live";
import { parseBlogFeaturedArticleIds } from "./featured-articles";
import { retryTransientSanityRead } from "./sanity-resilience";

const blogFeaturedQuery = groq`*[_type == "blogSettings" && _id == "blog-settings"][0]{
  "featuredArticleIds": featuredArticles[]._ref
}`;

export async function listBlogFeaturedArticleIds(): Promise<string[] | null> {
  try {
    const { data } = await retryTransientSanityRead(() => sanityFetch({
      query: blogFeaturedQuery,
      perspective: "published",
      stega: false,
    }));
    return parseBlogFeaturedArticleIds(data);
  } catch (error) {
    console.error("[blog-featured] global featured settings unavailable", {
      type: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}
