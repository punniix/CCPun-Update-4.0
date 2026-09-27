import type { AnalyticsDataset } from "@/lib/admin/analytics/model";

type Bar = { label: string; value: number; detail?: string };
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const format = (value: number) => value.toLocaleString("th-TH", { maximumFractionDigits: 2 });
const intentNames: Record<string, string> = { informational: "หาข้อมูล", commercial: "เปรียบเทียบก่อนซื้อ", transactional: "พร้อมทำรายการ", navigational: "หาเว็บหรือแบรนด์", mixed: "หลายเจตนา (ผสม)" };

export function keywordChartData(dataset: Pick<AnalyticsDataset, "rows">) {
  const ranks = ["1–3", "4–10", "11–20", "21–100", "มากกว่า 100"].map((label) => ({ label, value: 0 }));
  const intents = new Map<string, number>();
  let unknownRank = 0;
  for (const row of dataset.rows) {
    const rank = number(row["อันดับ"]);
    if (rank == null || rank < 1 || !Number.isInteger(rank)) unknownRank++;
    else ranks[rank <= 3 ? 0 : rank <= 10 ? 1 : rank <= 20 ? 2 : rank <= 100 ? 3 : 4]!.value++;
    const raw = typeof row.Intent === "string" ? row.Intent.trim() : "";
    const parts = [...new Set(raw.split(/[,/|;]/).map((part) => part.trim().toLowerCase()).filter(Boolean))];
    const label = parts.length > 1 ? intentNames.mixed! : !raw || ["-", "unknown", "n/a"].includes(raw.toLowerCase()) ? "ไม่ระบุ Intent" : intentNames[raw.toLowerCase()] ?? raw;
    intents.set(label, (intents.get(label) ?? 0) + 1);
  }
  const top = dataset.rows.flatMap((row) => {
    const volume = number(row.Volume);
    return volume == null || typeof row["คำค้น"] !== "string" || !row["คำค้น"].trim() ? [] : [{ label: row["คำค้น"], value: volume }];
  }).sort((a, b) => b.value - a.value).slice(0, 10);
  const groups = [...intents].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const visibleIntents = groups.length <= 6 ? groups : [...groups.slice(0, 5), { label: "Intent กลุ่มอื่น", value: groups.slice(5).reduce((total, item) => total + item.value, 0) }];
  return { ranks, unknownRank, ranked: dataset.rows.length - unknownRank, topTen: ranks[0]!.value + ranks[1]!.value, intents: visibleIntents, top, unknownVolume: dataset.rows.filter((row) => number(row.Volume) == null).length, zeroVolume: dataset.rows.filter((row) => number(row.Volume) === 0).length };
}

export function nativeMetricBars(dataset: Pick<AnalyticsDataset, "rows">, labelKey: string, metricKey: string, detailKey?: string) {
  return dataset.rows.flatMap((row) => {
    const value = number(row[metricKey]);
    const label = row[labelKey];
    const detail = detailKey ? row[detailKey] : null;
    return value == null || typeof label !== "string" || !label.trim() ? [] : [{ label, value, ...(typeof detail === "string" ? { detail } : {}) }];
  }).sort((a, b) => b.value - a.value).slice(0, 10);
}

