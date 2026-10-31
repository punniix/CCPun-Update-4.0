import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadFixtureModule } from "../qa/phase1-fixture-loader.mjs";

// Execute the actual About page and its domain components. Only network services and
// the unrelated shared chrome are substituted; the CMS parser/fallbacks run normally.
const { renderAboutPage } = loadFixtureModule("features/about/page.tsx", {
  mocks: new Map([
    ["../../../public/assets/phillip-logo.svg", { __esModule: true, default: "/assets/phillip-logo.svg" }],
    ["@/lib/content/public-copy", { getPublicCopy: () => { throw new Error("Unexpected network read"); } }],
    ["@/lib/content/sanity", { getPrimaryAuthorProfile: () => { throw new Error("Unexpected author read"); } }],
    ["@/lib/deployment-environment", { IS_REVIEW_ENVIRONMENT: false }],
    ["@/components/layout/v5/V5Page", { __esModule: true, default: ({ children }: { children: unknown }) => createElement("main", null, children as never) }],
  ]),
});
const visible = (html: string) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, "");
const render = async (overrides: Record<string, string> = {}) => renderToStaticMarkup(await renderAboutPage(overrides, {}, {}, null));

test("approved biography, services and editorial notes render in Production without review mode", async () => {
  const html = await render();
  const text = visible(html);
  for (const fact of ["มหาวิทยาลัยเกษตรศาสตร์", "SCBS U-Invest", "100 คน", "SET50 Index Futures", "Gold Online Futures", "Single Stock Futures แบบ Block Trade", "Online Coaching แบบตัวต่อตัว", "Online Webinar", "Content Writer", "ภาษาไทยและภาษาอังกฤษ", "NFT, Blockchain และ Metaverse", "Cryptocurrency", "รุ่นพี่และคนรอบตัว", "เกือบหนึ่งปี", "66 ปี", "ขั้นตอนทางกฎหมาย", "ประกันชีวิตและประกันวินาศภัย", "ผมมีสัญญาร่วมงานกับพาร์ตเนอร์ในหน้านี้", "รีวิวเผยแพร่โดยได้รับอนุญาตจากผู้ให้รีวิวแล้ว"] ) assert.ok(text.includes(fact), fact);
  assert.ok(text.includes("“บริหารเวลา บริหารเงิน บริหารชีวิต”"));
  assert.equal((html.match(/data-story-chapter=/g) ?? []).length, 4);
  assert.doesNotMatch(html, /data-uat-placeholder|รอข้อมูลจากเจ้าของ/);
  assert.doesNotMatch(html, /<details[^>]*\sopen(?:=|\s|>)/);
  assert.equal((html.match(/<details(?:\s|>)/g) ?? []).length, 2);
});

test("CMS About overrides reach the real page while absent fields retain approved fallbacks", async () => {
  const html = await render({ "about.hero.heading": "หัวข้อที่เจ้าของแก้ใน About", "about.how.step2.body": "ข้อความขั้นตอนที่แก้จาก Sanity", "about.storyV2.c1.p6": "ประสบการณ์ฟิลลิปที่เจ้าของแก้ไข" });
  const text = visible(html);
  assert.match(text, /หัวข้อที่เจ้าของแก้ใน About/);
  assert.match(text, /ข้อความขั้นตอนที่แก้จาก Sanity/);
  assert.match(text, /ประสบการณ์ฟิลลิปที่เจ้าของแก้ไข/);
  assert.ok(text.includes("ระหว่างเรียนหลักสูตร CFP ผมได้เรียนรู้การจัดทำนโยบายการลงทุน"));
  assert.ok(text.includes("คุยถึงเป้าหมาย ภาระที่ต้องดูแล และเรื่องที่กำลังกังวล"));
  assert.doesNotMatch(text, /จากความสนใจเรื่องการลงทุน สู่การวางแผนการเงินที่มองชีวิตให้รอบด้าน/);
});

test("IPS originates in attending the CFP course and does not upgrade the AFPT credential", async () => {
  const html = await render();
  const chapter = html.match(/data-story-chapter="3"[\s\S]*?<\/section>/)?.[0];
  assert.ok(chapter);
  const text = visible(chapter);
  assert.ok(text.includes("ระหว่างเรียนหลักสูตร CFP ผมได้เรียนรู้การจัดทำนโยบายการลงทุน (Investment Policy Statement: IPS)"));
  assert.ok(text.includes("เป้าหมายและความเสี่ยงที่แต่ละคนยอมรับได้"));
  assert.ok(text.includes("หลังสอบผ่าน 2 Paper ผมได้รับคุณวุฒิ AFPT ด้านการลงทุน"));
  assert.doesNotMatch(text, /ได้รับคุณวุฒิ CFP|ได้รับการรับรอง CFP|สอบผ่าน 6 Paper/);
  assert.equal((visible(html).match(/Investment Policy Statement: IPS/g) ?? []).length, 1);
});

