import { defineArrayMember, defineField, defineType } from "sanity";

export const providerQuota = defineType({
  name: "providerQuota",
  title: "Provider quota",
  type: "object",
  fields: [
    defineField({ name: "key", title: "Key", type: "string", readOnly: true, validation: (Rule) => Rule.required() }),
    defineField({ name: "label", title: "Label", type: "string", readOnly: true, validation: (Rule) => Rule.required() }),
    defineField({ name: "limit", title: "Limit", type: "number", readOnly: true, validation: (Rule) => Rule.required().min(0) }),
    defineField({ name: "used", title: "Used", type: "number", readOnly: true, validation: (Rule) => Rule.required().min(0) }),
    defineField({ name: "remaining", title: "Remaining", type: "number", readOnly: true, validation: (Rule) => Rule.required().min(0) }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      readOnly: true,
      options: { list: ["available", "near-limit", "full"] },
      validation: (Rule) => Rule.required(),
    }),
  ],
});

export const ubersuggestAccountSnapshot = defineType({
  name: "ubersuggestAccountSnapshot",
  title: "Ubersuggest Account Snapshot",
  type: "document",
  fields: [
    defineField({ name: "provider", title: "Provider", type: "string", readOnly: true, initialValue: "ubersuggest" }),
    defineField({ name: "tier", title: "Account tier", type: "string", readOnly: true }),
    defineField({ name: "domain", title: "Domain", type: "string", readOnly: true, validation: (Rule) => Rule.required() }),
    defineField({ name: "projectId", title: "Provider project ID", type: "string", readOnly: true, validation: (Rule) => Rule.required() }),
    defineField({ name: "updateFrequency", title: "Legacy update frequency", type: "string", readOnly: true, hidden: true }),
    defineField({ name: "projectUpdateFrequency", title: "Project update frequency", type: "string", readOnly: true }),
    defineField({ name: "brandUpdateFrequency", title: "AISV update frequency", type: "string", readOnly: true }),
    defineField({ name: "sourceRuntime", title: "Fetched by runtime", type: "string", readOnly: true }),
    defineField({ name: "fetchedAt", title: "Fetched at", type: "datetime", readOnly: true }),
    defineField({ name: "quotas", title: "Quotas", type: "array", readOnly: true, of: [defineArrayMember({ type: "providerQuota" })] }),
    defineField({ name: "checkedAt", title: "Checked at", type: "datetime", readOnly: true, validation: (Rule) => Rule.required() }),
  ],
  orderings: [{ title: "Newest", name: "newest", by: [{ field: "checkedAt", direction: "desc" }] }],
});

export const ubersuggestGeoProvider = defineType({
  name: "ubersuggestGeoProvider",
  title: "Ubersuggest GEO provider",
  type: "object",
  fields: [
    defineField({ name: "provider", title: "Provider", type: "string", readOnly: true }),
    defineField({ name: "averageRank", title: "Average rank", type: "number", readOnly: true }),
    defineField({ name: "totalMentions", title: "Total mentions", type: "number", readOnly: true, validation: (Rule) => Rule.min(0) }),
    defineField({ name: "visibilityPercentage", title: "Visibility %", type: "number", readOnly: true, validation: (Rule) => Rule.min(0).max(100) }),
  ],
});

export const ubersuggestGeoCompetitor = defineType({
  name: "ubersuggestGeoCompetitor",
  title: "Ubersuggest GEO competitor",
  type: "object",
  fields: [
    defineField({ name: "brandName", title: "Brand", type: "string", readOnly: true }),
    defineField({ name: "brandDomain", title: "Domain", type: "string", readOnly: true }),
    defineField({ name: "averageRank", title: "Average rank", type: "number", readOnly: true }),
    defineField({ name: "totalMentions", title: "Total mentions", type: "number", readOnly: true, validation: (Rule) => Rule.min(0) }),
    defineField({ name: "visibilityPercentage", title: "Visibility %", type: "number", readOnly: true, validation: (Rule) => Rule.min(0).max(100) }),
    defineField({ name: "sentimentLabel", title: "Sentiment", type: "string", readOnly: true }),
  ],
});

export const ubersuggestGeoIntent = defineType({
  name: "ubersuggestGeoIntent",
  title: "Ubersuggest GEO intent",
  type: "object",
  fields: [
    defineField({ name: "intent", title: "Intent", type: "string", readOnly: true }),
    defineField({ name: "value", title: "Share", type: "number", readOnly: true, validation: (Rule) => Rule.min(0) }),
  ],
});

