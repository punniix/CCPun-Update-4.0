import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Control Plane IA exposes six parent workspaces in the audited order", () => {
  const layout = read("app/(control-plane)/layout.tsx");
  const expected = [
    ['overview', 'Overview'],
    ['content', 'Content'],
    ['distribution', 'Distribution'],
    ['growth', 'Growth'],
    ['operations', 'Operations'],
    ['settings', 'Settings'],
  ] as const;
  let cursor = -1;
  for (const [key, label] of expected) {
    const marker = `key: \"${key}\",\n    label: \"${label}\"`;
    const next = layout.indexOf(marker);
    assert.ok(next > cursor, `${label} should appear once in audited order`);
    cursor = next;
  }
  assert.doesNotMatch(layout, /key: "seo"|key: "social"|key: "analytics"/);
  assert.match(layout, /label: "Studio", permission: "content:read", external: true/);
});

test("Desktop and mobile navigation use progressive disclosure instead of permanently expanded children", () => {
  const source = read("features/admin/components/AdminNavigation.tsx");
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /setOpenState\(\{ pathname, key: openGroup === key \? null : key \}\)/);
  assert.match(source, /open \? <ChildLinks/);
  assert.match(source, /dialogRef\.current\?\.showModal\(\)/);
  assert.match(source, /md:w-\[72px\]/);
  assert.match(source, /lg:w-\[232px\]/);
  assert.doesNotMatch(source, /lg:flex[^\n]*aria-label=\{`เมนูย่อย/);
});

test("Mobile shell keeps account details inside the navigation drawer instead of the page header", () => {
  const layout = read("app/(control-plane)/layout.tsx");
  const nav = read("features/admin/components/AdminNavigation.tsx");
  assert.doesNotMatch(layout, /<header/);
  assert.match(nav, /sticky top-0 z-30 flex h-14/);
  assert.match(nav, /AccountBlock/);
  assert.match(nav, /absolute inset-x-0 bottom-0/);
});

test("Dashboard defaults to compact decision rows and keeps system documentation collapsed", () => {
  const dashboard = read("app/(control-plane)/dashboard/page.tsx");
  assert.match(dashboard, /วันนี้ต้องจัดการอะไร\?/);
  assert.match(dashboard, /Needs attention/);
  assert.match(dashboard, /Quick access/);
  assert.match(dashboard, /<details/);
  assert.match(dashboard, /Content Calendar/);
  assert.match(dashboard, /ตั้งเวลา · เลื่อนเวลา · ยกเลิก Schedule/);
});

test("Calendar schedule manager preserves CAS inputs for reschedule and cancel", () => {
  const controls = read("features/admin/content/ArticleScheduleControls.tsx");
  assert.match(controls, /method: "POST"/);
  assert.match(controls, /draftRevision: record\.draftRevision/);
  assert.match(controls, /publishedRevision: record\.publishedRevision/);
  assert.match(controls, /expectedGeneration: record\.generation/);
  assert.match(controls, /expectedVersion: record\.rowVersion/);
  assert.match(controls, /requestId: crypto\.randomUUID\(\)/);
  assert.match(controls, /method: "DELETE"/);
  assert.match(controls, /จัดการ Schedule/);
  assert.match(controls, /เลื่อนเวลา/);
  assert.match(controls, /ยกเลิก Schedule/);
  assert.match(controls, /max-h-\[86dvh\]/);
  assert.match(controls, /sm:w-\[430px\]/);
});

test("Scheduler read model carries frozen revisions into Calendar controls", () => {
  const model = read("lib/admin/operations/article-scheduler-read-model.ts");
  assert.match(model, /draft_revision: z\.string/);
  assert.match(model, /published_revision: z\.string.*nullable/);
  assert.match(model, /mode,draft_revision,published_revision,scheduled_at/);
});
