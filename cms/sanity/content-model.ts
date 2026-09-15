export const sanityContentModel = {
  version: "4.1",
  taxonomy: {
    primaryCategory: {
      role: "One required primary category controls article grouping and the category URL segment.",
      activeSource: "Sanity category documents where status == active",
      legacyReferencesRemainReadable: true,
    },
    tags: {
      role: "Optional, repeatable topic labels; legacy health and critical-illness categories normalize here.",
      preserveExistingNonblankValues: true,
      caseInsensitiveDedupe: true,
    },
  },
  documents: {
    article: {
      title: "Article",
      nativePublicationState: "Sanity draft/published document state",
      reviewWorkflow: ["drafting", "content-review", "fact-check", "compliance-review", "ready-for-coo", "approved"],
      fieldGroups: ["content", "seo-geo", "sources-review", "publication"],
      fields: [
        { name: "title", type: "string", required: true, group: "content" },
        { name: "slug", type: "slug", required: true, source: "title", unique: true, group: "content" },
        { name: "excerpt", type: "text", required: true, maxLength: 240, group: "content" },
        {
          name: "category",
          type: "reference",
          to: "category",
          required: true,
          group: "content",
          role: "primary",
          selectableWhen: "referenced category.status == active",
        },
        { name: "tags", type: "array", of: "string", group: "content", role: "topic-labels" },
        { name: "author", type: "reference", to: "author", required: true, group: "content" },
        { name: "featuredImage", type: "imageWithAlt", group: "content" },
        { name: "body", type: "portableText", required: true, group: "content" },
        { name: "faq", type: "array", of: "faqItem", group: "content" },
        { name: "sources", type: "array", of: "sourceReference", group: "sources-review" },
        { name: "review", type: "reviewMetadata", required: true, group: "sources-review" },
        { name: "seo", type: "seoMetadata", required: true, group: "seo-geo" },
        { name: "geo", type: "geoMetadata", group: "seo-geo" },
        { name: "contentUpdatedAt", type: "datetime", group: "publication" },
        { name: "publishedAt", type: "datetime", requiredWhenPublished: true, group: "publication" },
      ],
      derivedFields: [
        "updatedAt maps from contentUpdatedAt, then migration.sourceModifiedAt, and only then Sanity _updatedAt so audit-only writes cannot pretend the article changed.",
        "canonical should default to https://ccpun.com/blog/{category-slug}/{slug}/ and only be overridden by an explicit migration decision.",
      ],
      publicationRules: [
        "Draft must never enter production sitemap.",
        "Draft preview must render with noindex,nofollow.",
        "Published article requires title, slug, excerpt, body, author, category and meta description; SEO title may fall back to the article title.",
        "Featured image requires meaningful alt text when present.",
        "FAQPage structured data may only be emitted when the same questions and answers are visible in the article UI.",
        "Sources should be stored as structured references, not pasted into presentation markup.",
        "YMYL articles must pass the configured content/fact/compliance review gates before COO approval and publication.",
      ],
    },
    author: {
      title: "Author",
      fields: [
        { name: "name", type: "string", required: true },
        { name: "slug", type: "slug", required: true, unique: true },
        { name: "bio", type: "text" },
        { name: "credentials", type: "array", of: "string" },
        { name: "sameAs", type: "array", of: "url" },
      ],
    },
    category: {
      title: "Category",
      fields: [
        { name: "title", type: "string", required: true },
        { name: "slug", type: "slug", required: true, unique: true, ownsCanonical: "https://ccpun.com/blog/{slug}/" },
        { name: "status", type: "string", required: true, options: ["draft", "active"], default: "draft" },
        { name: "redirectTo", type: "reference", to: "category", requiredWhenDeactivatingPublicOwner: true },
        { name: "description", type: "text" },
      ],
    },
  },
  objects: {
    imageWithAlt: {
      fields: [
        { name: "asset", type: "image", hotspot: true, required: true },
        { name: "alt", type: "string", required: true },
        { name: "caption", type: "string" },
        { name: "credit", type: "string" },
      ],
    },
    faqItem: {
      fields: [
        { name: "question", type: "string", required: true },
        { name: "answer", type: "text", required: true },
      ],
    },
    sourceReference: {
      fields: [
        { name: "label", type: "string", required: true },
        { name: "url", type: "url" },
        { name: "publisher", type: "string" },
        { name: "accessedAt", type: "date" },
      ],
    },
    reviewMetadata: {
      fields: [
        { name: "status", type: "string", options: ["drafting", "content-review", "fact-check", "compliance-review", "ready-for-coo", "approved"], required: true },
        { name: "contentReviewedAt", type: "datetime" },
        { name: "factCheckedAt", type: "datetime" },
        { name: "complianceReviewedAt", type: "datetime" },
        { name: "notes", type: "text", internalOnly: true },
      ],
    },
    seoMetadata: {
      fields: [
        { name: "title", type: "string", required: false, fallback: "article.title", recommendedLength: "45-60" },
        { name: "description", type: "text", required: true, recommendedLength: "130-160" },
        { name: "focusKeyword", type: "string" },
        { name: "secondaryKeywords", type: "array", of: "string" },
        { name: "keywordCluster", type: "string" },
        { name: "searchIntent", type: "string" },
        { name: "ogTitle", type: "string", fallback: "seo.title || article.title" },
        { name: "ogDescription", type: "text", fallback: "seo.description" },
        { name: "ogImage", type: "imageWithAlt", fallback: "article.featuredImage" },
        { name: "canonical", type: "url", generatedByDefault: true },
        { name: "noindex", type: "boolean", default: false, publicationGuard: true },
      ],
    },
    geoMetadata: {
      fields: [
        { name: "summary", type: "text" },
        { name: "keyEntities", type: "array", of: "string" },
        { name: "keyQuestions", type: "array", of: "string" },
        { name: "reviewedAt", type: "datetime" },
      ],
    },
  },
} as const;
