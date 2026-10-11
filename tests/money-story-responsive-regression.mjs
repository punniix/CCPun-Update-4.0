import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

const component = readFileSync(new URL("../features/money-story/components/MoneyStoryGame.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../features/money-story/MoneyStory.module.css", import.meta.url), "utf8");


const { parse } = createRequire(import.meta.url)("postcss");
const sheet = parse(styles);
function declarationsAt(selector, width) {
  const result = {};
  function visit(container) {
    for (const node of container.nodes ?? []) {
      if (node.type === "atrule") {
        if (node.name !== "media" || /hover|pointer|prefers-/.test(node.params)) continue;
        const min = Number(node.params.match(/min-width:\s*(\d+)px/)?.[1] ?? 0);
        const max = Number(node.params.match(/max-width:\s*(\d+)px/)?.[1] ?? Infinity);
        if (width >= min && width <= max) visit(node);
      } else if (node.type === "rule" && node.selector.split(",").map((item) => item.trim()).includes(selector)) {
        for (const declaration of node.nodes) {
          if (declaration.type === "decl") result[declaration.prop] = declaration.value;
        }
      }
    }
  }
  visit(sheet);
  return result;
}

test("Money Story month header keeps balances structured instead of a fragile inline sentence", () => {
  assert.match(component, /className=\{styles\.balanceSummary\}/);
  assert.match(component, /<small>เงินสดพร้อมใช้<\/small>/);
  assert.match(component, /<small>พอร์ตลงทุน<\/small>/);
  assert.doesNotMatch(component, /เงินสดพร้อมใช้ \{money\.format\([^\n]+ · พอร์ตลงทุน/);
});

test("Money Story mobile HUD puts undo on row one and balances on their own row", () => {
  assert.match(styles, /\.monthStatus\{display:contents\}/);
  assert.match(styles, /\.balanceSummary\{grid-column:1\/-1;grid-row:2;display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.undoButton\{grid-column:2;grid-row:1;min-height:44px\}/);
  assert.match(styles, /\.changeCharacterButton\{margin-top:10px;min-height:44px\}/);
  assert.match(styles, /white-space:nowrap/);
});

test("Money Story keeps character-card detail rows aligned across uneven copy", () => {
  assert.match(styles, /\.characterPickCard\{[^}]*grid-template-rows:minmax\(0,1fr\) auto[^}]*height:100%/);
  assert.match(styles, /\.characterPickMeta\{grid-column:1\/-1;grid-row:2;align-self:end/);
  assert.match(styles, /\.characterPickCard\{flex:0 0 220px;grid-template-columns:64px minmax\(0,1fr\);height:auto;align-self:stretch/);
  assert.match(styles, /\.selectedLifeStats span\{display:grid;grid-template-rows:minmax\(0,1fr\) auto/);
});

test("Money Story keeps the two-column tablet layout through 1120px", () => {
  assert.match(styles, /@media \(max-width:1120px\)\{/);
  assert.doesNotMatch(styles, /@media \(max-width:980px\)\{/);
});


test("Money Story inherits the public palette without restyling shared navigation", () => {
  for (const token of ["deep", "bg", "surface", "border", "gold"]) {
    assert.match(styles, new RegExp(`--ms-${token}:var\\(--w43-${token}\\)`));
  }
  assert.match(styles, /width:min\(1280px,100%\)/);
  assert.doesNotMatch(styles, /\.(?:nav|navCta|brand|footer)[^{]*\{/);
  assert.match(styles, /\.title\{[^}]*line-height:1\.4/);
  assert.match(styles, /:focus-visible \{ outline:2px solid var\(--ms-gold-hi\)/);
  assert.match(styles, /\.primary,\.secondary,\.choice,\.danger\{min-height:52px/);
});


test("Money Story character choices keep readable roles and square portraits at mobile size", () => {
  assert.match(styles, /\.characterPickAvatar\{width:64px;height:64px/);
  assert.match(styles, /\.characterPickCopy span\{font-size:14px;white-space:normal;line-height:1\.5/);
  assert.doesNotMatch(styles, /font-size:(?:9\.5|10|10\.5|11|11\.5)px/);
  assert.match(styles, /background-size:400% 200%/);
});


test("Money Story center-column headers allocate balances a separate row at tablet and narrow desktop widths", () => {
  for (const width of [320, 390, 667, 680, 681, 820, 844, 932, 1024, 1120, 1121, 1439]) {
    assert.equal(declarationsAt(".monthStatus", width).display, "contents", String(width));
    const balance = declarationsAt(".balanceSummary", width);
    assert.equal(balance["grid-column"], "1/-1", String(width));
    assert.equal(balance["grid-row"], "2", String(width));
    assert.equal(declarationsAt(".balanceSummary span", width)["white-space"], "normal");
    assert.equal(declarationsAt(".undoButton", width)["grid-row"], "1");
    assert.equal(declarationsAt(".balanceSummary small", width)["font-size"], "14px");
    assert.equal(declarationsAt(".balanceSummary strong", width)["font-size"], "16px");
  }
  assert.equal(declarationsAt(".monthStatus", 1440).display, "flex");
});


test("Money Story cards keep readable body text and 52px actions while using a compact spacing rhythm", () => {
  for (const width of [320, 390, 667, 680, 820, 844, 932, 1024, 1121, 1440]) {
    assert.equal(declarationsAt(".card", width).padding, width <= 680 ? "16px" : "20px");
    assert.equal(declarationsAt(".eventTitle", width)["font-size"], width <= 680 ? "24px" : "28px");
    assert.equal(declarationsAt(".eventText", width)["font-size"], "16px");
    assert.equal(declarationsAt(".eventText", width)["line-height"], "1.6");
    assert.equal(declarationsAt(".choices", width)["margin-top"], "16px");
    assert.equal(declarationsAt(".acknowledgement", width)["margin-top"], "16px");
    assert.equal(declarationsAt(".shortfallActions", width)["margin-top"], "16px");
    assert.equal(declarationsAt(".primary", width)["min-height"], "52px");
    assert.equal(declarationsAt(".recoveryChoice", width)["min-height"], "52px");
    assert.equal(declarationsAt(".recoveryChoice span", width)["font-size"], "14px");
    assert.equal(declarationsAt(".card>h3", width).margin, "0");
    assert.equal(declarationsAt(".resultSnapshot", width).padding, "16px");
    assert.equal(declarationsAt(".resultHero h2", width)["font-size"], width <= 680 ? "28px" : "32px");
  }
  assert.doesNotMatch(styles, /line-clamp|max-height:\s*\d+px/);
});
