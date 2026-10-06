import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../features/money-story/components/MoneyStoryGame.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../features/money-story/MoneyStory.module.css", import.meta.url), "utf8");

test("Money Story month header keeps balances structured instead of a fragile inline sentence", () => {
  assert.match(component, /className=\{styles\.balanceSummary\}/);
  assert.match(component, /<small>เงินสดพร้อมใช้<\/small>/);
  assert.match(component, /<small>พอร์ตลงทุน<\/small>/);
  assert.doesNotMatch(component, /เงินสดพร้อมใช้ \{money\.format\([^\n]+ · พอร์ตลงทุน/);
});

test("Money Story mobile HUD puts undo on row one and balances on their own row", () => {
  assert.match(styles, /\.monthStatus\{display:contents\}/);
  assert.match(styles, /\.balanceSummary\{grid-column:1\/-1;grid-row:2;display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.undoButton\{grid-column:2;grid-row:1;min-height:36px\}/);
  assert.match(styles, /white-space:nowrap/);
});

test("Money Story keeps the two-column tablet layout through 1120px", () => {
  assert.match(styles, /@media \(max-width:1120px\)\{/);
  assert.doesNotMatch(styles, /@media \(max-width:980px\)\{/);
});
