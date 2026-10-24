// Readable view of a validated Local AI result for the owner's review. The raw
// JSON stays available in a collapsed block for technical checks only.

const FIELD_LABELS: Record<string, string> = {
  mode: "รูปแบบงาน",
  lineTitle: "หัวข้อการ์ด LINE",
  lineDescription: "คำโปรยการ์ด LINE",
  title: "หัวข้อ",
  description: "คำอธิบาย",
  summary: "สรุป",
  intent: "ความสนใจ",
  confidence: "ความมั่นใจ",
  priority: "ความสำคัญ",
  findings: "สิ่งที่พบ",
  label: "หัวข้อ",
  why: "เหตุผล",
  metrics: "ตัวเลขที่เกี่ยวข้อง",
  evidence: "หลักฐาน",
  evidenceIds: "อ้างอิงหลักฐาน",
  limitations: "ข้อจำกัด",
  reviewRequired: "ต้องให้คนตรวจ",
  assessmentDate: "วันที่วิเคราะห์",
  clusters: "กลุ่มคำค้น",
  queries: "คำค้น",
  redactedText: "ข้อความที่ปิดบังข้อมูลแล้ว",
  name: "ชื่อ",
  value: "ค่า",
};

const MODE_LABELS: Record<string, string> = {
  "line-card-description": "คำโปรยการ์ด LINE",
};

export function aiReviewFieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key;
}

function ScalarValue({ field, value }: { field?: string; value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className="text-white/40">—</span>;
  if (typeof value === "boolean") return <span>{value ? "ใช่" : "ไม่ใช่"}</span>;
  if (typeof value === "number") return <span>{value.toLocaleString("th-TH")}</span>;
  const text = String(value);
  return <span className="whitespace-pre-wrap break-words">{field === "mode" ? MODE_LABELS[text] ?? text : text}</span>;
}

function OutputValue({ field, value, depth }: { field?: string; value: unknown; depth: number }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-white/40">ไม่มีรายการ</span>;
    return <ul className="list-disc space-y-2 pl-5">{value.map((item, index) => <li key={index}><OutputValue value={item} depth={depth + 1} /></li>)}</ul>;
  }
  if (value && typeof value === "object") {
    if (depth > 4) return <span className="text-white/40">ดูในข้อมูลดิบ</span>;
    return <OutputFields value={value as Record<string, unknown>} depth={depth + 1} />;
  }
  return <ScalarValue field={field} value={value} />;
}

function OutputFields({ value, depth }: { value: Record<string, unknown>; depth: number }) {
  const entries = Object.entries(value);
  if (entries.length === 0) return <span className="text-white/40">ไม่มีข้อมูล</span>;
  return <dl className={depth > 1 ? "space-y-2 border-l-2 border-white/10 pl-3" : "divide-y divide-white/10"}>
    {entries.map(([key, item]) => <div key={key} className={depth > 1 ? "grid gap-1" : "grid gap-x-4 gap-y-1 py-3 last:pb-0 sm:grid-cols-[150px_minmax(0,1fr)]"}>
      <dt className="text-xs text-white/50">{aiReviewFieldLabel(key)}</dt>
      <dd className="min-w-0 text-sm leading-6 text-white/85"><OutputValue field={key} value={item} depth={depth} /></dd>
    </div>)}
  </dl>;
}

export function AiReviewOutput({ output }: { output: Record<string, unknown> }) {
  return <div className="mt-4 rounded-2xl bg-black/25 p-4">
    <OutputFields value={output} depth={1} />
    <details className="mt-4 border-t border-white/10 pt-3">
      <summary className="min-h-11 cursor-pointer py-2 text-xs text-white/55">ดูข้อมูลดิบ</summary>
      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-black/20 p-3 font-mono text-xs leading-6 text-white/65">{JSON.stringify(output, null, 2)}</pre>
    </details>
  </div>;
}
