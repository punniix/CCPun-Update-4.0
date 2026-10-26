#!/usr/bin/env node
// Generates lib/content/public-copy-locations.json: where each editable public
// copy key appears (page section, element kind, reading order). The Studio copy
// editor groups and labels entries with it, so editors never see raw keys first.
// Run: node --import tsx scripts/generate-public-copy-locations.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { PUBLIC_COPY_SCOPES } from "../lib/content/public-copy-registry.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "lib/content/public-copy-locations.json");

// Source files in the order a visitor meets them on each page. Files not listed
// still contribute; they sort after the listed ones.
const PAGE_FILES = {
  site: [
    "components/layout/website-43/Website43Navbar.tsx",
    "features/home/website-43/Website43HomeStatic.tsx",
    "components/layout/website-43/Website43Shared.tsx",
    "features/analytics/components/CookieConsent.tsx",
    "features/analytics/components/CookieConsentPreferences.tsx",
    "components/layout/CookieSettingsButton.tsx",
    "components/ui/health-happy/HealthHappyCountdown.tsx",
    "components/ui/HumanCalculatorCard.tsx",
    "components/ui/MoneyComparison.tsx",
    "lib/shared/result-share-image.ts",
    "apps/web/app/not-found.tsx",
    "apps/web/app/layout.tsx",
  ],
  home: ["features/home/website-43/Website43Home.tsx"],
  ci: [
    "features/ci-planning/page.tsx",
    "features/ci-planning/components/CILandingIntro.tsx",
    "features/ci-planning/components/CIWizard.tsx",
    "features/ci-planning/components/steps/StepExpenses.tsx",
    "features/ci-planning/components/steps/ExpenseObligationsSection.tsx",
    "features/ci-planning/components/steps/RecoveryReserveSection.tsx",
    "features/ci-planning/components/steps/StepExistingCI.tsx",
    "features/ci-planning/components/result/CIResult.tsx",
    "features/ci-planning/components/ResultImageDownloadButton.tsx",
    "features/ci-planning/result-image.ts",
  ],
  fhc: [
    "features/financial-health-check/page.tsx",
    "features/financial-health-check/components/FHCLandingIntro.tsx",
    "features/financial-health-check/components/ClientFHC.tsx",
    "features/financial-health-check/components/LifeCoverageWizard.tsx",
    "features/financial-health-check/components/FHCLifeResultImageDownloadButton.tsx",
  ],
  blog: [
    "features/blog/website-43/Website43Blog.tsx",
    "features/blog/website-43/Website43BlogInteractive.tsx",
    "features/blog/website-43/ArticleCardEngagement.tsx",
    "features/blog/pages/BlogCategoryPage.tsx",
    "features/blog/website-43/Website43Article.tsx",
    "features/blog/website-43/Website43ArticleToc.tsx",
    "features/blog/website-43/Website43ArticleOverview.tsx",
    "features/blog/website-43/Website43ArticleBody.tsx",
    "features/blog/website-43/ArticleEngagement.tsx",
    "features/blog/website-43/ArticleShareActions.tsx",
    "features/blog/website-43/ArticleDetailAccess.tsx",
    "features/blog/website-43/blogData.ts",
  ],
  privacy: ["features/legal/pages/PrivacyPage.tsx"],
  cookies: ["features/legal/pages/CookiePolicyPage.tsx"],
  moneyStory: [
    "features/money-story/page.tsx",
    "features/money-story/components/MoneyStoryScreens.tsx",
    "features/money-story/components/MoneyStoryGame.tsx",
    "features/money-story/components/MoneyStoryStatusSidebar.tsx",
  ],
};

