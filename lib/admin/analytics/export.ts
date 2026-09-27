import type { AnalyticsDataset } from "./model";
import { buildPerformanceTables } from "./performance";
import { formatBangkokDateTime } from "../agent-os/export-contract";
import type { OwnerExportDataset } from "../agent-os/export-datasets";

export function buildStoredMarketingExport(datasets: AnalyticsDataset[], generatedAt: string): OwnerExportDataset {
  if (!datasets.length) throw new Error("ANALYTICS_NO_COMPLETED_DATA");
  const metadata = ["รายงาน", "แหล่งข้อมูล", "ช่วงข้อมูลเริ่ม", "ช่วงข้อมูลสิ้นสุด", "ข้อมูลต้นทาง ณ", "เก็บข้อมูล ณ (เวลาไทย)", "เขตเวลาต้นทาง", "Batch ID", "Raw SHA256", "ข้อจำกัด"];
  const columns = [...metadata, ...new Set(datasets.flatMap((data) => data.columns).filter((column) => !metadata.includes(column)))];
  return { dataset: "marketing-analytics", title: "ข้อมูลการตลาดที่บันทึกไว้", generatedAt, timeZone: "Asia/Bangkok", columns,
    rows: datasets.flatMap((data) => data.rows.map((row) => ({ ...row, "รายงาน": data.title, "แหล่งข้อมูล": data.source, "ช่วงข้อมูลเริ่ม": data.windowStart, "ช่วงข้อมูลสิ้นสุด": data.windowEnd,
      "ข้อมูลต้นทาง ณ": data.sourceAsOf, "เก็บข้อมูล ณ (เวลาไทย)": formatBangkokDateTime(data.collectedAt), "เขตเวลาต้นทาง": data.nativeTimeZone, "Batch ID": data.batchId, "Raw SHA256": data.rawHash, "ข้อจำกัด": [...data.limitations, ...(data.truncated ? ["ข้อมูลถูกจำกัดจำนวนแถว"] : [])].join(" | ") }))),
    overview: [{ label: "สร้างไฟล์เมื่อ (เวลาไทย)", value: formatBangkokDateTime(generatedAt) }, { label: "แหล่งข้อมูล", value: "Completed private batches · ไม่มีการเรียก provider ตอน export" },
      ...datasets.flatMap((data) => [{ label: data.title + " · แถว", value: data.rows.length }, { label: data.title + " · ช่วงข้อมูล", value: `${data.windowStart ?? "ไม่ทราบ"} – ${data.windowEnd ?? "ไม่ทราบ"}` }, { label: data.title + " · ต้นทางอัปเดต ณ", value: data.sourceAsOf ?? "ไม่ทราบ" }, { label: data.title + " · เขตเวลาต้นทาง", value: data.nativeTimeZone ?? "ไม่ทราบ" }, { label: data.title + " · จำกัดแถว", value: data.truncated ? "ใช่" : "ไม่" }, { label: data.title + " · เก็บ ณ", value: formatBangkokDateTime(data.collectedAt) }, { label: data.title + " · Batch", value: data.batchId }, { label: data.title + " · SHA256", value: data.rawHash }, { label: data.title + " · ขอบเขต", value: data.limitations.join(" | ") }]),
      { label: "วิธีอ่าน", value: "ว่าง = ไม่ทราบ/ไม่มีข้อมูล · % เป็นเปอร์เซ็นต์ · ห้ามรวมผู้ใช้/Reach ข้าม platform หรือช่วงเวลา · keyword/prompt/โพสต์/landing page เป็นคนละ grain" }],
  };
}

type Cell = string | number | boolean | null;
export function analyticsExportStream(content: string | Uint8Array) {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  let offset = 0;
  return new ReadableStream<Uint8Array>({ pull(controller) { if (offset >= bytes.length) { controller.close(); return; } controller.enqueue(bytes.subarray(offset, offset + 65_536)); offset += 65_536; } });
}
function xml(value: unknown) { return String(value ?? "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!); }
function columnName(index: number) { let text = ""; for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) text = String.fromCharCode(65 + (n - 1) % 26) + text; return text; }
function sheetXml(rows: Cell[][]) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols>' + (rows[0] ?? []).map((_, index) => `<col min="${index + 1}" max="${index + 1}" width="${index < 2 ? 32 : 23}" customWidth="1"/>`).join("") + '</cols><sheetData>' + rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">` + row.map((value, index) => { const ref = columnName(index) + (rowIndex + 1); const style = rowIndex === 0 ? ' s="1"' : ""; if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`; if (typeof value === "boolean") return `<c r="${ref}" t="b"${style}><v>${Number(value)}</v></c>`; return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(value)}</t></is></c>`; }).join("") + '</row>').join("") + `</sheetData><autoFilter ref="A1:${columnName(Math.max(0, (rows[0]?.length ?? 1) - 1))}${Math.max(1, rows.length)}"/></worksheet>`;
}
function crc32(data: Buffer) { let crc = 0xffffffff; for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
// ponytail: standard ZIP stored entries; no compressor or spreadsheet dependency for bounded exports.
export function storedZip(files: Array<{ name: string; content: string }>) {
  const parts: Buffer[] = [], directory: Buffer[] = []; let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name), data = Buffer.from(file.content), crc = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(33, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    parts.push(local, name, data); directory.push(central, name); offset += local.length + name.length + data.length;
  }
  const size = directory.reduce((sum, part) => sum + part.length, 0), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...directory, end]);
}
export function marketingExportXlsx(datasets: AnalyticsDataset[], generatedAt: string) {
  const data = buildStoredMarketingExport(datasets, generatedAt);
  const analysis = buildPerformanceTables(datasets).filter(table => table.rows.length);
  const tabs = [{ name: "ภาพรวม", rows: [["รายการ", "รายละเอียด"], ...data.overview.map((item) => [item.label, item.value])] as Cell[][] },
    ...datasets.map((item) => ({ name: item.report.slice(0, 31), rows: [item.columns, ...item.rows.map((row) => item.columns.map((column) => row[column] ?? null))] as Cell[][] })),
    ...analysis.map(table => ({ name: table.title, rows: [table.columns, ...table.rows.map(row => table.columns.map(column => row[column] ?? null))] as Cell[][] })),
    { name: "คำอธิบายข้อมูล", rows: [["รายงาน", "คอลัมน์", "วิธีอ่าน"], ...analysis.map(table => [table.title, "วิธีใช้", table.guidance]), ...datasets.flatMap((item) => item.columns.map((column) => [item.title, column, column.includes("(%)") ? "เปอร์เซ็นต์ 0–100; ไม่ใช่ ratio; ห้ามเฉลี่ยตรง ๆ" : /ผู้ใช้งาน|Reach/.test(column) ? "distinct ภายใน scope; ห้ามรวมข้ามรายงาน" : /CPC/.test(column) ? "สกุลเงินตามไฟล์ต้นทาง; ไม่อนุมาน THB" : "ว่าง = ไม่ทราบ; อ่านพร้อมช่วงข้อมูลและข้อจำกัดในชีตภาพรวม"]))] as Cell[][] }];
  const names = tabs.map((tab, index) => `<sheet name="${xml(tab.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  return storedZip([
    { name: "[Content_Types].xml", content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + tabs.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") + '</Types>' },
    { name: "_rels/.rels", content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${names}</sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + tabs.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("") + '<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: "xl/styles.xml", content: '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF6D233A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
    ...tabs.map((tab, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: sheetXml(tab.rows) })),
  ]);
}
