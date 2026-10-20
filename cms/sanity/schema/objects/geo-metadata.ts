import { defineArrayMember, defineField, defineType } from "sanity";
import ArticleOverviewInput from "../../components/ArticleOverviewInput";

export const geoMetadata = defineType({
  name: "geoMetadata",
  title: "GEO metadata",
  type: "object",
  fields: [
    defineField({ name: "summary", title: "สรุปภาพรวมบทความ", description: "แสดงใต้ภาพบทความเมื่อเผยแพร่แล้ว เว้นว่างเพื่อซ่อนกล่องสรุป สรุปจากบทความเต็มเป็น 2–3 ประเด็นสั้นตามเนื้อหา", type: "text", rows: 3, components: { input: ArticleOverviewInput } }),
    defineField({ name: "keyEntities", title: "Key entities", type: "array", of: [defineArrayMember({ type: "string" })] }),
    defineField({ name: "keyQuestions", title: "Key questions", type: "array", of: [defineArrayMember({ type: "string" })] }),
    defineField({ name: "reviewedAt", title: "Reviewed at", type: "datetime" }),
  ],
});
