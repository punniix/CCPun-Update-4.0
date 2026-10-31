import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import postcss from "postcss";

const read = file => readFileSync(file, "utf8");
const home = read("features/home/v5/V5Home.module.css");
const clock = read("components/ui/health-happy/HealthHappyCountdown.module.css");
const toc = read("features/blog/v5/V5ArticleMobileToc.tsx");
const article = read("features/blog/v5/V5Article.tsx");
const articleCss = read("features/blog/v5/V5Blog.module.css");

test("Home 01–03 removed at all widths, icon-based cards remain", () => {
  assert.match(home, /\.painCard::before, \.painCard:first-child::before \{ content: none !important; display: none !important; \}/);
  assert.match(home, /\.painCard, \.painCard:first-child \{[\s\S]*?background: var\(--v5-card\)/);
  assert.match(home, /\.painIcon \{[\s\S]*?background: #352727/);
  assert.match(read("features/home/v5/V5Home.tsx"), /pains\.map\(\(\[icon, title, body\]\)/);
});

test("Home Countdown matches FigCraft 390, 820 and 1440 geometry", () => {
  const css = postcss.parse(clock);
  const have = (width, select, prop, expected) => {
    let value;
    css.walkAtRules("media", media => {
      if(media.params!==width)return;
      media.walkRules(rule => {
        if(rule.selector===select)rule.walkDecls(d=>{if(d.prop===prop)value=d.value});
      });
    });
    assert.equal(value,expected,width+" "+select+" "+prop);
  };
  const name = '.splitDigits[data-campaign-placement="home"]';
  have("(max-width: 650px)", name + " .frame", "min-height", "432px");
  have("(max-width: 650px)", name + " .timer", "min-height", "111px");
  have("(max-width: 650px)", name + ".outside", "padding-block", "16px");
  have("(max-width: 650px)", name + " .actions a:last-child", "min-height", "74px");
  have("(min-width: 768px) and (max-width: 1023px)", name + " .frame", "min-height", "385px");
  have("(min-width: 768px) and (max-width: 1023px)", name + " .timer", "min-height", "152px");
  have("(min-width: 1280px)", name + " .frame", "min-height", "227px");
  have("(min-width: 1280px)", name + " .actions", "grid-template-columns", "repeat(2,minmax(0,441px))");
  const source=read("components/ui/health-happy/HealthHappyCountdown.tsx");
  assert.match(source,/setInterval\(update, 1000\)/);
  assert.match(source,/const TARGET = Date\.parse\('2026-11-30T23:59:59\+07:00'\)/);
});

test("TOC button removes count while dialog and anchor navigation remain", () => {
  assert.doesNotMatch(toc, /\{label\} · \{countLabel\}/);
  assert.match(toc, /<span>\{label\}<\/span>/);
  assert.match(toc, /showModal\(\)/);
  assert.match(toc, /getElementById/);
  assert.match(article,/const headings: Heading\[\]/);
});

test("Desktop TOC caption aligns with Article H1, without changing metadata", () => {
  assert.match(articleCss, /@media \(min-width: 1280px\) \{\s*\.tocAside \{ padding-inline-start: 66px; box-sizing: border-box; \}/);
  assert.match(article,/resolveNextSteps/);
});

test("Editorial cover preserves original local assets instead of destructive WebP compression", () => {
  assert.match(article,/unoptimized=\{article\.featuredImage\.src\.startsWith\("\/assets\/blog-migration\/"\)\}/);
  assert.match(article, /preload loading="eager" fetchPriority="high"/);
  assert.match(article, /<Image src=\{article\.featuredImage\.src\}/);
});


// The approved v5 CCPun portrait must replace the legacy Bitcoin favicon in
// Safari, Chrome, Apple touch bookmarks, Android shortcuts and Admin tabs.
test("CCPun favicon files consistently use the existing approved identity", () => {
  const { equal, deepEqual } = assert;
  const bytes = (file) => readFileSync(file);
  const brand = bytes("public/assets/ccpun-favicon-v5-7253e60c.png");
  for (const file of [
    "public/favicon.png",
    "apps/web/app/icon.png",
    "apps/admin/public/favicon.png",
    "apps/admin/app/icon.png",
  ]) assert.ok(brand.equals(bytes(file)), file + ": same approved CCPun mark");
  const apple = bytes("apps/web/app/apple-icon.png");
  const adminApple = bytes("apps/admin/app/apple-icon.png");
  assert.ok(apple.equals(adminApple));
  assert.equal(apple.toString("hex",0,8),"89504e470d0a1a0a");
  assert.equal(apple.readUInt32BE(16),180);
  assert.equal(apple.readUInt32BE(20),180);
  for (const file of ["public/favicon.ico","apps/web/app/favicon.ico","apps/admin/app/favicon.ico"]) {
    const b=bytes(file);
    assert.equal(b.readUInt16LE(0),0);
    assert.equal(b.readUInt16LE(2),1);
    assert.equal(b.readUInt16LE(4),4);
    deepEqual([0,1,2,3].map(i=>b.readUInt8(6+16*i)),[16,32,48,64]);
    assert.ok(b.length>5000);
  }
  const manifest=read("apps/web/app/manifest.ts");
  assert.match(manifest,/ccpun-favicon-v5-7253e60c\.png/);
  assert.match(manifest,/short_name: "CCPun"/);
});

test("Current portraits and migrated article covers have truthful alt text", () => {
  const home=read("features/home/v5/V5Home.tsx");
  const about=read("features/about/page.tsx");
  assert.doesNotMatch(home,/alt=\{text\("home\.website43Homealt"\)\}/);
  assert.match(home,/alt="ภาพถ่ายครึ่งตัวของที่ปรึกษาการเงิน CCPun สวมเสื้อสูทสีเข้มและแว่นตา"/);
  assert.match(home,/alt="ภาพถ่ายที่ปรึกษาการเงิน CCPun สวมเสื้อสูทสีเข้มและแว่นตา"/);
  assert.match(about,/alt="ภาพถ่ายที่ปรึกษาการเงิน CCPun สวมเสื้อสูทสีเข้มและแว่นตา"/);
  assert.match(article,/หน้าปก AIA Health Happy สีชมพู/);
  assert.match(article,/ภาพพีระมิดการเงินสีทองบนพื้นน้ำเงิน/);
  // CMS-owned new imageWithAlt descriptions are not overwritten.
  assert.match(article,/article\.featuredImage\.alt\}/);
  // Blog cards have adjacent descriptive headings, so their cover is decorative.
  assert.match(read("components/layout/v5/V5Primitives.tsx"),/alt="" width=\{article\.image\.width\}/);
});

test("Current local article images use original files on index cards and article pages", () => {
  assert.match(read("components/layout/v5/V5Primitives.tsx"), /unoptimized=\{article\.image\.src\.startsWith\("\/assets\/blog-migration\/"\)\}/);
  assert.match(article,/unoptimized=\{article\.featuredImage\.src\.startsWith\("\/assets\/blog-migration\/"\)\}/);
});

test("Core sitemap now includes the live About page", () => {
  assert.match(read("apps/web/app/sitemaps/core.xml/route.ts"),/loc: "https:\/\/ccpun\.com\/about\/"/);
});