// Human section names for whole files that have no visible heading of their own.
const FILE_SECTIONS = {
  "components/layout/website-43/Website43Navbar.tsx": "เมนูด้านบน",
  "components/layout/website-43/Website43Shared.tsx": "ท้ายเว็บและส่วนที่ใช้ร่วมกัน",
  "features/home/website-43/Website43HomeStatic.tsx": "ท้ายเว็บและส่วนที่ใช้ร่วมกัน",
  "features/analytics/components/CookieConsent.tsx": "แถบขอความยินยอมคุกกี้",
  "features/analytics/components/CookieConsentPreferences.tsx": "แถบขอความยินยอมคุกกี้",
  "components/layout/CookieSettingsButton.tsx": "ท้ายเว็บและส่วนที่ใช้ร่วมกัน",
  "components/ui/health-happy/HealthHappyCountdown.tsx": "กล่องนับถอยหลัง Health Happy",
  "components/ui/HumanCalculatorCard.tsx": "การ์ดเครื่องคำนวณ",
  "components/ui/MoneyComparison.tsx": "ตัวเปรียบเทียบเงิน",
  "lib/shared/result-share-image.ts": "รูปผลลัพธ์สำหรับแชร์",
  "apps/web/app/not-found.tsx": "หน้าไม่พบ (404)",
  "apps/web/app/layout.tsx": "ทั้งเว็บ",
  "features/ci-planning/page.tsx": "ส่วนหัวและคำอธิบายหน้า",
  "features/ci-planning/components/CIWizard.tsx": "ขั้นตอนเครื่องคำนวณ",
  "features/ci-planning/components/steps/StepExpenses.tsx": "ขั้นที่ 1 · รายได้และค่าใช้จ่าย",
  "features/ci-planning/components/steps/ExpenseObligationsSection.tsx": "ขั้นที่ 1 · ภาระค่าใช้จ่าย",
  "features/ci-planning/components/steps/RecoveryReserveSection.tsx": "ขั้นที่ 2 · เงินสำรองช่วงพักฟื้น",
  "features/ci-planning/components/steps/StepExistingCI.tsx": "ขั้นที่ 3 · ความคุ้มครองที่มีอยู่",
  "features/ci-planning/components/result/CIResult.tsx": "หน้าผลลัพธ์",
  "features/ci-planning/components/ResultImageDownloadButton.tsx": "ปุ่มดาวน์โหลดรูปผลลัพธ์",
  "features/ci-planning/result-image.ts": "รูปผลลัพธ์สำหรับแชร์",
  "features/financial-health-check/page.tsx": "ส่วนหัวและคำอธิบายหน้า",
  "features/financial-health-check/components/ClientFHC.tsx": "ขั้นตอนเครื่องมือ",
  "features/financial-health-check/components/LifeCoverageWizard.tsx": "แบบประเมินทุนประกันชีวิต",
  "features/financial-health-check/components/FHCLifeResultImageDownloadButton.tsx": "ปุ่มดาวน์โหลดรูปผลลัพธ์",
  "features/blog/website-43/Website43Blog.tsx": "หน้ารวมบทความ",
  "features/blog/website-43/Website43BlogInteractive.tsx": "หน้ารวมบทความ · ค้นหาและรายการ",
  "features/blog/website-43/ArticleCardEngagement.tsx": "การ์ดบทความ · ยอดอ่านและหัวใจ",
  "features/blog/pages/BlogCategoryPage.tsx": "หน้าหมวดหมู่บทความ",
  "features/blog/website-43/Website43Article.tsx": "หน้าอ่านบทความ",
  "features/blog/website-43/Website43ArticleToc.tsx": "หน้าอ่านบทความ · สารบัญ",
  "features/blog/website-43/Website43ArticleOverview.tsx": "หน้าอ่านบทความ · สรุป",
  "features/blog/website-43/Website43ArticleBody.tsx": "หน้าอ่านบทความ · เนื้อหา",
  "features/blog/website-43/ArticleEngagement.tsx": "หน้าอ่านบทความ · ยอดอ่าน",
  "features/blog/website-43/ArticleShareActions.tsx": "หน้าอ่านบทความ · ปุ่มแชร์",
  "features/blog/website-43/ArticleDetailAccess.tsx": "หน้าอ่านบทความ · ลิงก์และรูป",
  "features/blog/website-43/blogData.ts": "ข้อมูลผู้เขียน",
  "features/money-story/page.tsx": "ส่วนหัวและคำอธิบายหน้า",
  "features/money-story/components/MoneyStoryScreens.tsx": "หน้าจอเริ่มเกมและสรุปผล",
  "features/money-story/components/MoneyStoryGame.tsx": "ระหว่างเล่นเกม",
  "features/money-story/components/MoneyStoryStatusSidebar.tsx": "แถบสถานะการเงินในเกม",
};

