// CCPun — Structured Data (Schema.org JSON-LD)

export const personSchema = {
  "@type": "Person",
  "@id": "https://ccpun.com/#person",
  "name": "ปั้น",
  "jobTitle": "ที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน",
  "description": "ปั้นเป็นที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน ช่วยลูกค้าดูเป้าหมาย ระยะเวลา ความเสี่ยง และสถานการณ์ปัจจุบัน ก่อนพิจารณาทางเลือกด้านการลงทุนหรือประกันตามขอบเขตบริการ",
  "telephone": "+66633438513",
  "url": "https://ccpun.com",
  "knowsAbout": ["การวางแผนการลงทุน", "กองทุนรวม", "RMF", "Thai ESG", "ประกันชีวิต", "ประกันสุขภาพ", "ประกันโรคร้ายแรง", "ประกันวินาศภัย"],
  "hasCredential": [
    {
      "@type": "EducationalOccupationalCredential",
      "name": "ผู้วางแผนการลงทุน (เลขทะเบียน 106654)",
      "credentialCategory": "ใบอนุญาต",
      "identifier": "106654",
      "recognizedBy": { "@type": "Organization", "name": "สำนักงานคณะกรรมการกำกับหลักทรัพย์และตลาดหลักทรัพย์ (ก.ล.ต.)" }
    },
    {
      "@type": "EducationalOccupationalCredential",
      "name": "ใบอนุญาตตัวแทนประกันชีวิต",
      "credentialCategory": "ใบอนุญาต",
      "identifier": "6801064783",
      "recognizedBy": { "@type": "Organization", "name": "สำนักงานคณะกรรมการกำกับและส่งเสริมการประกอบธุรกิจประกันภัย (คปภ.)" }
    },
    {
      "@type": "EducationalOccupationalCredential",
      "name": "การจัดการประกันวินาศภัยโดยตรง (เลขที่ 6904009841)",
      "credentialCategory": "ใบอนุญาต",
      "identifier": "6904009841",
      "recognizedBy": { "@type": "Organization", "name": "สำนักงานคณะกรรมการกำกับและส่งเสริมการประกอบธุรกิจประกันภัย (คปภ.)" }
    }
  ],
  "worksFor": { "@id": "https://ccpun.com/#organization" },
  "sameAs": [
    "https://www.facebook.com/profile.php?id=61585953063887",
  ],
};

export const websiteSchema = {
  "@type": "WebSite",
  "@id": "https://ccpun.com/#website",
  "name": "CCPun Financial Advisor",
  "url": "https://ccpun.com",
  "inLanguage": "th",
  "publisher": { "@id": "https://ccpun.com/#organization" },
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://ccpun.com/blog/?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

export const financialServiceSchema = {
  "@type": ["FinancialService", "InsuranceAgency", "LocalBusiness"],
  "@id": "https://ccpun.com/#organization",
  "name": "CCPun Financial Advisor",
  "alternateName": "ปั้น ที่ปรึกษาการเงิน",
  "description": "CCPun ให้คำปรึกษาด้านการเงินและวางแผนการลงทุน รวมถึงประกันชีวิต ประกันสุขภาพ และประกันวินาศภัย ตามขอบเขตใบอนุญาต",
  "url": "https://ccpun.com",
  "logo": {
    "@type": "ImageObject",
    "url": "https://ccpun.com/og-image-20260610.webp?v=68ae8d8",
    "width": 1200,
    "height": 630,
  },
  "image": "https://ccpun.com/og-image-20260610.webp?v=68ae8d8",
  "areaServed": [
    { "@type": "City", "name": "Bangkok" },
    { "@type": "Country", "name": "Thailand" },
  ],
  "availableLanguage": "Thai",
  "serviceType": ["ที่ปรึกษาทางการเงิน", "การวางแผนการลงทุน", "กองทุนรวม", "ประกันชีวิต", "ประกันสุขภาพ", "ประกันโรคร้ายแรง", "ประกันวินาศภัย"],
  "priceRange": "$$",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Bangkok",
    "addressRegion": "Bangkok",
    "addressCountry": "TH",
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "availableLanguage": "Thai",
  },
  "founder": { "@id": "https://ccpun.com/#person" },
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "บริการที่ปรึกษาการเงิน CCPun",
    "itemListElement": [
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Financial Checkup",
          "description": "รู้ฐานะการเงินตัวเองภายใน 1 ชั่วโมง พร้อมโรดแมปชัดเจนว่าต้องทำอะไรต่อเพื่อให้ถึงเป้าหมาย",
        },

      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Investment Advisor",
          "description": "ลงทุนอย่างมีแผน ไม่ต้องเดาตามกระแส รู้ว่าควรลงทุนที่ไหน เท่าไหร่ และเพราะอะไร",
        },

      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Risk Management",
          "description": "เหตุไม่คาดฝันเกิดขึ้นได้ทุกเมื่อ วางแผนรับมือก่อน เพื่อให้ชีวิตดำเนินต่อได้โดยไม่สะดุด",
        },

      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Tax Planning",
          "description": "ลดภาษีได้ถูกกฎหมาย เปลี่ยนเงินที่เคยเสียให้กลายเป็นเงินเก็บที่งอกเงยให้คุณ",
        },

      },
    ],
  },
  "sameAs": [
    "https://www.facebook.com/profile.php?id=61585953063887",
  ],
};

