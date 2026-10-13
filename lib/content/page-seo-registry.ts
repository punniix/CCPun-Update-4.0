export const PAGE_SEO_FIELDS = ["seoTitle", "seoDescription", "ogTitle", "ogDescription", "ogImageUrl"] as const;
export type PageSeoFields = Partial<Record<typeof PAGE_SEO_FIELDS[number], string | null>>;
export type PageSeoPage = { pathname: string; label: string; documentId: string; defaults: Required<PageSeoFields> };

export const PAGE_SEO_PAGES: readonly PageSeoPage[] = [
  {
    "pathname": "/",
    "label": "หน้าหลัก",
    "documentId": "pageSeo.home",
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
    "documentId": "pageSeo.blog",
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
    "documentId": "pageSeo.ci-planning",
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
    "documentId": "pageSeo.financial-health-check",
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
    "documentId": "pageSeo.money-story",
    "defaults": {
      "seoTitle": "Money Story | เกมจำลองชีวิตการเงิน 12 เดือน | CCPun",
      "seoDescription": "เกมจำลองชีวิตการเงิน 12 เดือน เลือกหรือสุ่มชีวิตสมมติ แล้วลองตัดสินใจเรื่องเงินสด การลงทุน ความคุ้มครอง และการกู้ เมื่อชีวิตมีเรื่องไม่คาดคิดเข้ามา",
      "ogTitle": "Money Story | CCPun",
      "ogDescription": "เกมจำลองชีวิตการเงิน 12 เดือน เลือกหรือสุ่มชีวิตสมมติ แล้วลองตัดสินใจเรื่องเงินสด การลงทุน ความคุ้มครอง และการกู้ เมื่อชีวิตมีเรื่องไม่คาดคิดเข้ามา",
      "ogImageUrl": "https://ccpun.com/og-image-20260610.webp?v=68ae8d8"
    }
  },
  {
    "pathname": "/tools/investment-allocation/",
    "label": "วางแผนกองทุน",
    "documentId": "pageSeo.investment-allocation",
    "defaults": {
      "seoTitle": "เครื่องมือวางแผนกองทุน | เลือกกองเอง ดูข้อมูลจาก ก.ล.ต. | CCPun",
      "seoDescription": "เลือกกองทุนด้วยตัวเอง แล้วดูว่าเงินถูกนำไปลงทุนในอะไร ระดับความเสี่ยงเท่าไร และขายคืนแล้วรับเงินตามเงื่อนไขแบบไหน โดยไม่มีการจัดอันดับหรือเลือกกองแทนคุณ",
      "ogTitle": "CCPun เครื่องมือวางแผนกองทุน",
      "ogDescription": "เลือกกองทุนด้วยตัวเอง แล้วดูว่าเงินถูกนำไปลงทุนในอะไร ระดับความเสี่ยงเท่าไร และขายคืนแล้วรับเงินตามเงื่อนไขแบบไหน โดยไม่มีการจัดอันดับหรือเลือกกองแทนคุณ",
      "ogImageUrl": "https://ccpun.com/og-image-20260610.webp?v=68ae8d8"
    }
  },
  {
    "pathname": "/privacy/",
    "label": "นโยบายความเป็นส่วนตัว",
    "documentId": "pageSeo.privacy",
    "defaults": {
      "seoTitle": "นโยบายความเป็นส่วนตัว | CCPun ที่ปรึกษาทางการเงิน",
      "seoDescription": "CCPun ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ อ่านนโยบายความเป็นส่วนตัวของเราเพื่อทำความเข้าใจว่าเราเก็บและใช้ข้อมูลอย่างไร",
      "ogTitle": "นโยบายความเป็นส่วนตัว | CCPun ที่ปรึกษาทางการเงิน",
      "ogDescription": "CCPun ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ อ่านนโยบายความเป็นส่วนตัวของเราเพื่อทำความเข้าใจว่าเราเก็บและใช้ข้อมูลอย่างไร",
      "ogImageUrl": "https://ccpun.com/og-image-20260610.webp?v=68ae8d8"
    }
  },
  {
    "pathname": "/cookie-policy/",
    "label": "นโยบายคุกกี้",
    "documentId": "pageSeo.cookie-policy",
    "defaults": {
      "seoTitle": "นโยบายคุกกี้ | CCPun ที่ปรึกษาทางการเงิน",
      "seoDescription": "CCPun ใช้ Google Analytics และ Meta Pixel ตามตัวเลือกความยินยอม อ่านรายละเอียดผู้ให้บริการ วัตถุประสงค์ ขอบเขต และวิธีถอนความยินยอม",
      "ogTitle": "นโยบายคุกกี้ | CCPun ที่ปรึกษาทางการเงิน",
      "ogDescription": "CCPun ใช้ Google Analytics และ Meta Pixel ตามตัวเลือกความยินยอม อ่านรายละเอียดผู้ให้บริการ วัตถุประสงค์ ขอบเขต และวิธีถอนความยินยอม",
      "ogImageUrl": "https://ccpun.com/og-image-20260610.webp?v=68ae8d8"
    }
  }
];

export function getPageSeoPage(pathname: string): PageSeoPage | undefined {
  return PAGE_SEO_PAGES.find(page => page.pathname === pathname);
}
export function pageSeoDocumentId(pathname: string): string | null {
  return getPageSeoPage(pathname)?.documentId ?? null;
}
export function isPageSeoImageUrlAllowed(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash) return false;
    const sanity = url.hostname === "cdn.sanity.io" && url.pathname.startsWith("/images/ccb9lnw5/uat/");
    const ownAsset = ["ccpun.com", "test.ccpun.com"].includes(url.hostname) && /^\/(?:assets\/|og-image[^/]*$)/.test(url.pathname);
    return (sanity || ownAsset) && /\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname) && !/%(?:2f|2e|5c)/i.test(url.pathname) && [...url.searchParams.keys()].every(key => ["v", "w", "h", "fit", "auto", "q", "dpr", "rect", "crop"].includes(key));
  } catch { return false; }
}
export function validatePageSeoFields(input: unknown): PageSeoFields {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("page_seo_invalid_fields");
  const record = input as Record<string, unknown>, output: PageSeoFields = {};
  for (const [key, raw] of Object.entries(record)) {
    if (!(PAGE_SEO_FIELDS as readonly string[]).includes(key)) throw new TypeError("page_seo_unknown_field");
    if (raw !== null && typeof raw !== "string") throw new TypeError("page_seo_invalid_field");
    const value = typeof raw === "string" ? raw.trim() || null : null;
    const limit = key === "ogImageUrl" ? 2048 : key.endsWith("Description") ? 320 : 120;
    if (value && (value.length > limit || /[<>\u0000-\u001f\u007f]/.test(value))) throw new TypeError("page_seo_invalid_field");
    if (key === "ogImageUrl" && value && !isPageSeoImageUrlAllowed(value)) throw new TypeError("page_seo_invalid_image");
    output[key as keyof PageSeoFields] = value;
  }
  return output;
}