function Bars({ title, unit, items, note }: { title: string; unit: string; items: Bar[]; note?: string }) {
  const max = Math.max(0, ...items.map((item) => item.value));
  return <figure className="min-w-0">
    <figcaption className="font-medium">{title}</figcaption>
    <p className="mt-1 text-xs leading-5 text-white/65">{note ?? `ไม่เกิน 10 รายการ · หน่วย ${unit} · ค่าที่ไม่ทราบไม่ได้แสดงเป็นศูนย์`}</p>
    {items.length ? <ol className="mt-4 space-y-3">{items.map((item, index) => <li key={`${item.label}-${index}`}>
      <div className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words" title={item.label}>{item.label}{item.detail ? <span className="mt-1 block break-all text-xs text-white/65">{item.detail}</span> : null}</span><span className="shrink-0 tabular-nums text-[#e0c985]">{format(item.value)} <span className="text-xs text-white/65">{unit}</span></span></div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-sm bg-white/10" aria-hidden="true"><div className="h-full bg-[#e0c985]" style={{ width: `${max ? item.value / max * 100 : 0}%` }} /></div>
    </li>)}</ol> : <p className="mt-4 text-sm text-white/65">ยังไม่มีค่าที่ระบุสำหรับกราฟนี้</p>}
  </figure>;
}

export function AnalyticsCharts({ dataset }: { dataset: AnalyticsDataset }) {
  if (!dataset.rows.length) return null;
  if (dataset.report === "ubersuggest-web-keywords") {
    const data = keywordChartData(dataset);
    const share = data.ranked ? data.ranked / dataset.rows.length * 100 : null;
    const circleId = `rank-share-${dataset.batchId}`;
    return <div className="mt-6 border-t border-white/10 pt-5" aria-label="กราฟรายงานคำค้นที่บันทึกไว้">
      <h3 className="text-lg font-semibold">มองเห็นโอกาสจาก {format(dataset.rows.length)} คำค้น</h3>
      <p className="mt-1 text-xs leading-5 text-white/65">เฉพาะคำค้นในไฟล์นี้ ไม่ใช่ทุกคำค้นของเว็บไซต์ · ใช้ช่วงข้อมูลและวันที่ต้นทางอัปเดตที่ระบุด้านบน · เป็นภาพ ณ ช่วงข้อมูล ไม่ใช่แนวโน้มรายวัน</p>
      <div className="mt-5 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 rounded-xl bg-black/15 p-4 md:p-5">
          <h4 className="font-medium">คำค้นอยู่ในอันดับไหน</h4>
          <div className="mt-4 flex flex-wrap items-center gap-5">
            {share != null ? <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0" role="img" aria-labelledby={circleId}>
              <title id={circleId}>{`ต้นทางระบุอันดับ ${data.ranked} จาก ${dataset.rows.length} คำค้น คิดเป็น ${format(share)} เปอร์เซ็นต์`}</title>
              <circle cx="60" cy="60" r="47" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="11" />
              <circle cx="60" cy="60" r="47" fill="none" stroke="#e0c985" strokeWidth="11" pathLength="100" strokeDasharray={`${share} ${100 - share}`} transform="rotate(-90 60 60)" />
              <text x="60" y="57" textAnchor="middle" fill="#faf9f9" fontSize="20" fontWeight="600">{format(share)}%</text>
              <text x="60" y="77" textAnchor="middle" fill="#e0c985" fontSize="10">มีอันดับที่ระบุ</text>
            </svg> : <p className="text-sm text-white/65">ยังไม่มีอันดับที่ระบุพอคำนวณสัดส่วน</p>}
            <dl className="min-w-0 flex-1 text-sm"><div><dt className="text-white/65">อันดับ 1–10</dt><dd className="mt-1 text-2xl font-semibold text-[#e0c985]">{format(data.topTen)} <span className="text-sm font-normal">คำค้น</span></dd></div><div className="mt-3"><dt className="text-white/65">ต้นทางไม่รายงานอันดับ / ค่าที่ใช้ไม่ได้</dt><dd className="mt-1">{format(data.unknownRank)} คำค้น</dd></div></dl>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-white/10 pt-4 sm:grid-cols-3">{data.ranks.map((item) => <div key={item.label}><dt className="text-xs text-white/65">อันดับ {item.label}</dt><dd className="mt-1 font-medium">{format(item.value)} <span className="text-xs font-normal text-white/65">คำค้น</span></dd></div>)}</dl>
          <p className="mt-3 text-xs leading-5 text-white/60">วงแหวนแสดงความครบถ้วนของข้อมูลอันดับ: ระบุอันดับ {format(data.ranked)} จาก {format(dataset.rows.length)} คำค้น เครื่องหมายขีดหรือค่าว่างไม่ได้แปลว่าไม่ติดอันดับ และระบบไม่เติมอันดับแทน</p>
          <figure className="mt-6 border-t border-white/10 pt-4"><figcaption className="font-medium">ผู้ค้นหาต้องการอะไร</figcaption>
            <div className="mt-3 flex h-4 overflow-hidden rounded-sm bg-white/10" aria-hidden="true">{data.intents.map((item, index) => <span key={item.label} className="h-full border-r border-[#251818] bg-[#e0c985]" style={{ width: `${item.value / dataset.rows.length * 100}%`, opacity: 1 - index * .11 }} />)}</div>
            <ul className="mt-3 space-y-2 text-sm">{data.intents.map((item) => <li key={item.label} className="flex justify-between gap-3"><span className="min-w-0 break-words">{item.label}</span><span className="shrink-0 text-white/80">{format(item.value)} · {format(item.value / dataset.rows.length * 100)}%</span></li>)}</ul>
            <p className="mt-3 text-xs leading-5 text-white/60">จัดกลุ่มตาม Intent ที่รายงานระบุ หนึ่งคำค้นนับครั้งเดียว; คำค้นที่มีหลาย Intent รวมในกลุ่มผสม ไม่มีข้อมูลแสดงเป็น “ไม่ระบุ”</p>
          </figure>
        </div>
        <div className="min-w-0"><Bars title="คำค้นที่มีปริมาณค้นหาที่รายงานสูงสุด" unit="Volume" items={data.top} note="10 คำค้นสูงสุดตาม Volume ที่ Ubersuggest รายงาน เป็นค่าประมาณ ไม่ใช่จำนวนคลิกหรือผู้เข้าชมที่เกิดขึ้นจริง" /><p className="mt-3 text-xs leading-5 text-white/60">Volume เท่ากับศูนย์ {format(data.zeroVolume)} คำค้น · ไม่ระบุ Volume {format(data.unknownVolume)} คำค้น · ไม่เติมศูนย์แทนข้อมูลที่ไม่ทราบ</p></div>
      </div>
    </div>;
  }
  if (dataset.report === "gsc-query-page") return <div className="mt-6 border-t border-white/10 pt-5"><Bars title="คำค้นที่ได้คลิกสูงสุดในรายงาน" unit="คลิก" items={nativeMetricBars(dataset, "คำค้น", "คลิก", "หน้าเว็บ")} note="หนึ่งแท่งต่อคู่คำค้น–หน้าเว็บ ไม่รวมคู่ที่ชื่อคำค้นเหมือนกัน; เป็นยอดของช่วงข้อมูลด้านบน ไม่ใช่กราฟรายวัน" /></div>;
  if (dataset.report === "ga4-organic-landing") return <div className="mt-6 border-t border-white/10 pt-5"><Bars title="หน้าเว็บที่เข้าจากการค้นหามากที่สุด" unit="เซสชัน" items={nativeMetricBars(dataset, "หน้าเข้า", "เซสชัน")} /></div>;
  if (dataset.report === "ga4-session-performance") {
    const rows = dataset.rows.map((row) => ({ ...row, "รายละเอียดกราฟ": [row["วันที่"], row["แคมเปญ"], row["หน้าเข้า"]].filter((value) => typeof value === "string" && value.trim()).join(" · ") }));
    return <div className="mt-6 border-t border-white/10 pt-5"><Bars title="ช่องทางและแคมเปญที่มีเซสชันสูงสุดตามวันที่รายงาน" unit="เซสชัน" items={nativeMetricBars({ rows }, "แหล่งทราฟฟิก / Medium", "เซสชัน", "รายละเอียดกราฟ")} note="หนึ่งแท่งต่อวัน–ช่องทาง–แคมเปญ–หน้าเข้า ตามแถวที่ต้นทางรายงาน ไม่รวมข้ามแถว และไม่ตีความ Key events ว่าเป็นจำนวนลูกค้า" /></div>;
  }
  if (dataset.report === "ga4-marketing-events") return <div className="mt-6 border-t border-white/10 pt-5"><Bars title="เหตุการณ์จากเครื่องมือและ LINE ที่รายงานสูงสุด" unit="event" items={nativeMetricBars(dataset, "Event", "จำนวน event", "วันที่")} note="หนึ่งแท่งต่อ event–วันที่ตามรายงาน การคลิก LINE หรือ event ไม่ใช่จำนวนลูกค้าหรือยอดขายที่ยืนยันแล้ว" /></div>;
  if (dataset.report === "social-performance") {
    const platforms = [...new Set(dataset.rows.map((row) => typeof row["แพลตฟอร์ม"] === "string" ? row["แพลตฟอร์ม"] : "ไม่ระบุแพลตฟอร์ม"))];
    return <div className="mt-6 grid min-w-0 gap-6 border-t border-white/10 pt-5 lg:grid-cols-2">{platforms.map((platform) => {
      const rows = dataset.rows.filter((row) => (row["แพลตฟอร์ม"] ?? "ไม่ระบุแพลตฟอร์ม") === platform).map((row) => ({ ...row, "ชื่อกราฟ": typeof row["เนื้อหา"] === "string" && row["เนื้อหา"].trim() ? row["เนื้อหา"].slice(0, 100) : String(row["Provider Object ID"] ?? "โพสต์ไม่มีชื่อ") }));
      return <Bars key={platform} title={`โพสต์ยอดดูสูงสุด · ${platform}`} unit="ยอดดู" items={nativeMetricBars({ rows }, "ชื่อกราฟ", "ยอดดู")} note="Snapshot สะสมต่อโพสต์ แยกแพลตฟอร์ม; ไม่ใช่ยอดรายวัน และไม่รวม Reach หรือยอดดูข้ามแพลตฟอร์ม" />;
    })}</div>;
  }
  return null;
}