export const faqSchema = {
  "@type": "FAQPage",
  "@id": "https://ccpun.com/#faq",
  "url": "https://ccpun.com/#faq",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "CCPun คือใคร?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "ปั้นเป็นที่ปรึกษาการเงินอิสระ มีใบอนุญาตจากทั้ง ก.ล.ต. และ คปภ. ช่วยวางแผนเรื่องประกัน ลงทุน และภาษีให้เข้ากับสถานการณ์จริงของแต่ละคน ไม่ใช่แนะนำแบบเหมาเข่ง"
      }
    },
    {
      "@type": "Question",
      "name": "CCPun ช่วยวางแผนเรื่องอะไรได้บ้าง?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "ตรวจสุขภาพการเงิน วางแผนความคุ้มครองชีวิตและสุขภาพ ดูเรื่องประกันโรคร้ายแรง วางแผนลงทุนและเกษียณ และลดหย่อนภาษีถูกกฎหมาย ทุกอย่างดูจากรายได้ เป้าหมาย และภาระจริงของคุณ ไม่ใช่สูตรสำเร็จ"
      }
    },
    // HIDDEN: awaiting COO approval of Wave 1 CTA copy — see Google Doc https://docs.google.com/document/d/1oGUB_YThyp19-LMq1MzAOqAooRXew6OipgfCMGAtnUo/edit — do not re-add until the FAQSection.tsx item is un-hidden and all text is approved
    // {
    //   "@type": "Question",
    //   "name": "เริ่มต้นกับ CCPun ควรทำอย่างไร?",
    //   "acceptedAnswer": {
    //     "@type": "Answer",
    //     "text": "ลองเริ่มจาก Financial Health Check หรือ CI Planning บนเว็บนี้ก่อนเลย จะได้เห็นว่าตัวเองยืนอยู่ตรงไหน แล้วค่อยทักมาคุยต่อที่เพจ Facebook ได้เลย"
    //   }
    // },
    {
      "@type": "Question",
      "name": "ประกันชีวิตหรือประกันสุขภาพเป็นเงินฝากไหม?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "ไม่ใช่เงินฝาก ประกันคือสัญญาที่บริษัทจ่ายเงินให้เมื่อเกิดเหตุตามเงื่อนไข ไม่ใช่เงินออมที่ถอนได้ทุกเมื่อ ควรอ่านเงื่อนไขและข้อยกเว้นในกรมธรรม์ให้เข้าใจก่อนตัดสินใจ"
      }
    }
  ]
};

export const ccpunSchemaGraph = {
  "@context": "https://schema.org",
  "@graph": [
    financialServiceSchema,
    personSchema,
    websiteSchema,
  ],
};