test("one semantic story flows Phillip text/photo then Bitkub text/photo and the shared reflection", async () => {
  const html = await render();
  const first = html.match(/data-story-chapter="1"[\s\S]*?<\/section>/)?.[0];
  assert.ok(first);
  const beats = [...first.matchAll(/data-story-experience="([^"]+)"[\s\S]*?<\/figure>/g)];
  assert.deepEqual(beats.map(match => match[1]), ["phillip", "bitkub"]);
  assert.ok(visible(beats[0][0]).includes("งานส่วนหนึ่งคือการจัด Online Coaching แบบตัวต่อตัวและ Online Webinar"));
  assert.match(beats[0][0], /src="\/assets\/owner-phillip-seminar.webp"/);
  assert.ok(visible(beats[1][0]).includes("ต่อมาผมทำงานเป็น Content Writer ที่ Bitkub Blockchain Technology"));
  assert.match(beats[1][0], /src="\/assets\/owner-bitkub.webp"/);
  assert.ok(first.indexOf("owner-bitkub.webp") < first.indexOf("ทั้งสองช่วงทำให้ผมได้เรียนรู้"));
  assert.equal((first.match(/owner-phillip-seminar.webp/g) ?? []).length, 1);
  assert.equal((first.match(/owner-bitkub.webp/g) ?? []).length, 1);
});


test("both FAQs begin closed and each complete CMS question occupies one summary flex item", async () => {
  const question = "CCPun ช่วยให้คำแนะนำทางการเงินด้านใดได้บ้าง?";
  const tree = await renderAboutPage({ "about.faq2.question": question }, {}, {}, null);
  const summaries: ReactElement<{ children: ReactNode }>[] = [];
  const details: ReactElement<{ open?: boolean; children: ReactNode }>[] = [];
  function visit(node: ReactNode) {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!isValidElement<{ children: ReactNode; open?: boolean }>(node)) return;
    if (node.type === "summary") summaries.push(node);
    if (node.type === "details") details.push(node);
    visit(node.props.children);
  }
  visit(tree);
  assert.equal(details.length, 2);
  assert.ok(details.every(item => item.props.open === undefined));
  assert.equal(summaries.length, 2);
  for (const summary of summaries) {
    assert.ok(isValidElement(summary.props.children));
    assert.equal(summary.props.children.type, "span");
  }
  const html = renderToStaticMarkup(tree);
  assert.ok(visible(html).includes(question));
  assert.doesNotMatch(html, /<details[^>]*\sopen(?:=|\s|>)/);
  assert.match(visible(html), /ช่วยวางแผนการลงทุนและให้คำปรึกษาด้านประกันและการเงิน/);
});


test("desktop professional photos occupy separate chronological 456px rows without changing phone sizing",()=>{
 const css=postcss.parse(readFileSync(new URL('../features/about/About.module.css',import.meta.url),'utf8'));
 const values=(query:string,selector:string,property:string)=>{let value:string|undefined;css.walkAtRules('media',media=>{if(media.params!==query)return;media.walkRules(rule=>{if(rule.selectors.includes(selector))rule.walkDecls(property,d=>{value=d.value;});});});return value;};
 const desktop='(min-width: 900px)';
 assert.equal(values(desktop,'.ownerStoryExperience','grid-template-columns'),'minmax(0, 1fr)');
 assert.equal(values(desktop,'.ownerStoryExperience','gap'),'32px');
 assert.equal(values(desktop,'.ownerStoryExperienceBeat','grid-template-columns'),'minmax(0, 1fr) minmax(0, 456px)');
 assert.equal(values(desktop,'.ownerStoryExperienceBeat','gap'),'64px');
 for(const selector of ['.ownerStoryExperienceBeat:first-child > .ownerStoryPhoto','.ownerStoryExperienceBeat:nth-child(2) > .ownerStoryPhoto']){
   assert.equal(values(desktop,selector,'grid-column'),'2');assert.equal(values(desktop,selector,'grid-row'),'1');assert.equal(values(desktop,selector,'max-width'),'456px');
 }
 assert.equal(values('(max-width: 899px)','.ownerStoryExperienceBeat .ownerStoryPhoto','max-width'),'350px');
 assert.equal(1280-64-456,760);
});


test("portrait tablet About keeps a 640px reading column, whole chronological photos and two-by-two credentials",()=>{
 const css=postcss.parse(readFileSync(new URL('../features/about/About.module.css',import.meta.url),'utf8'));
 const tablet=css.nodes.at(-1);assert.equal(tablet?.type,'atrule');
 assert.equal((tablet as postcss.AtRule).params,'(min-width: 768px) and (max-width: 1023px)');
 const value=(selector:string,property:string)=>{let result:string|undefined;(tablet as postcss.AtRule).walkRules(rule=>{if(rule.selectors.includes(selector))rule.walkDecls(property,d=>{result=d.value;});});return result;};
 assert.equal(value('.nativeHeroGrid','grid-template-columns'),'minmax(0, 340px) minmax(0, 1fr)');
 assert.equal(value('.nativePortraitFrame .portrait','height'),'400px');
 assert.equal(value('.ownerStoryCopy','grid-template-columns'),'minmax(0, 1fr)');
 assert.equal(value('.ownerStoryCopy','max-width'),'640px');
 assert.equal(value('.ownerStoryCopy p','overflow-wrap'),'anywhere');
 assert.equal(value('.ownerStoryCopy p','line-height'),'1.75');
 for(const selector of ['.ownerStoryExperienceBeat:first-child > .ownerStoryPhoto','.ownerStoryExperienceBeat:nth-child(2) > .ownerStoryPhoto']){
  assert.equal(value(selector,'max-width'),'640px');assert.equal(value(selector,'grid-column'),'auto');assert.equal(value(selector,'grid-row'),'auto');
 }
 assert.equal(value('.ownerStoryV2 .credentials','grid-template-columns'),'repeat(2, minmax(0, 1fr))');
 assert.equal(value('.nativeQuotes','grid-template-columns'),'minmax(0, 1fr)');
 assert.equal((820-640)/2,90);
});
