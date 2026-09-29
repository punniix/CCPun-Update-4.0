import { aisvSourceRuntimeLabel } from "@/lib/admin/seo-intelligence/aisv";

const seoOverviewLabels: Record<string, string> = {
  "Keyword Research ที่บันทึกไว้": "คำค้นที่บันทึกไว้",
  "AISV Prompt": "AISV Prompt",
  "สถานะ AISV": "AISV Status",
  "AI Visibility": "AI Visibility",
  "AI Mentions": "AI Mentions",
  "AI Answers": "AI Answers",
  "ช่วงรายงาน AISV": "AISV Report Window",
  "Research ล่าสุด": "Latest Research",
  "AISV Runtime": "AISV Runtime",
  "ขอบเขตไฟล์": "Export Scope",
};

const seoLimitations: Record<string, string> = {
  "AISV เป็นแหล่งเสริมที่ยังไม่ configured; รายงานรอบนี้มีเฉพาะ stored Research ไม่ใช่ AISV ค่า 0": "ยังไม่ได้เชื่อมข้อมูลการปรากฏในคำตอบ AI รอบนี้จึงมีเฉพาะคำค้นที่บันทึกไว้ การไม่มีข้อมูล AI ไม่ได้หมายถึงผลเป็น 0%",
  "อ่าน stored Research/AISV เดิม ไม่ยิง Ubersuggest ใหม่; แถว keyword และ prompt มี grain ต่างกัน; provider runtime อยู่บน Local Mac; ไม่รวม 2 คำค้นทดสอบ CSV ที่ COO อนุมัติ": "ใช้ข้อมูลคำค้นและคำตอบ AI ที่บันทึกไว้แล้ว ไม่ดึง Ubersuggest ใหม่ ข้อมูลสองชนิดนับคนละแบบ เก็บข้อมูลจากเครื่องภายใน CCPun และไม่รวมคำค้นทดสอบ 2 รายการ",
  "ถึงขีดจำกัด snapshot 50,000 แถว; raw มี sentinel แถวที่ 50,001 เพื่อยืนยัน coverage ไม่ครบ": "เก็บข้อมูลได้สูงสุด 50,000 แถวในรอบนี้ จึงอาจไม่ครอบคลุมข้อมูลทั้งหมด",
};

const overviewLabels: Record<string, string> = {
  Grain: "Grain",
  "Engaged sessions": "Engaged sessions",
  "Key events": "Key events",
  "Session key event rate (%)": "Session key event rate (%)",
  "Total interactions": "Total interactions",
  "Volume Ubersuggest": "Ubersuggest Volume",
  "Insights ล่าสุดต่อแพลตฟอร์ม": "Latest Insights ต่อแพลตฟอร์ม",
};

