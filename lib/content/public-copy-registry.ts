import { SITE_COPY_DEFAULTS } from "./site-copy-defaults";
export { SITE_COPY_DEFAULTS } from "./site-copy-defaults";
import { MONEY_STORY_COPY_DEFAULTS } from "./money-story-copy-defaults";
import { PRIVACY_COPY_DEFAULTS, COOKIES_COPY_DEFAULTS } from "./legal-copy-defaults";
import { CI_COPY_DEFAULTS, FHC_COPY_DEFAULTS } from "./tool-copy-defaults";
import { BLOG_COPY_DEFAULTS } from "./blog-copy-defaults";
import { createCopyText, type CopyText } from "./public-copy-text";
import { copyStyleFromEntry, encodeCopyValue } from "./public-copy-style";
// Persisted keys are content contracts. Defaults preserve the approved pre-CMS copy.
export const HOME_COPY_DEFAULTS = {
  "home.advisor.qualificationPrefix": " · เลขคุณวุฒิ ",
  "home.advisor.defaultRole": "ที่ปรึกษาทางการเงินและผู้วางแผนการลงทุน",
  "home.painsText": "ไม่แน่ใจว่ามีประกันเพียงพอหรือยัง",
  "home.painsText2": "มีความคุ้มครองอยู่ แต่ไม่แน่ใจว่าที่มีอยู่นั้น เพียงพอหรือไม่ ต้องเตรียมหรือปรับเพิ่มลดอย่างไร",
  "home.painsText3": "มีเงินเก็บ แต่ไม่รู้จะเริ่มลงทุนอย่างไร",
  "home.painsText4": "อยากให้เงินทำงาน แต่ยังไม่รู้ว่าควรเริ่มจากเป้าหมายหรือเครื่องมือไหน",
  "home.painsText5": "มีหลายเป้าหมาย แต่ไม่รู้ควรเริ่มตรงไหนก่อน",
  "home.painsText6": "ทั้งประกัน การลงทุน ภาษี และอนาคตมาพร้อมกัน จึงต้องช่วยกันจัดลำดับ",
  "home.stepsText": "เข้าใจสถานการณ์",
  "home.stepsText2": "ดูชีวิต เป้าหมาย ภาระ และสิ่งที่กำลังกังวล",
  "home.stepsText3": "ดูสิ่งที่มีอยู่แล้ว",
  "home.stepsText4": "ดูประกัน เงินเก็บ การลงทุน หรือแผนที่มีอยู่",
  "home.stepsText5": "หา Gap",
  "home.stepsText6": "ดูว่าส่วนไหนเพียงพอ ส่วนไหนยังขาด และอะไรอาจไม่จำเป็น",
  "home.stepsText7": "เลือกทางที่เหมาะ",
  "home.stepsText8": "ค่อยเลือกว่าจะปรับ เพิ่ม ลด หรือยังไม่ต้องทำอะไร",
  "home.licenseLabelsText": "ตัวแทนประกันชีวิต 6801064783",
  "home.licenseLabelsText2": "ผู้วางแผนการลงทุน 106654",
  "home.licenseLabelsText3": "นายหน้าประกันวินาศภัย 6904009841",
  "home.website43Homealt": "CCPun กำลังนั่งทำงานพร้อมคอมพิวเตอร์โน้ตบุ๊ก",
  "home.hero.eyebrow": "คุณเล่าปัญหามา เราสร้างแผนแก้ไขไป",
  "home.hero.titleBefore": "เพราะปัญหาทางการเงินมัน",
  "home.hero.titleEmphasis": "ซับซ้อน",
  "home.hero.titleAfter": " เราจึงต้องวางแผน ออกแบบให้เหมาะกับตัวคุณ",
  "home.hero.description": "เริ่มจากสิ่งที่คุณมี เป้าหมายที่อยากไปให้ถึง และความเสี่ยงที่รับได้ แล้วค่อยจัดลำดับว่าอะไรควรทำก่อน",
  "home.hero.aboutCta": "รู้จัก CCPun",
  "home.contactCta": "ปรึกษากับ CCPun",
  "home.heroProof": "5+ ปี · 3 ใบอนุญาต · 6 พาร์ทเนอร์/แพลตฟอร์ม",
  "home.website43Homeeyebrow": "โจทย์ที่พบบ่อย",
  "home.website43Hometitle": "ถ้าเรื่องเงินยังเป็นเรื่องที่คุณกังวล",
  "home.website43Homedescription": "เริ่มจากปัญหาที่เจอ ดูแผนการเงินในภาพรวม และหาผลิตภัณฑ์ที่เหมาะสม",
  "home.strong": "5+ ปี",
  "home.span": "ประสบการณ์ด้านการเงิน",
  "home.strong2": "3 ใบอนุญาต",
  "home.span2": "การลงทุน · ประกันชีวิต · ประกันวินาศภัย",
  "home.strong3": "6 แพลตฟอร์มการเงิน",
  "home.span3": "ทางเลือกที่หลากหลาย ตอบโจทย์ลูกค้า",
  "home.website43HomeText": "ใบอนุญาต: ",
  "home.partnerLabel": "พาร์ทเนอร์ทั้งหมดที่ร่วมงาน",
  "home.website43Homealt2": "AIA",
  "home.span4": "ตัวแทนประกันชีวิต",
  "home.website43Homealt3": "Fairdee",
  "home.span5": "นายหน้าประกันวินาศภัย",
  "home.website43Homealt4": "Maybank",
  "home.span6": "ผู้วางแผนการลงทุนอิสระ",
  "home.website43Homealt5": "PhillipCapital",
  "home.website43Homealt6": "Webull",
  "home.span7": "แพลตฟอร์มการลงทุน",
  "home.website43Homealt7": "Finnomena",
  "home.eyebrow2": "รู้จักที่ปรึกษาทางการเงิน CCPun",
  "home.h2": "จากคนที่โฟกัสแต่เรื่องการลงทุน สู่ที่ปรึกษาทางการเงินแบบครบลูป",
  "home.website43Homealt8": "CCPun",
  "home.p": "จากคนที่โฟกัสแต่เพียงเรื่องการลงทุน จนเจอเหตุไม่คาดฝัน และสูญเสียในครอบครัวในเวลาต่อมา ผมจึงเริ่มเห็นความสำคัญของประกันชีวิต และกลับมาจัดแผนการเงินใหม่จากระดับรากฐาน",
  "home.p2": "และเลือกเดินต่อในบทบาทตัวแทนประกันชีวิต นายหน้าประกันวินาศภัย และผู้วางแผนการลงทุน เพื่อช่วยเหลือผู้คนให้มีฐานการเงินที่ดีขึ้น",
  "home.p3": "โดยนำประสบการณ์ด้านการเงินและการลงทุนจากการทำงานกว่า 5 ปี มาแนะนำ และช่วยตัดสินใจเลือกผลิตภัณฑ์ทางการเงินที่ตอบโจทย์เฉพาะบุคคล เพื่อสร้างทั้งความมั่นคงและความมั่งคั่งได้ในระยะสั้น กลางและยาว",
  "home.advisorNote": "เป้าหมายไม่ใช่การเลือกเพียงแค่ผลิตภัณฑ์ใดผลิตภัณฑ์หนึ่ง แต่วางองค์รวม และเลือกสิ่งที่ดีที่สุด เหมาะสม ตอบโจทย์กับลูกค้าที่สุด",
  "home.website43Homeeyebrow2": "เสียงจากการพูดคุยจริง",
  "home.website43Hometitle2": "รีวิวจากลูกค้าที่ได้รับคำแนะนำจริง",
  "home.blockquote": "หลังจากได้รีวิวแผนประกันกับคุณปั้น รู้สึกว่าได้รับข้อมูลครบถ้วนมากขึ้น คุณปั้นอธิบายรายละเอียดของกรมธรรม์ที่เรามีอยู่ได้ชัดเจน ทำให้เข้าใจสิทธิ์ที่ตัวเองได้รับจริงๆ อยากให้ทุกคนมีโอกาสได้คุยกับเจ้าหน้าที่ที่มีความรู้แบบนี้ก่อนตัดสินใจซื้อประกัน เพราะถ้าเข้าใจกรมธรรม์ตั้งแต่แรก ก็จะไม่เกิดความเข้าใจผิดในภายหลัง ขอบคุณคุณปั้นที่ตั้งใจอธิบายมากๆ ถึงขนาดเอาไปเล่าให้แฟนฟังต่อได้เลย",
  "home.cite": "คุณ Kittisak",
  "home.blockquote2": "คุณปั้นให้คำแนะนำในการปรับแผนประกันสุขภาพ และโรคร้ายแรง หลังจากรีวิวแผนได้ค่อนข้างโอเค",
  "home.cite2": "คุณ Maylisa",
  "home.website43Homeeyebrow3": "HOW IT WORKS",
  "home.website43Hometitle3": "ถ้าเริ่มวางแผนกับ CCPun จะเกิดอะไรขึ้น?",
  "home.website43Homedescription2": "คุยกันครั้งแรกไม่ต้องเตรียมอะไรซับซ้อน เราเริ่มจากสถานการณ์จริงก่อนค่อยหาทางที่เหมาะ",
  "home.website43Hometitle4": "ไม่รู้จะเริ่มอย่างไร เริ่มจากบทความและเครื่องมือก่อน",
  "home.website43Homedescription3": "เลือกอ่านบทความ หรือทดลองใช้เครื่องมือวางแผนก่อน แล้วค่อยกลับมาคุยเมื่อคุณพร้อม",
  "home.website43Homearialabel": "อ่านบทความการเงินทั้งหมด",
  "home.planNum": "READ",
  "home.h3": "บทความการเงิน",
  "home.p4": "เข้าใจเรื่องการเงินได้ แม้จะเริ่มจาก 0",
  "home.toolCtaAction": "ดูบทความทั้งหมด →",
  "home.website43Homearialabel2": "เริ่ม Financial Health Check: ตรวจสุขภาพการเงิน",
  "home.planNum2": "TRY",
  "home.h32": "Financial Health Check",
  "home.p5": "เช็กทุนประกันชีวิตที่ควรมีก่อนตัดสินใจทำประกันผ่านการตรวจสุขภาพทางการเงิน",
  "home.toolCtaAction2": "เริ่มประเมิน →",
  "home.website43Homearialabel3": "เริ่ม CI Planning: วางแผนเงินก้อนโรคร้ายแรง",
  "home.h33": "วางแผนการเงินเมื่อเจอโรคร้ายแรง",
  "home.p6": "เตรียมเงินก้อนรับมือภาระค่าใช้จ่าย เมื่อเจอโรคร้ายแรง",
  "home.website43Homeeyebrow4": "คำถามที่พบบ่อย",
  "home.website43Hometitle5": "คำถามก่อนเริ่มวางแผนกับ CCPun",
  "home.faq1.question": "CCPun คือใคร?",
  "home.faq1.answer": "CCPun คือผู้ให้คำแนะนำด้านประกันและการลงทุน โดยมีใบอนุญาตตัวแทนประกันชีวิต นายหน้าประกันวินาศภัย และผู้วางแผนการลงทุน โดยให้คำแนะนำที่ตั้งต้นจากปัญหาที่คุณมี และนำแผนไปพัฒนาต่อเป็นคำแนะนำที่เหมาะกับตัวคุณ",
  "home.faq2.question": "CCPun ช่วยให้คำแนะนำทางการเงินด้านใดได้บ้าง",
  "home.faq2.answer": "ช่วยวางแผนการลงทุนและให้คำปรึกษาด้านประกันและการเงิน โดยเช็กจากปัญหา ความคุ้มครอง และเป้าหมายทางการเงินที่ลูกค้าต้องการให้ไปถึง",
  "home.coreGuides.title": "คู่มือหลัก",
  "home.latest.title": "บทความล่าสุด",
  "home.moneyStory.description": "เกมจำลองชีวิตการเงิน 12 เดือน",
  "home.contactBand.title": "ถ้าอยากรู้ว่าตอนนี้พร้อมแค่ไหน ทักมาคุยทาง LINE ได้เลย"
} as const;



