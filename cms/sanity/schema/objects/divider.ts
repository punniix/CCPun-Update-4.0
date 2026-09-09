import { Minus } from "lucide-react";
import { defineField, defineType } from "sanity";

export const divider = defineType({
  name: "divider",
  title: "เส้นคั่นเนื้อหา",
  type: "object",
  icon: Minus,
  preview: { prepare: () => ({ title: "เส้นคั่นเนื้อหา" }) },
  fields: [defineField({ name: "label", title: "ชื่อ", type: "string", hidden: true, initialValue: "divider" })],
});
