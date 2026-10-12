export function editorialDashboardSteps(lane: string, environment: string | undefined, studioReady: boolean, reviewHref: string) {
  return [
    ["1", "เลือกหรือสร้างบทความ", "/content/articles/", `เลือกบทความจาก ${lane} หรือสร้างฉบับร่างใหม่`],
    ["2", "ตรวจ SEO", "/seo/", "ดูผลตรวจที่บันทึกไว้และเหตุผลจากกฎที่อธิบายได้"],
    ["3", "ตรวจข้อเสนอ", reviewHref, "คุณเป็นคนตัดสินใจว่าจะอนุมัติหรือไม่"],
    ["4", "นำไปใช้กับฉบับร่าง", reviewHref, `แก้เฉพาะฉบับร่าง ${lane} และไม่เผยแพร่`],
    ["5", environment === "local-production" ? "เปิดตัวอย่างและเผยแพร่" : "เปิดตัวอย่าง", "/studio/", studioReady ? "ตรวจหน้าจริงอีกครั้งใน Studio แล้วคุณจึงเลือก Publish หรือ Schedule เอง" : "Studio ปิดอยู่ในโหมดอ่านอย่างเดียว"],
  ] as const;
}