const ELEMENT_KINDS = {
  h1: "หัวข้อใหญ่สุดของหน้า", h2: "หัวข้อส่วน", h3: "หัวข้อย่อย", h4: "หัวข้อย่อย", p: "ย่อหน้า",
  span: "ข้อความ", strong: "ข้อความตัวหนา", em: "ข้อความเน้น", small: "ข้อความเล็ก", b: "ข้อความตัวหนา",
  button: "ปุ่ม", a: "ลิงก์", Link: "ลิงก์", label: "ชื่อช่องกรอก", li: "รายการ", ul: "รายการ", ol: "รายการ",
  td: "ช่องในตาราง", th: "หัวตาราง", tbody: "ช่องในตาราง", dt: "หัวข้อในรายการ", dd: "รายละเอียดในรายการ",
  summary: "หัวข้อที่กดเปิดปิดได้", figcaption: "คำบรรยายภาพ", blockquote: "ข้อความอ้างอิง", time: "วันที่",
  caption: "คำอธิบายตาราง", legend: "หัวข้อกลุ่มคำถาม", option: "ตัวเลือก",
};
const ATTRIBUTE_KINDS = {
  "aria-label": "ข้อความสำหรับโปรแกรมอ่านหน้าจอ", "aria-describedby": "ข้อความสำหรับโปรแกรมอ่านหน้าจอ",
  title: "หัวข้อ", placeholder: "ข้อความตัวอย่างในช่องกรอก", alt: "คำอธิบายรูป", label: "ชื่อช่องกรอก",
  description: "คำอธิบาย", eyebrow: "ข้อความเล็กเหนือหัวข้อ", help: "คำแนะนำใต้ช่องกรอก", badge: "ป้ายกำกับ",
  ctaLabel: "ปุ่ม", line1: "ข้อความบรรทัดที่ 1", line2: "ข้อความบรรทัดที่ 2", resourcesLabel: "ลิงก์แหล่งข้อมูล", href: "ลิงก์",
};
// Attributes that a sighted visitor never sees on screen.
const HIDDEN_ATTRIBUTES = new Set(["aria-label", "aria-describedby", "alt"]);
const SECTION_TAGS = new Set(["section", "header", "footer", "nav", "aside", "article", "form", "details", "fieldset", "dialog"]);
const HEADING_TAGS = new Set(["h1", "h2", "h3", "HomeSectionHeading", "Website43ToolHero", "legend", "summary"]);

const keyScope = new Map();
const defaults = new Map();
for (const [scope, config] of Object.entries(PUBLIC_COPY_SCOPES)) {
  for (const [key, text] of Object.entries(config.defaults)) { keyScope.set(key, scope); defaults.set(key, text); }
}

const tagName = node => (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText();
const shortText = text => { const clean = String(text).replace(/\{[^}]+\}/g, "…").replace(/\s+/g, " ").trim(); return clean.length > 48 ? `${clean.slice(0, 46)}…` : clean; };

function copyKeyOf(node) {
  if (!ts.isCallExpression(node) || node.arguments.length < 1) return null;
  const argument = node.arguments[0];
  if ((ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) && keyScope.has(argument.text)) return argument.text;
  return null;
}

// First copy key rendered as a heading inside an element (or its title prop).
function headingKeyWithin(element) {
  let found = null;
  const visit = node => {
    if (found) return;
    if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && HEADING_TAGS.has(tagName(node))) {
      const scan = inner => { if (found) return; const key = copyKeyOf(inner); if (key) { found = key; return; } ts.forEachChild(inner, scan); };
      scan(node);
      if (found) return;
    }
    ts.forEachChild(node, visit);
  };
  visit(element);
  return found;
}

function describe(call, file) {
  let attribute = null, element = null, section = null;
  for (let parent = call.parent; parent; parent = parent.parent) {
    if (!attribute && !element && ts.isJsxAttribute(parent)) attribute = parent.name.getText();
    if ((ts.isJsxElement(parent) || ts.isJsxSelfClosingElement(parent))) {
      const name = tagName(parent);
      if (!element) element = name;
      if (!section && (SECTION_TAGS.has(name) || /Section$|Hero$|Card$|Panel$|Screen$|Step$/.test(name))) {
        const headingKey = headingKeyWithin(parent);
        if (headingKey) section = shortText(defaults.get(headingKey));
      }
    }
    if (!section && (ts.isFunctionDeclaration(parent) || ts.isVariableDeclaration(parent)) && parent.name && /^[A-Z]/.test(parent.name.getText())) {
      // Component boundary: stop looking for a section in outer components.
      break;
    }
  }
  const kind = attribute ? (ATTRIBUTE_KINDS[attribute] ?? "ข้อความ") : element ? (ELEMENT_KINDS[element] ?? (/[A-Z]/.test(element[0]) ? "ข้อความในกล่อง" : "ข้อความ")) : "ข้อความ (ใช้ในระบบ)";
  return {
    section: section ?? FILE_SECTIONS[file] ?? "ส่วนอื่นของหน้า",
    kind,
    visible: !(attribute && HIDDEN_ATTRIBUTES.has(attribute)),
  };
}