// ponytail: translate only the source notes we actually store; preserve every original below the report.
const reportLimitations: Record<string, string> = {
  "Daily native dates; no distinct-user summation; behavioral events are not confirmed leads; page event attribution is event location, not cohort conversion": "ข้อมูลแยกตามวัน จำนวนผู้ใช้ที่ไม่ซ้ำกันห้ามบวกข้ามวัน กิจกรรมบนเว็บไม่ใช่ลูกค้าที่ติดต่อจริง และหน้าที่เกิดกิจกรรมไม่ยืนยันเส้นทางของผู้ใช้คนเดียวกัน",
  "Scope: hostName ccpun.com/www.ccpun.com only; blog.ccpun.com excluded explicitly": "ครอบคลุมเฉพาะ ccpun.com และ www.ccpun.com ไม่รวม blog.ccpun.com",
  "Scope: hostName ccpun.com/www.ccpun.com only; blog excluded. Native day × sessionSourceMedium × campaign × landing page; no event-to-session or business attribution inferred.": "ครอบคลุมเฉพาะเว็บหลัก ไม่รวมบล็อก ข้อมูลหนึ่งแถวแยกตามวัน ช่องทาง แคมเปญ และหน้าเข้า โดยยังเชื่อมกิจกรรมกับเซสชันหรือยอดธุรกิจไม่ได้",
  "Search Console may omit anonymized or low-volume queries.": "Google อาจไม่แสดงคำค้นที่ปกปิดข้อมูลหรือมีจำนวนต่ำ",
  "Final web data; page-only totals and query diagnostics are separate grains; no summation of overlapping report windows": "ยอดตามหน้าเว็บกับรายละเอียดคำค้นเป็นข้อมูลคนละชุด ห้ามบวกยอดจากช่วงรายงานที่ซ้อนกัน",
  "GA4 reports may differ from the UI because of reporting identity and processing time": "ตัวเลขอาจต่างจากหน้ารายงาน Google Analytics เพราะวิธีนับผู้ใช้และเวลาอัปเดตต่างกัน",
  "เฉพาะ Organic Search; ไม่รวม landingPage ที่ (not set); ไม่ใช่ยอดทุกช่องทาง": "นับเฉพาะผู้เข้าชมจากการค้นหา ไม่รวมหน้าที่ Google Analytics ไม่ระบุ และไม่ใช่ยอดผู้เข้าชมทุกช่องทาง",
  "Provider response pages และ insight period/end_time เก็บใน raw ก่อน normalize": "เก็บข้อมูลตอบกลับและช่วงเวลาของสถิติต้นฉบับไว้ก่อนจัดรูปแบบ",
  "Normalized insights ใช้ total_value หรือค่าล่าสุด; series/period เดิมอยู่ใน raw": "ตัวเลขที่แสดงใช้ยอดรวมที่ต้นทางให้หรือค่าล่าสุด และเก็บข้อมูลตามช่วงเวลาเดิมไว้ตรวจสอบ",
  "ตัวเลขเป็น snapshot native ต่อโพสต์ ไม่ใช่ยอดรายวัน; FB reactions และ IG likes มีความหมายต่างกัน; ห้ามรวม Reach ข้ามแพลตฟอร์ม": "ตัวเลขเป็นยอด ณ วันที่เก็บของแต่ละโพสต์ ไม่ใช่ยอดรายวัน การแสดงผลของ Facebook กับ Instagram นับต่างกันและห้ามบวกรวมข้ามแพลตฟอร์ม",
  "อ่าน metadata ได้สูงสุด 10,000 โพสต์; insights เฉพาะ 50 โพสต์ล่าสุดต่อแพลตฟอร์ม; ช่องว่าง = ไม่ได้ดึง/ไม่รองรับ/ไม่คืนค่า": "อ่านรายละเอียดได้สูงสุด 10,000 โพสต์ แต่ดึงสถิติเฉพาะ 50 โพสต์ล่าสุดต่อแพลตฟอร์ม ช่องว่างหมายถึงไม่ได้ดึง ต้นทางไม่รองรับ หรือไม่ส่งค่า",
  "raw เก็บทุกแถว/คอลัมน์หลังตัด credential; normalized เลือกแถวคำค้นซ้ำที่ข้อมูลครบกว่าและไม่นำแถวผิดรูปแบบไปวิเคราะห์": "เก็บข้อมูลต้นฉบับทุกแถวหลังตัดรหัสลับ คำค้นที่ซ้ำจะใช้แถวที่ข้อมูลครบกว่า และไม่นำแถวผิดรูปแบบไปวิเคราะห์",
  "ช่วงข้อมูลและวันที่ต้นทางอัปเดตมาจาก owner; sourceAsOf ที่ระบุเป็นวันที่เท่านั้น ไม่ทราบเวลา/เขตเวลาต้นทาง": "เจ้าของระบบระบุช่วงข้อมูลและวันที่ต้นทางอัปเดต โดยไม่ทราบเวลาหรือเขตเวลาของต้นทาง",
  "ไฟล์ report ที่ owner export จากเว็บไซต์ Ubersuggest; ไม่เรียก MCP/API และไม่ใช้เครดิตค้นหา": "เจ้าของระบบส่งออกไฟล์จากเว็บไซต์ Ubersuggest จึงไม่ใช้เครดิตค้นหาจากระบบเชื่อมต่อ",
  "CPC ตามสกุลเงินที่ระบุ; ว่าง = ไม่ทราบ": "ต้นทุนต่อคลิกโดยประมาณใช้สกุลเงินที่ต้นทางระบุ ช่องว่างหมายถึงไม่ทราบ",
  "ข้อมูลถึงวันก่อนหน้า; sourceAsOf เป็นวันสุดท้ายของช่วง ไม่ใช่เวลาอัปเดต provider": "ข้อมูลถึงวันก่อนหน้า วันที่ต้นทางคือวันสุดท้ายในรายงาน ไม่ใช่เวลาที่ต้นทางอัปเดต",
  "จำนวน event เฉพาะ ci_*, fhc_* และ line_oa_click; event ไม่ใช่ lead ที่ยืนยันแล้ว": "นับเฉพาะกิจกรรมจากเครื่องมือวางแผนและการคลิก LINE การทำกิจกรรมไม่ใช่ลูกค้าที่ติดต่อจริงหรือยืนยันแล้ว",
  "Key events เป็นจำนวน native และอาจมีทศนิยม; Session key event rate (%) มาจาก GA4 โดยตรง ไม่ใช่ key events / sessions; ห้ามเฉลี่ย rate ข้ามแถว": "เหตุการณ์สำคัญอาจมีทศนิยม อัตราต่อเซสชันมาจาก Google Analytics โดยตรง ไม่ใช่การหารจำนวนเหตุการณ์ด้วยเซสชัน และห้ามเฉลี่ยอัตราข้ามแถว",
  "คง (not set) ตามที่ GA4 ส่งคืน; ไม่อนุมาน attribution": "หาก Google Analytics ไม่ระบุแหล่งที่มา ระบบจะแสดงตามต้นทางและไม่เดาแหล่งที่มาแทน",
  "ยอดรวมทุกช่องทาง; จำนวนผู้ใช้เป็น distinct ในช่วงนี้ ห้ามรวมข้ามรายงาน; ไม่รวมวันนี้": "รวมทุกช่องทาง จำนวนผู้ใช้ที่ไม่ซ้ำกันใช้ได้เฉพาะช่วงนี้ ห้ามบวกข้ามรายงาน และยังไม่รวมวันนี้",
  "ไม่รวมคำค้น anonymized; ยอด detail อาจต่างจาก summary; ห้ามเฉลี่ย CTR/อันดับข้ามแถวตรง ๆ": "ไม่รวมคำค้นที่ Google ปกปิด ยอดรายละเอียดอาจต่างจากภาพรวม และห้ามนำอัตราคลิกหรืออันดับมาเฉลี่ยข้ามแถวตรง ๆ",
  "ข้อมูล web search แบบ final; ไม่รวม 3 วันล่าสุด; รายงานภาพรวมไม่แบ่ง dimension": "ข้อมูลการค้นหาที่สรุปแล้ว ยังไม่รวม 3 วันล่าสุด และภาพรวมไม่ได้แยกตามคำค้นหรือหน้าเว็บ",
};