export const ubersuggestGeoPrompt = defineType({
  name: "ubersuggestGeoPrompt",
  title: "Ubersuggest GEO prompt",
  type: "object",
  fields: [
    defineField({ name: "promptText", title: "Prompt", type: "text", rows: 2, readOnly: true }),
    defineField({ name: "topic", title: "Topic", type: "string", readOnly: true }),
    defineField({ name: "language", title: "Language", type: "string", readOnly: true }),
    defineField({ name: "locId", title: "Location ID", type: "number", readOnly: true }),
    defineField({ name: "intents", title: "Intents", type: "array", readOnly: true, of: [defineArrayMember({ type: "string" })] }),
    defineField({ name: "totalAnswers", title: "Total answers", type: "number", readOnly: true, validation: (Rule) => Rule.min(0) }),
    defineField({ name: "userAverageRank", title: "CCPun average rank", type: "number", readOnly: true }),
    defineField({ name: "userTotalMentions", title: "CCPun mentions", type: "number", readOnly: true, validation: (Rule) => Rule.min(0) }),
    defineField({ name: "userVisibilityPercentage", title: "CCPun visibility %", type: "number", readOnly: true, validation: (Rule) => Rule.min(0).max(100) }),
    defineField({ name: "topBrands", title: "Top brands", type: "array", readOnly: true, of: [defineArrayMember({ type: "string" })] }),
  ],
});

export const ubersuggestGeoSnapshot = defineType({
  name: "ubersuggestGeoSnapshot",
  title: "Ubersuggest GEO/AEO Snapshot",
  type: "document",
  fields: [
    defineField({ name: "provider", title: "Provider", type: "string", readOnly: true, initialValue: "ubersuggest" }),
    defineField({ name: "domain", title: "Domain", type: "string", readOnly: true, validation: (Rule) => Rule.required() }),
    defineField({ name: "projectId", title: "Provider project ID", type: "string", readOnly: true, validation: (Rule) => Rule.required() }),
    defineField({ name: "windowStart", title: "Window start", type: "date", readOnly: true }),
    defineField({ name: "windowEnd", title: "Window end", type: "date", readOnly: true }),
    defineField({ name: "visibilityPercentage", title: "CCPun visibility %", type: "number", readOnly: true, validation: (Rule) => Rule.min(0).max(100) }),
    defineField({ name: "totalMentions", title: "CCPun mentions", type: "number", readOnly: true, validation: (Rule) => Rule.min(0) }),
    defineField({ name: "shareOfVoice", title: "CCPun share of voice", type: "number", readOnly: true, validation: (Rule) => Rule.min(0) }),
    defineField({ name: "averageRank", title: "CCPun average rank", type: "number", readOnly: true }),
    defineField({ name: "totalAnswers", title: "AI answers", type: "number", readOnly: true, validation: (Rule) => Rule.min(0) }),
    defineField({ name: "totalPrompts", title: "Tracked prompts", type: "number", readOnly: true, validation: (Rule) => Rule.min(0) }),
    defineField({ name: "totalCompetitors", title: "Competitors found", type: "number", readOnly: true, validation: (Rule) => Rule.min(0) }),
    defineField({ name: "providers", title: "Provider breakdown", type: "array", readOnly: true, of: [defineArrayMember({ type: "ubersuggestGeoProvider" })] }),
    defineField({ name: "competitors", title: "Competitor visibility", type: "array", readOnly: true, of: [defineArrayMember({ type: "ubersuggestGeoCompetitor" })] }),
    defineField({ name: "intents", title: "Aggregated intents", type: "array", readOnly: true, of: [defineArrayMember({ type: "ubersuggestGeoIntent" })] }),
    defineField({ name: "prompts", title: "Prompt breakdown", type: "array", readOnly: true, of: [defineArrayMember({ type: "ubersuggestGeoPrompt" })] }),
    defineField({ name: "reportStatus", title: "Report status", type: "string", readOnly: true, options: { list: ["ready", "partial", "pending_update"] } }),
    defineField({ name: "sourceRuntime", title: "Fetched by runtime", type: "string", readOnly: true }),
    defineField({ name: "promptsUpdatedAt", title: "Prompts updated at", type: "date", readOnly: true }),
    defineField({ name: "answerCollectedAt", title: "AI answers collected at", type: "datetime", readOnly: true }),
    defineField({ name: "fetchedAt", title: "Fetched at", type: "datetime", readOnly: true }),
    defineField({ name: "limitations", title: "Limitations", type: "array", readOnly: true, of: [defineArrayMember({ type: "string" })] }),
    defineField({ name: "checkedAt", title: "Checked at", type: "datetime", readOnly: true, validation: (Rule) => Rule.required() }),
  ],
  orderings: [{ title: "Newest", name: "newest", by: [{ field: "checkedAt", direction: "desc" }] }],
});

export const ubersuggestSchemaTypes = [
  providerQuota,
  ubersuggestGeoProvider,
  ubersuggestGeoCompetitor,
  ubersuggestGeoIntent,
  ubersuggestGeoPrompt,
  ubersuggestAccountSnapshot,
  ubersuggestGeoSnapshot,
];
