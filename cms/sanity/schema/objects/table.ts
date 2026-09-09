import { Table2 } from "lucide-react";
import { defineArrayMember, defineField, defineType } from "sanity";

export const tableRow = defineType({
  name: "tableRow",
  title: "แถวตาราง",
  type: "object",
  icon: Table2,
  preview: { select: { cells: "cells" }, prepare: ({ cells }) => ({ title: Array.isArray(cells) && cells.some(Boolean) ? cells.join(" — ") : "แถวใหม่" }) },
  fields: [
    defineField({ name: "cells", title: "ข้อมูลแต่ละช่อง", type: "array", of: [defineArrayMember({ type: "string" })] }),
  ],
});

export const simpleTable = defineType({
  name: "simpleTable",
  title: "ตาราง",
  type: "object",
  icon: Table2,
  preview: { select: { headers: "headers", rows: "rows" }, prepare: ({ headers, rows }) => ({ title: Array.isArray(headers) && headers.some(Boolean) ? headers.join(" — ") : "ตารางใหม่", subtitle: `${Array.isArray(rows) ? rows.length : 0} แถว` }) },
  fields: [
    defineField({ name: "headers", title: "หัวคอลัมน์", type: "array", of: [defineArrayMember({ type: "string" })] }),
    defineField({
      name: "rows",
      title: "แถวข้อมูล",
      type: "array",
      of: [defineArrayMember({ type: "tableRow" })],
      description: "ตารางจากเว็บเดิมอาจต้องปรับโครงสร้างก่อนแก้ไข โดยไม่เปลี่ยนข้อมูลในแต่ละช่อง",
      validation: (Rule) => Rule.custom((rows) => rows?.some(Array.isArray) ? "พบแถวรูปแบบเก่า ให้ผู้ดูแลตรวจ dry-run ก่อนปรับโครงสร้าง" : true).warning(),
    }),
  ],
});