export function ownerAnalyticsOverviewLabel(report: string, label: string): string {
  return report === "seo-intelligence" ? seoOverviewLabels[label] ?? overviewLabels[label] ?? label : overviewLabels[label] ?? label;
}

export function ownerAnalyticsOverviewValue(report: string, label: string, value: string | number | boolean): string | number | boolean {
  if (label === "Grain" && value === "วัน × event name") return "วัน × event name";
  if (label === "Grain" && value === "วัน × source/medium × campaign × landing page") return "วัน × source/medium × campaign × landing page";
  if (report === "ubersuggest-web-keywords" && label === "ประเภทไฟล์" && value === "keyword-coverage") return "Keyword Coverage";
  if (report !== "seo-intelligence") return value;
  if (label === "AISV Runtime") return aisvSourceRuntimeLabel(typeof value === "string" ? value : null);
  if (label === "ขอบเขตไฟล์" && value === "Stored Research + Ubersuggest AISV · export ไม่ยิง provider สด") return "Stored Research + Ubersuggest AISV · Export ไม่เรียก Provider ใหม่";
  return value;
}

export function ownerAnalyticsLimitation(report: string, value: string): string {
  if (report === "seo-intelligence") return seoLimitations[value] ?? (/\b(?:stored|grain|runtime|configured|snapshot|sentinel|provider|raw)\b/i.test(value) ? "มีข้อจำกัดของข้อมูลที่ต้องให้ทีมดูแลตรวจรายละเอียด" : value);
  return reportLimitations[value] ?? (/[A-Za-z]/.test(value) ? "มีข้อจำกัดจากต้นทางที่ยังไม่ได้แปล กรุณาเปิดข้อความต้นฉบับสำหรับทีมดูแลก่อนใช้ตัวเลขนี้ตัดสินใจ" : value);
}
