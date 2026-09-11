import { defineField, defineType } from "sanity";

export const publishSchedule = defineType({
  name: "publishSchedule",
  title: "Publish Schedule (System)",
  type: "document",
  fields: [
    defineField({ name: "articleId", type: "string", readOnly: true, validation: (rule) => rule.required() }),
    defineField({ name: "draftId", type: "string", readOnly: true, validation: (rule) => rule.required() }),
    defineField({ name: "draftRevision", type: "string", readOnly: true, validation: (rule) => rule.required() }),
    defineField({ name: "scheduledAt", type: "datetime", readOnly: true, validation: (rule) => rule.required() }),
    defineField({ name: "timezone", type: "string", readOnly: true, validation: (rule) => rule.required() }),
    defineField({ name: "generation", type: "string", readOnly: true, validation: (rule) => rule.required() }),
    defineField({
      name: "status",
      type: "string",
      readOnly: true,
      options: { list: ["scheduled", "published", "stale", "cancelled", "failed"] },
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "createdByRole", type: "string", readOnly: true }),
    defineField({ name: "createdAt", type: "datetime", readOnly: true, validation: (rule) => rule.required() }),
    defineField({ name: "updatedAt", type: "datetime", readOnly: true, validation: (rule) => rule.required() }),
    defineField({ name: "completedAt", type: "datetime", readOnly: true }),
    defineField({ name: "errorCode", type: "string", readOnly: true }),
  ],
  preview: {
    select: { articleId: "articleId", scheduledAt: "scheduledAt", status: "status" },
    prepare({ articleId, scheduledAt, status }) {
      return { title: articleId || "Publish schedule", subtitle: `${status || "unknown"} · ${scheduledAt || "no time"}` };
    },
  },
});
