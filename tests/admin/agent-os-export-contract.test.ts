import assert from "node:assert/strict";
import test from "node:test";

import {
  bangkokDateSuffix,
  exportFileName,
  formatBangkokDateTime,
  formatBangkokDateTimeWithOffset,
  googleSheetPresentationSpec,
} from "../../lib/admin/agent-os/export-contract";

test("Export filename date always follows Asia/Bangkok UTC+7, not UTC date", () => {
  const instant = "2026-09-24T17:30:00.000Z";
  assert.equal(bangkokDateSuffix(instant), "2026-09-25");
  assert.equal(
    exportFileName({ dataset: "crm-leads", format: "csv", generatedAt: instant }),
    "CCPun_CRM_Leads_2026-09-25.csv",
  );
  assert.equal(
    exportFileName({ dataset: "crm-leads", format: "google-sheet", generatedAt: instant }),
    "CCPun_CRM_Leads_2026-09-25",
  );
});

test("Export display timestamps are owner-readable Bangkok time", () => {
  const instant = "2026-09-24T17:30:05.000Z";
  assert.equal(formatBangkokDateTime(instant), "25/09/2026 00:30");
  assert.equal(formatBangkokDateTimeWithOffset(instant), "2026-09-25 00:30:05 +07:00");
});

test("Google Sheet export is prepared for non-developer owner use", () => {
  const spec = googleSheetPresentationSpec({
    dataset: "growth-funnel",
    generatedAt: "2026-09-24T03:00:00.000Z",
  });
  assert.equal(spec.title, "CCPun_Growth_Funnel_2026-09-24");
  assert.equal(spec.timeZone, "Asia/Bangkok");
  assert.deepEqual(spec.tabs.map((tab) => tab.title), ["ภาพรวม", "ข้อมูล"]);
  assert.equal(spec.tabs.every((tab) => tab.freezeHeader && tab.autoFilter && tab.humanReadable), true);
});
