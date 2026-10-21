import assert from "node:assert/strict";
import test from "node:test";
import {
  articleScheduleUiBlock,
  bangkokScheduleTimestamp,
  type ArticleScheduleUiReadiness,
} from "../../cms/sanity/policy/article-schedule-readiness";

const now = Date.parse("2026-10-21T15:00:00Z");
const base: ArticleScheduleUiReadiness = {
  loading: false, busy: false, ready: true,
  mode: "validate-only", isUat: true, validating: false,
  articleBlock: null, revisionsMatch: true, confirmed: true,
  locked: false, draftPresent: true, scheduledLocal: "2026-10-21T22:10",
};

test("UI readiness permits approved validate-only UAT schedule with correct Bangkok time", () => {
  assert.equal(bangkokScheduleTimestamp("2026-10-21T22:10"), Date.parse("2026-10-21T15:10:00Z"));
  assert.equal(articleScheduleUiBlock(base, now), null);
});

test("fails closed when UAT server claims Production publish mode", () => {
  assert.match(articleScheduleUiBlock({...base, mode: "publish"}, now) || "", /UAT/);
  assert.match(articleScheduleUiBlock({...base, isUat: false, mode: "validate-only"}, now) || "", /Production/);
});

test("missing owner confirmation is visible and denies submit", () => {
  assert.match(articleScheduleUiBlock({...base, confirmed: false}, now) || "", /เครื่องหมายยืนยัน/);
});

test("fails closed for unavailable state, capability or pending validation", () => {
  for (const input of [{ready: null}, {ready: false}, {loading: true}, {busy: true},
    {validating: true}, {locked: true}, {draftPresent: false}, {revisionsMatch: false}]) {
    assert.notEqual(articleScheduleUiBlock({...base, ...input}, now), null);
  }
});

test("fails closed for article publication guard", () => {
  assert.match(articleScheduleUiBlock({...base, articleBlock: "Review required"}, now) || "", /Review required/);
});

test("rejects malformed or impossible Bangkok local dates", () => {
  for (const date of ["", "2026-02-30T10:00", "2026-13-01T10:00", "2026-10-21T25:00", "2026-10-21T22:10Z"]) {
    assert.equal(bangkokScheduleTimestamp(date), null);
    assert.match(articleScheduleUiBlock({...base, scheduledLocal: date}, now) || "", /ถูกต้อง/);
  }
});

test("enforces 30-second minimum and 90-day maximum UAT scheduling windows", () => {
  assert.match(articleScheduleUiBlock({...base, scheduledLocal:"2026-10-21T22:00"},now)||"",/30 วินาที/);
  assert.match(articleScheduleUiBlock({...base, scheduledLocal:"2027-02-01T00:00"},now)||"",/90 วัน/);
});
