export const PAGE_SEO_FIELDS = ["seoTitle", "seoDescription", "ogTitle", "ogDescription", "ogImageUrl"] as const;
export type PageSeoFields = Partial<Record<typeof PAGE_SEO_FIELDS[number], string | null>>;
export type PageSeoPage = { pathname: string; label: string; documentId: string; defaults: Required<PageSeoFields>; previewScope?: string; metadataOnly?: boolean };

export const PAGE_SEO_PAGES: readonly PageSeoPage[] = [
  {
    "pathname": "/",
    "label": "หน้าหลัก",
    "documentId": "pageSeo-home",
    "defaults": {
      "seoTitle": "CCPun | ที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน",
      "seoDescription": "ไม่แน่ใจว่าควรลงทุนหรือทำประกันแบบไหน? CCPun ที่ปรึกษาทางการเงิน ช่วยดูเป้าหมาย ความเสี่ยง และสิ่งที่คุณมี ก่อนค่อยเลือกทางที่เหมาะกับชีวิตคุณ",
      "ogTitle": "ลงทุนหรือทำประกันอะไรดี? เริ่มจากปัญหาที่คุณมีก่อน | CCPun",
      "ogDescription": "เพราะคำว่า “ดีที่สุด” ของคนอื่น อาจไม่ตอบโจทย์คุณ ลองเริ่มจากเป้าหมาย ความเสี่ยง และสิ่งที่คุณมี แล้วค่อยเลือกลงทุนหรือประกันให้เหมาะกับตัวเอง",
      "ogImageUrl": "https://ccpun.com/og-image-20260610.webp?v=68ae8d8"
    }
  },
  {
    "pathname": "/blog/",
    "label": "บทความ",
    "documentId": "pageSeo-blog",
    "defaults": {
      "seoTitle": "บทความการเงิน การลงทุน และการวางแผนอนาคต | CCPun",
      "seoDescription": "เคล็ดลับการเงิน การลงทุน ประกัน และการวางแผนอนาคตจาก CCPun Financial Advisor",
      "ogTitle": "บทความการเงิน การลงทุน และการวางแผนอนาคต | CCPun",
      "ogDescription": "เคล็ดลับการเงิน การลงทุน ประกัน และการวางแผนอนาคตจาก CCPun Financial Advisor",
      "ogImageUrl": "https://ccpun.com/assets/blog-hub-hero-ccpun-v1.webp"
    }
  },
  {
    "pathname": "/ci-planning/",
    "label": "วางแผนทุนโรคร้ายแรง",
    "documentId": "pageSeo-ci-planning",
    "defaults": {
      "seoTitle": "วางแผนทุนโรคร้ายแรงจากรายได้และภาระ | CCPun",
      "seoDescription": "วางแผนทุนโรคร้ายแรงด้วยเครื่องมือประเมินเบื้องต้น เปรียบเทียบรายได้หรือค่าใช้จ่ายกับเงินก้อนและสินทรัพย์สภาพคล่อง เพื่อเห็นส่วนต่างก่อนทบทวนความคุ้มครอง",
      "ogTitle": "วางแผนทุนโรคร้ายแรงจากรายได้และภาระ | CCPun",
      "ogDescription": "วางแผนทุนโรคร้ายแรงด้วยเครื่องมือประเมินเบื้องต้น เปรียบเทียบรายได้หรือค่าใช้จ่ายกับเงินก้อนและสินทรัพย์สภาพคล่อง เพื่อเห็นส่วนต่างก่อนทบทวนความคุ้มครอง",
      "ogImageUrl": "https://ccpun.com/og-image-20260610.webp?v=68ae8d8"
    }
  },
  {
    "pathname": "/tools/financial-health-check/",
    "label": "ตรวจสุขภาพการเงิน",
    "documentId": "pageSeo-financial-health-check",
    "defaults": {
      "seoTitle": "ตรวจสุขภาพการเงิน เริ่มจากช่องว่างความคุ้มครอง | CCPun",
      "seoDescription": "ตรวจสุขภาพการเงินผ่านโมดูลประเมินทุนประกันชีวิต ซึ่งครอบคลุมเฉพาะความคุ้มครองชีวิต เปรียบเทียบภาระครอบครัว หนี้ การศึกษาบุตร ความคุ้มครอง และสินทรัพย์ที่พร้อมใช้ เพื่อเริ่มทบทวนแผนการเงิน",
      "ogTitle": "ตรวจสุขภาพการเงิน เริ่มจากช่องว่างความคุ้มครอง | CCPun",
      "ogDescription": "ตรวจสุขภาพการเงินผ่านโมดูลประเมินทุนประกันชีวิต ซึ่งครอบคลุมเฉพาะความคุ้มครองชีวิต เปรียบเทียบภาระครอบครัว หนี้ การศึกษาบุตร ความคุ้มครอง และสินทรัพย์ที่พร้อมใช้ เพื่อเริ่มทบทวนแผนการเงิน",
      "ogImageUrl": "https://ccpun.com/og-image-20260610.webp?v=68ae8d8"
    }
  },
  {
    "pathname": "/play/money-story/",
    "label": "Money Story",
    "documentId": "pageSeo-money-story",
    "defaults": {
      "seoTitle": "Money Story | เกมจำลองชีวิตการเงิน 12 เดือน | CCPun",
      "seoDescription": "เกมจำลองชีวิตการเงิน 12 เดือน เลือกหรือสุ่มชีวิตสมมติ แล้วลองตัดสินใจเรื่องเงินสด การลงทุน ความคุ้มครอง และการกู้ เมื่อชีวิตมีเรื่องไม่คาดคิดเข้ามา",
      "ogTitle": "Money Story | CCPun",
      "ogDescription": "เกมจำลองชีวิตการเงิน 12 เดือน เลือกหรือสุ่มชีวิตสมมติ แล้วลองตัดสินใจเรื่องเงินสด การลงทุน ความคุ้มครอง และการกู้ เมื่อชีวิตมีเรื่องไม่คาดคิดเข้ามา",
      "ogImageUrl": null
    }
  },
  {
    "pathname": "/privacy/",
    "label": "นโยบายความเป็นส่วนตัว",
    "documentId": "pageSeo-privacy",
    "defaults": {
      "seoTitle": "นโยบายความเป็นส่วนตัว | CCPun ที่ปรึกษาทางการเงิน",
      "seoDescription": "CCPun ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ อ่านนโยบายความเป็นส่วนตัวของเราเพื่อทำความเข้าใจว่าเราเก็บและใช้ข้อมูลอย่างไร",
      "ogTitle": "นโยบายความเป็นส่วนตัว | CCPun ที่ปรึกษาทางการเงิน",
      "ogDescription": "CCPun ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ อ่านนโยบายความเป็นส่วนตัวของเราเพื่อทำความเข้าใจว่าเราเก็บและใช้ข้อมูลอย่างไร",
      "ogImageUrl": null
    }
  },
  {
    "pathname": "/cookie-policy/",
    "label": "นโยบายคุกกี้",
    "documentId": "pageSeo-cookie-policy",
    "defaults": {
      "seoTitle": "นโยบายคุกกี้ | CCPun ที่ปรึกษาทางการเงิน",
      "seoDescription": "CCPun ใช้ Google Analytics และ Meta Pixel ตามตัวเลือกความยินยอม อ่านรายละเอียดผู้ให้บริการ วัตถุประสงค์ ขอบเขต และวิธีถอนความยินยอม",
      "ogTitle": "นโยบายคุกกี้ | CCPun ที่ปรึกษาทางการเงิน",
      "ogDescription": "CCPun ใช้ Google Analytics และ Meta Pixel ตามตัวเลือกความยินยอม อ่านรายละเอียดผู้ให้บริการ วัตถุประสงค์ ขอบเขต และวิธีถอนความยินยอม",
      "ogImageUrl": null
    }
  },
  {
    "pathname": "/about/",
    "label": "รู้จักปั้น",
    "documentId": "pageSeo-about",
    "previewScope": "about",
    "defaults": {
      "seoTitle": "รู้จักที่ปรึกษาทางการเงิน CCPun | ชนาธิป ชิตประเสริฐ (ปั้น)",
      "seoDescription": "ชนาธิป ชิตประเสริฐ (ปั้น) เป็นที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน ช่วยลูกค้าดูเป้าหมาย ระยะเวลา ความเสี่ยง และสถานการณ์ปัจจุบัน ก่อนพิจารณาทางเลือกด้านการลงทุนหรือประกันตามขอบเขตบริการ",
      "ogTitle": "รู้จักที่ปรึกษาทางการเงิน CCPun | ชนาธิป ชิตประเสริฐ (ปั้น)",
      "ogDescription": "ชนาธิป ชิตประเสริฐ (ปั้น) เป็นที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน ช่วยลูกค้าดูเป้าหมาย ระยะเวลา ความเสี่ยง และสถานการณ์ปัจจุบัน ก่อนพิจารณาทางเลือกด้านการลงทุนหรือประกันตามขอบเขตบริการ",
      "ogImageUrl": null
    }
  },
  {
    "pathname": "/tools/",
    "label": "รวมเครื่องมือ",
    "documentId": "pageSeo-tools",
    "previewScope": "toolsHub",
    "defaults": {
      "seoTitle": "เครื่องมือวางแผนการเงิน ประกัน และการลงทุน | CCPun",
      "seoDescription": "รวมเครื่องมือของ CCPun ไว้ที่เดียว ทั้งวางแผนเงินก้อนโรคร้ายแรง ตรวจทุนประกันชีวิต เกมจำลองชีวิตการเงิน 12 เดือน ลองใช้เองก่อน แล้วค่อยคุยกับปั้นทาง LINE",
      "ogTitle": "เครื่องมือวางแผนการเงิน ประกัน และการลงทุน | CCPun",
      "ogDescription": "รวมเครื่องมือของ CCPun ไว้ที่เดียว ทั้งวางแผนเงินก้อนโรคร้ายแรง ตรวจทุนประกันชีวิต เกมจำลองชีวิตการเงิน 12 เดือน ลองใช้เองก่อน แล้วค่อยคุยกับปั้นทาง LINE",
      "ogImageUrl": null
    }
  },
  {
    "pathname": "/tools/investment-allocation/",
    "label": "กองทุนหลัก · เตรียมข้อมูล SEO (ยังไม่เปิดใช้)",
    "documentId": "pageSeo-investment-allocation",
    "previewScope": "investment",
    "metadataOnly": true,
    "defaults": {
      "seoTitle": "เครื่องมือวางแผนกองทุน | เลือกกองเอง ดูข้อมูลจาก ก.ล.ต. | CCPun",
      "seoDescription": "เลือกกองทุนด้วยตัวเอง แล้วดูว่าเงินถูกนำไปลงทุนในอะไร ระดับความเสี่ยงเท่าไร และขายคืนแล้วรับเงินตามเงื่อนไขแบบไหน โดยไม่มีการจัดอันดับหรือเลือกกองแทนคุณ",
      "ogTitle": "เครื่องมือวางแผนกองทุน | เลือกกองเอง ดูข้อมูลจาก ก.ล.ต. | CCPun",
      "ogDescription": "เลือกกองทุนด้วยตัวเอง แล้วดูว่าเงินถูกนำไปลงทุนในอะไร ระดับความเสี่ยงเท่าไร และขายคืนแล้วรับเงินตามเงื่อนไขแบบไหน โดยไม่มีการจัดอันดับหรือเลือกกองแทนคุณ",
      "ogImageUrl": null
    }
  },
  {
    "pathname": "/tools/aia-fund-allocation/",
    "label": "กองทุน บลจ.เอไอเอ · เตรียมข้อมูล SEO (ยังไม่เปิดใช้)",
    "documentId": "pageSeo-aia-fund-allocation",
    "previewScope": "aiaFund",
    "metadataOnly": true,
    "defaults": {
      "seoTitle": "เครื่องมือกองทุน บลจ. เอไอเอ | เลือกกองเอง ดูข้อมูลจาก ก.ล.ต. | CCPun",
      "seoDescription": "เลือกกองทุนรวมของ บลจ. เอไอเอ ด้วยตัวเอง แล้วดูว่าเงินถูกนำไปลงทุนในอะไร ระดับความเสี่ยงเท่าไร และขายคืนแล้วรับเงินตามเงื่อนไขแบบไหน โดยไม่มีการจัดอันดับหรือเลือกกองแทนคุณ",
      "ogTitle": "เครื่องมือกองทุน บลจ. เอไอเอ | เลือกกองเอง ดูข้อมูลจาก ก.ล.ต. | CCPun",
      "ogDescription": "เลือกกองทุนรวมของ บลจ. เอไอเอ ด้วยตัวเอง แล้วดูว่าเงินถูกนำไปลงทุนในอะไร ระดับความเสี่ยงเท่าไร และขายคืนแล้วรับเงินตามเงื่อนไขแบบไหน โดยไม่มีการจัดอันดับหรือเลือกกองแทนคุณ",
      "ogImageUrl": null
    }
  },
  {
    "pathname": "/tools/tax-deduction/",
    "label": "เครื่องมือกำลังพัฒนา · เตรียมข้อมูล SEO (ยังไม่เปิดใช้)",
    "documentId": "pageSeo-coming-soon-tax-deduction",
    "previewScope": "comingSoon",
    "metadataOnly": true,
    "defaults": {
      "seoTitle": "คำนวณลดหย่อนภาษี (กำลังสร้าง) | CCPun",
      "seoDescription": "รวมรายการลดหย่อนที่ใช้ได้ แล้วดูว่าภาษีที่ต้องจ่ายลดลงเท่าไร",
      "ogTitle": "คำนวณลดหย่อนภาษี (กำลังสร้าง) | CCPun",
      "ogDescription": "รวมรายการลดหย่อนที่ใช้ได้ แล้วดูว่าภาษีที่ต้องจ่ายลดลงเท่าไร",
      "ogImageUrl": null
    }
  },
  {
    "pathname": "__not_found__",
    "label": "ไม่พบหน้า (404)",
    "documentId": "pageSeo-not-found",
    "previewScope": "notFound",
    "metadataOnly": true,
    "defaults": {
      "seoTitle": "ไม่พบหน้า | CCPun",
      "seoDescription": "ไม่พบหน้าที่คุณกำลังหา กลับหน้าแรกหรือเลือกเครื่องมือวางแผนการเงินของ CCPun",
      "ogTitle": "ไม่พบหน้า | CCPun",
      "ogDescription": "ไม่พบหน้าที่คุณกำลังหา กลับหน้าแรกหรือเลือกเครื่องมือวางแผนการเงินของ CCPun",
      "ogImageUrl": null
    }
  },
  {
    "pathname": "/blog/personal-finance/",
    "label": "หมวดเสริม · การเงินส่วนบุคคล (เมื่อไม่มีหมวดหลัก)",
    "documentId": "pageSeo-topic-personal-finance",
    "previewScope": "category-personal-finance",
    "metadataOnly": true,
    "defaults": {
      "seoTitle": "การเงินส่วนบุคคล | วางรากฐานการเงินให้มั่นคง | CCPun",
      "seoDescription": "รวมบทความการเงินส่วนบุคคล ตั้งแต่เงินสำรอง กระแสเงินสด การจัดการความเสี่ยง ไปจนถึงการวางรากฐานก่อนเริ่มลงทุน",
      "ogTitle": "การเงินส่วนบุคคล | วางรากฐานการเงินให้มั่นคง | CCPun",
      "ogDescription": "รวมบทความการเงินส่วนบุคคล ตั้งแต่เงินสำรอง กระแสเงินสด การจัดการความเสี่ยง ไปจนถึงการวางรากฐานก่อนเริ่มลงทุน",
      "ogImageUrl": null
    }
  },
  {
    "pathname": "/blog/life-insurance/",
    "label": "หมวดเสริม · ประกันชีวิต (เมื่อไม่มีหมวดหลัก)",
    "documentId": "pageSeo-topic-life-insurance",
    "previewScope": "category-life-insurance",
    "metadataOnly": true,
    "defaults": {
      "seoTitle": "ประกันชีวิต | วางแผนความคุ้มครองและคนข้างหลัง | CCPun",
      "seoDescription": "รวมบทความประกันชีวิต การวางทุนความคุ้มครอง การส่งต่อ และแนวคิดเลือกแบบประกันให้สัมพันธ์กับแผนการเงินระยะยาว",
      "ogTitle": "ประกันชีวิต | วางแผนความคุ้มครองและคนข้างหลัง | CCPun",
      "ogDescription": "รวมบทความประกันชีวิต การวางทุนความคุ้มครอง การส่งต่อ และแนวคิดเลือกแบบประกันให้สัมพันธ์กับแผนการเงินระยะยาว",
      "ogImageUrl": null
    }
  },
  {
    "pathname": "/blog/health-insurance/",
    "label": "หมวดเสริม · ประกันสุขภาพ (เมื่อไม่มีหมวดหลัก)",
    "documentId": "pageSeo-topic-health-insurance",
    "previewScope": "category-health-insurance",
    "metadataOnly": true,
    "defaults": {
      "seoTitle": "ประกันสุขภาพ | วางแผนค่ารักษาและเลือกความคุ้มครอง | CCPun",
      "seoDescription": "รวมบทความประกันสุขภาพ ค่ารักษาพยาบาล วงเงิน ความคุ้มครอง ค่าใช้จ่ายร่วม และแนวคิดเลือกแผนให้เหมาะกับสิทธิที่มีอยู่",
      "ogTitle": "ประกันสุขภาพ | วางแผนค่ารักษาและเลือกความคุ้มครอง | CCPun",
      "ogDescription": "รวมบทความประกันสุขภาพ ค่ารักษาพยาบาล วงเงิน ความคุ้มครอง ค่าใช้จ่ายร่วม และแนวคิดเลือกแผนให้เหมาะกับสิทธิที่มีอยู่",
      "ogImageUrl": null
    }
  },
  {
    "pathname": "/blog/critical-illness-insurance/",
    "label": "หมวดเสริม · ประกันโรคร้ายแรง (เมื่อไม่มีหมวดหลัก)",
    "documentId": "pageSeo-topic-critical-illness-insurance",
    "previewScope": "category-critical-illness-insurance",
    "metadataOnly": true,
    "defaults": {
      "seoTitle": "ประกันโรคร้ายแรง | วางแผนเงินก้อนเมื่อเจ็บป่วย | CCPun",
      "seoDescription": "รวมบทความประกันโรคร้ายแรง ความต่างจากประกันสุขภาพ และแนวทางประเมินเงินก้อนเพื่อรองรับรายได้และค่าใช้จ่ายนอกโรงพยาบาล",
      "ogTitle": "ประกันโรคร้ายแรง | วางแผนเงินก้อนเมื่อเจ็บป่วย | CCPun",
      "ogDescription": "รวมบทความประกันโรคร้ายแรง ความต่างจากประกันสุขภาพ และแนวทางประเมินเงินก้อนเพื่อรองรับรายได้และค่าใช้จ่ายนอกโรงพยาบาล",
      "ogImageUrl": null
    }
  },
  {
    "pathname": "/blog/motor-insurance/",
    "label": "หมวดเสริม · ประกันรถยนต์ (เมื่อไม่มีหมวดหลัก)",
    "documentId": "pageSeo-topic-motor-insurance",
    "previewScope": "category-motor-insurance",
    "metadataOnly": true,
    "defaults": {
      "seoTitle": "ประกันรถยนต์ | เลือกความคุ้มครองและวางแผนความเสี่ยง | CCPun",
      "seoDescription": "รวมบทความประกันรถยนต์ ตั้งแต่ประเภทความคุ้มครอง พ.ร.บ. การเลือกชั้นประกัน การเคลม และการเทียบความเสี่ยงที่พร้อมรับเอง",
      "ogTitle": "ประกันรถยนต์ | เลือกความคุ้มครองและวางแผนความเสี่ยง | CCPun",
      "ogDescription": "รวมบทความประกันรถยนต์ ตั้งแต่ประเภทความคุ้มครอง พ.ร.บ. การเลือกชั้นประกัน การเคลม และการเทียบความเสี่ยงที่พร้อมรับเอง",
      "ogImageUrl": null
    }
  },
  {
    "pathname": "/blog/investment/",
    "label": "หมวดเสริม · การลงทุน (เมื่อไม่มีหมวดหลัก)",
    "documentId": "pageSeo-topic-investment",
    "previewScope": "category-investment",
    "metadataOnly": true,
    "defaults": {
      "seoTitle": "การลงทุน | วางแผนลงทุนตามเป้าหมาย | CCPun",
      "seoDescription": "พื้นที่รวมบทความการลงทุน การจัดพอร์ต ความเสี่ยง และการลงทุนตามเป้าหมายทางการเงินจาก CCPun",
      "ogTitle": "การลงทุน | วางแผนลงทุนตามเป้าหมาย | CCPun",
      "ogDescription": "พื้นที่รวมบทความการลงทุน การจัดพอร์ต ความเสี่ยง และการลงทุนตามเป้าหมายทางการเงินจาก CCPun",
      "ogImageUrl": null
    }
  }
];

