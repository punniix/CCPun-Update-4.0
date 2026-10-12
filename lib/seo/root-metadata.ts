import type { Metadata } from "next";

// Fresh metadata objects: shared public values, explicit root compatibility noindex policy.
export function buildSiteRootMetadata({ admin, review }: { admin: boolean; review: boolean }): Metadata {
  return {
  metadataBase: new URL(admin ? "https://admin.ccpun.com" : "https://ccpun.com"),
  title: admin ? "CCPun Control Plane" : "CCPun | ที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน",
  description: admin ? "พื้นที่ควบคุมภายในของ CCPun" : "ไม่แน่ใจว่าควรลงทุนหรือทำประกันแบบไหน? CCPun ที่ปรึกษาทางการเงิน ช่วยดูเป้าหมาย ความเสี่ยง และสิ่งที่คุณมี ก่อนค่อยเลือกทางที่เหมาะกับชีวิตคุณ",
  keywords: admin ? undefined : ["ที่ปรึกษาการเงิน", "กองทุนรวม", "ประกันชีวิต", "วางแผนภาษี", "RMF", "SSF", "ThaiESG", "AIA", "Finnomena", "PhillipCapital"],
  authors: admin ? undefined : [{ name: "ชนาธิป ชิตประเสริฐ", url: "https://ccpun.com" }],
  openGraph: admin ? null : {
    title: "ลงทุนหรือทำประกันอะไรดี? เริ่มจากปัญหาที่คุณมีก่อน | CCPun",
    description: "เพราะคำว่า “ดีที่สุด” ของคนอื่น อาจไม่ตอบโจทย์คุณ ลองเริ่มจากเป้าหมาย ความเสี่ยง และสิ่งที่คุณมี แล้วค่อยเลือกลงทุนหรือประกันให้เหมาะกับตัวเอง",
    url: "https://ccpun.com",
    siteName: "CCPun Financial Advisor",
    images: [{ url: "https://ccpun.com/og-image-20260610.webp?v=68ae8d8", width: 1200, height: 630, alt: "CCPun ที่ปรึกษาการเงิน" }],
    locale: "th_TH",
    type: "website",
  },
  twitter: admin ? null : {
    card: "summary_large_image",
    title: "ลงทุนหรือทำประกันอะไรดี? เริ่มจากปัญหาที่คุณมีก่อน | CCPun",
    description: "เพราะคำว่า “ดีที่สุด” ของคนอื่น อาจไม่ตอบโจทย์คุณ ลองเริ่มจากเป้าหมาย ความเสี่ยง และสิ่งที่คุณมี แล้วค่อยเลือกลงทุนหรือประกันให้เหมาะกับตัวเอง",
    images: ["https://ccpun.com/og-image-20260610.webp?v=68ae8d8"],
  },
  alternates: admin ? { canonical: null } : {
    canonical: "https://ccpun.com/",
    languages: { "th-TH": "https://ccpun.com/", "x-default": "https://ccpun.com/" },
  },
  robots: admin || review ? { index: false, follow: false, nocache: true } : undefined,
  icons: {
    icon: { url: "/favicon.png", type: "image/png" },
    apple: "/favicon.png",
  },
};
}