export const PUBLIC_COPY_SCOPES = { site: { label: "เมนู ท้ายเว็บ และคุกกี้", pathname: "*", defaults: SITE_COPY_DEFAULTS }, home: { label: "หน้าแรก", pathname: "/", defaults: HOME_COPY_DEFAULTS }, ci: { label: "วางแผนทุนโรคร้ายแรง", pathname: "/ci-planning/", defaults: CI_COPY_DEFAULTS }, fhc: { label: "ตรวจสุขภาพการเงิน", pathname: "/tools/financial-health-check/", defaults: FHC_COPY_DEFAULTS }, blog: { label: "บทความและหน้าอ่านบทความ", pathname: "/blog/", defaults: BLOG_COPY_DEFAULTS }, privacy: { label: "นโยบายความเป็นส่วนตัว", pathname: "/privacy/", defaults: PRIVACY_COPY_DEFAULTS }, cookies: { label: "นโยบายคุกกี้", pathname: "/cookie-policy/", defaults: COOKIES_COPY_DEFAULTS }, moneyStory: { label: "เกม Money Story", pathname: "/play/money-story/", defaults: MONEY_STORY_COPY_DEFAULTS } } as const;
export type PublicCopyScope = keyof typeof PUBLIC_COPY_SCOPES;
export type SiteCopyKey = keyof typeof SITE_COPY_DEFAULTS;
export type PublicCopyKey = SiteCopyKey | keyof typeof HOME_COPY_DEFAULTS | keyof typeof CI_COPY_DEFAULTS | keyof typeof FHC_COPY_DEFAULTS | keyof typeof BLOG_COPY_DEFAULTS | keyof typeof PRIVACY_COPY_DEFAULTS | keyof typeof COOKIES_COPY_DEFAULTS | keyof typeof MONEY_STORY_COPY_DEFAULTS;
export type PublicCopyValues = Partial<Record<PublicCopyKey, string>>;
const ALL_COPY_DEFAULTS = { ...SITE_COPY_DEFAULTS, ...HOME_COPY_DEFAULTS, ...CI_COPY_DEFAULTS, ...FHC_COPY_DEFAULTS, ...BLOG_COPY_DEFAULTS, ...PRIVACY_COPY_DEFAULTS, ...COOKIES_COPY_DEFAULTS, ...MONEY_STORY_COPY_DEFAULTS };
export function publicCopyText(values: PublicCopyValues): CopyText<PublicCopyKey> {
  return createCopyText<PublicCopyKey>(key => values[key] ?? ALL_COPY_DEFAULTS[key]);
}
// Public documents must remain in Sanity's root namespace; dotted IDs require authentication.
export function publicCopyDocumentId(scope: PublicCopyScope) { return `publicPageCopy-${scope}-th`; }
export function publicCopyInitialEntries(scope: PublicCopyScope) {
  return Object.entries(PUBLIC_COPY_SCOPES[scope].defaults).map(([key, text]) => ({ _type: "publicCopyEntry", _key: key.replaceAll(".", "-"), key, text }));
}
export function parsePublicCopy(scope: PublicCopyScope, input: unknown): PublicCopyValues {
  const values: PublicCopyValues = { ...PUBLIC_COPY_SCOPES[scope].defaults };
  if (input === null) return values;
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("PUBLIC_COPY_INVALID");
  const doc = input as Record<string, unknown>;
  if (doc._id !== publicCopyDocumentId(scope) || doc._type !== "publicPageCopy" || doc.scope !== scope || doc.locale !== "th" || !Array.isArray(doc.entries)) throw new Error("PUBLIC_COPY_IDENTITY_INVALID");
  const seen = new Set<string>();
  for (const entry of doc.entries) {
    if (!entry || typeof entry !== "object" || !Object.hasOwn(PUBLIC_COPY_SCOPES[scope].defaults, entry.key) || seen.has(entry.key) || typeof entry.text !== "string" || !entry.text.trim() || entry.text.length > 12000 || /[<\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\uE000]/.test(entry.text)) throw new Error("PUBLIC_COPY_ENTRY_INVALID");
    const defaultText = (PUBLIC_COPY_SCOPES[scope].defaults as Record<string, string>)[entry.key];
    const placeholders = (value: string) => Array.from(new Set(value.match(/\{[a-zA-Z0-9_]+\}/g) ?? [])).sort().join("|");
    if (placeholders(entry.text) !== placeholders(defaultText)) throw new Error("PUBLIC_COPY_PLACEHOLDER_INVALID");
    seen.add(entry.key);
    values[entry.key as PublicCopyKey] = encodeCopyValue(entry.text, copyStyleFromEntry(entry));
  }
  return values;
}

export function getHomeCopyFaqs(values: PublicCopyValues) {
  const text = publicCopyText(values);
  return [1, 2].map(index => ({ question: text(`home.faq${index}.question` as PublicCopyKey), answer: text(`home.faq${index}.answer` as PublicCopyKey) }));
}