const files = new Set(Object.values(PAGE_FILES).flat());
const walk = directory => {
  for (const entry of fs.readdirSync(path.join(ROOT, directory), { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) { if (!/node_modules|\.next|^tests?$/.test(entry.name)) walk(relative); }
    else if (/\.(tsx|ts)$/.test(entry.name) && !/registry|defaults|\.test\.|\.d\.ts$/.test(entry.name)) files.add(relative);
  }
};
for (const directory of ["features", "components", "apps/web/app", "lib/shared"]) walk(directory);

const fileRank = (scope, file) => { const index = PAGE_FILES[scope]?.indexOf(file) ?? -1; return index === -1 ? 999 : index; };
const found = new Map();
for (const file of [...files].sort()) {
  const absolute = path.join(ROOT, file);
  if (!fs.existsSync(absolute)) continue;
  const source = fs.readFileSync(absolute, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  // Copy built into constants (`const steps = [text("…")]`) is located where the
  // constant is rendered, not where it is declared.
  const jsxUses = new Map();
  const collectUses = node => {
    if (ts.isIdentifier(node) && !ts.isVariableDeclaration(node.parent)) {
      let inJsx = false;
      for (let parent = node.parent; parent; parent = parent.parent) if (ts.isJsxExpression(parent)) { inJsx = true; break; }
      if (inJsx && !jsxUses.has(node.text)) jsxUses.set(node.text, node);
    }
    ts.forEachChild(node, collectUses);
  };
  collectUses(sourceFile);
  const anchorOf = node => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isJsxElement(parent) || ts.isJsxSelfClosingElement(parent) || ts.isJsxAttribute(parent)) return node;
      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return jsxUses.get(parent.name.text) ?? node;
    }
    return node;
  };
  const visit = node => {
    const key = copyKeyOf(node);
    if (key && !found.has(key)) {
      const scope = keyScope.get(key);
      const anchor = anchorOf(node);
      const location = describe(anchor, file);
      if (anchor !== node && location.kind.startsWith("ข้อความ")) location.kind = "ข้อความในรายการ";
      found.set(key, { ...location, order: fileRank(scope, file) * 100000 + anchor.getStart() + (node.getStart() / 1e7) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

// Keys composed at runtime (game events, calculator presets) keep registry order
// and are grouped by their key prefix.
const PREFIX_SECTIONS = {
  "moneyStory.event": "เหตุการณ์ในเกม", "moneyStory.character": "ตัวละครในเกม", "moneyStory.choice": "ตัวเลือกในเกม",
  "ci.recovery.preset": "ขั้นที่ 2 · ชุดค่าใช้จ่ายพักฟื้นสำเร็จรูป", "ci.recovery.source": "ขั้นที่ 2 · แหล่งข้อมูลอ้างอิง",
  "ci.recovery.mode": "ขั้นที่ 2 · เงินสำรองช่วงพักฟื้น", "ci.method": "วิธีคำนวณ", "ci.image": "รูปผลลัพธ์สำหรับแชร์",
  "home.faq": "คำถามที่พบบ่อย",
};
const prefixSection = key => {
  const match = Object.keys(PREFIX_SECTIONS).filter(prefix => key.startsWith(prefix)).sort((a, b) => b.length - a.length)[0];
  if (match) return PREFIX_SECTIONS[match];
  const segment = key.split(".")[1] ?? "";
  if (/^faq\d*/i.test(segment)) return "คำถามที่พบบ่อย";
  if (/^validation/i.test(segment)) return "ข้อความเตือนเมื่อกรอกข้อมูลไม่ครบหรือไม่ถูกต้อง";
  if (/^story/i.test(segment)) return "เรื่องเล่าตัวอย่าง";
  if (/^(config|engine|enginerecovery|financialmetrics)$/i.test(segment)) return "ข้อความที่เกมเลือกแสดงตามสถานการณ์";
  return "ข้อความที่ระบบเลือกแสดงตามสถานการณ์";
};

const result = {};
for (const [scope, config] of Object.entries(PUBLIC_COPY_SCOPES)) {
  const entries = Object.keys(config.defaults).map((key, registryIndex) => {
    const location = found.get(key);
    return location
      ? { key, ...location }
      : { key, section: prefixSection(key), kind: "ข้อความที่แสดงตามสถานการณ์", visible: true, order: 1_000_000_000 + registryIndex };
  }).sort((a, b) => a.order - b.order);
  const sectionOrder = [];
  for (const entry of entries) if (!sectionOrder.includes(entry.section)) sectionOrder.push(entry.section);
  result[scope] = { sections: sectionOrder, entries: Object.fromEntries(entries.map((entry, index) => [entry.key, { section: entry.section, kind: entry.kind, visible: entry.visible, order: index }])) };
}

const serialized = `${JSON.stringify(result)}\n`;
if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : "";
  if (current !== serialized) { console.error("public-copy-locations.json is stale; run node --import tsx scripts/generate-public-copy-locations.mjs"); process.exit(1); }
  console.log("Public copy locations are current.");
} else {
  fs.writeFileSync(OUTPUT, serialized);
  const counts = Object.fromEntries(Object.entries(result).map(([scope, value]) => [scope, `${Object.keys(value.entries).length} keys / ${value.sections.length} sections`]));
  console.log(counts);
}