export function getPageSeoPage(pathname: string): PageSeoPage | undefined {
  return PAGE_SEO_PAGES.find(page => page.pathname === pathname);
}
export function pageSeoDocumentId(pathname: string): string | null {
  return getPageSeoPage(pathname)?.documentId ?? null;
}
export function isPageSeoImageUrlAllowed(value: string, dataset: "production" | "uat" = "production"): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash) return false;
    const imagePrefix = dataset === "uat" ? "/images/ccb9lnw5/uat/" : "/images/kyfxgjnq/production/";
    const sanity = url.hostname === "cdn.sanity.io" && url.pathname.startsWith(imagePrefix);
    const ownAsset = (url.hostname === "ccpun.com" || (dataset === "uat" && url.hostname === "test.ccpun.com")) && /^\/(?:assets\/|og-image[^/]*$)/.test(url.pathname);
    return (sanity || ownAsset) && /\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname) && !/%(?:2f|2e|5c)/i.test(url.pathname) && [...url.searchParams.keys()].every(key => ["v", "w", "h", "fit", "auto", "q", "dpr", "rect", "crop"].includes(key));
  } catch { return false; }
}
export function validatePageSeoFields(input: unknown, dataset: "production" | "uat" = "production"): PageSeoFields {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("page_seo_invalid_fields");
  const record = input as Record<string, unknown>, output: PageSeoFields = {};
  for (const [key, raw] of Object.entries(record)) {
    if (!(PAGE_SEO_FIELDS as readonly string[]).includes(key)) throw new TypeError("page_seo_unknown_field");
    if (raw !== null && typeof raw !== "string") throw new TypeError("page_seo_invalid_field");
    const value = typeof raw === "string" ? raw.trim() || null : null;
    const limit = key === "ogImageUrl" ? 2048 : key.endsWith("Description") ? 320 : 120;
    if (value && (value.length > limit || /[<>\u0000-\u001f\u007f]/.test(value))) throw new TypeError("page_seo_invalid_field");
    if (key === "ogImageUrl" && value && !isPageSeoImageUrlAllowed(value, dataset)) throw new TypeError("page_seo_invalid_image");
    output[key as keyof PageSeoFields] = value;
  }
  return output;
}

// Preview identities are private editor routes, never public route or canonical owners.
const LEGACY_SEO_PREVIEW_SCOPES: Record<string,string> = { "/": "home", "/blog/": "blog", "/ci-planning/": "ci", "/tools/financial-health-check/": "fhc", "/play/money-story/": "moneyStory", "/privacy/": "privacy", "/cookie-policy/": "cookies" };
export function pageSeoPreviewScope(page: PageSeoPage): string | undefined { return page.previewScope ?? LEGACY_SEO_PREVIEW_SCOPES[page.pathname]; }
export function getPageSeoPreviewPage(scope: string): PageSeoPage | undefined { return PAGE_SEO_PAGES.find(page => pageSeoPreviewScope(page) === scope); }
