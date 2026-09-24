import assert from "node:assert/strict";
import test from "node:test";

import { ownerDatasetToCsv } from "../../lib/admin/agent-os/export-csv";

test("Owner CSV export uses UTF-8 BOM and human-readable columns", () => {
  const csv = ownerDatasetToCsv({
    columns: ["ลูกค้า", "สถานะ", "หมายเหตุ"],
    rows: [
      { "ลูกค้า": "ลูกค้า A123", "สถานะ": "กำลังดูแล", "หมายเหตุ": "ข้อความ, มี comma" },
    ],
  });
  assert.ok(csv.startsWith("\uFEFFลูกค้า,สถานะ,หมายเหตุ\r\n"));
  assert.match(csv, /"ข้อความ, มี comma"/);
  assert.ok(csv.endsWith("\r\n"));
});
